import { PrismaClient, RoleCode } from '@prisma/client';
import { MR11_ORDERED_COLUMNS, ORDERED_HEADER_LIST } from '../../config/mr11.config';
import { saveMr11RunToDb, fetchLatestMr11RunFromDb, restoreEngineHistory } from '../../db/supabase';
import { exportEngineHistory } from '../../db/prisma';
import { FortuneSheet } from '../../utils/excel-normalizer';

export const Mr11Status = {
  EMPTY: 'EMPTY',
  PARTIAL: 'PARTIAL',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export type Mr11Status = (typeof Mr11Status)[keyof typeof Mr11Status];

interface ExtractedRow {
  data: Record<string, any>;
  fontColor?: string;
  fillColor?: string;
  rawCells?: Record<number, any>;
  /** Headers whose value here is a copy from a merged cell above / to the left */
  mergedCopyHeaders?: string[];
  /** Dispatch only: which Dispatch file the row came from */
  dispatchPart?: DispatchPart;
}

// Dispatch keeps two files: Local (Malaysia) and Overseas (every other country)
export type DispatchPart = 'LOCAL' | 'OVERSEAS';
export const DISPATCH_PARTS: DispatchPart[] = ['LOCAL', 'OVERSEAS'];

function parseNumeric(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeStream(val: any): string {
  if (val === null || val === undefined || val === '') return '1';
  const num = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  return isNaN(num) ? String(val).trim().toUpperCase() : String(num);
}

function normalizeColor(color: any): string {
  if (!color) return '#000000';
  const s = String(color).trim().toUpperCase();
  if (s === 'BLACK' || s === '#000' || s === '#000000') return '#000000';
  if (s === 'WHITE' || s === '#FFF' || s === '#FFFFFF') return '#FFFFFF';
  return s.startsWith('#') ? s : `#${s}`;
}

// Blue font (e.g. #0F9ED5, #0070C0, #0000FF): hue between cyan-blue and blue, clearly coloured
function isBlueColor(color: any): boolean {
  const hex = normalizeColor(color);
  if (!/^#[0-9A-F]{6}$/.test(hex)) return false;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (max === 0 || d / max < 0.35 || max < 0.25) return false;
  let hue = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue = (hue * 60 + 360) % 360;
  return hue >= 185 && hue <= 250;
}

// MR11 output columns that come from the Production and Dispatch files
const PRODUCTION_DISPATCH_COLUMN =
  /^(total produced|produced|production|total dispatch|dispatch|despatch|date dispatched|actual dispatch|formwork quantity sailed|formwork sailed|etd|atd|actual time of departure|actual departure)/i;

// Distance between two hex colours (0 = identical, ~441 = black vs white)
function colourDistance(a: string, b: string): number {
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  const [x, y] = [rgb(a), rgb(b)];
  return Math.sqrt(x.reduce((sum, v, i) => sum + (v - y[i]) ** 2, 0));
}

// Rows whose font and fill colour are closest to the given ones, when close enough to be the
// same colour in another shade (e.g. #FF0000 for #C00000). An empty fill only matches no fill.
const SAME_COLOUR_DISTANCE = 100;
function closestColourGroup<T extends { fontColor?: string; fillColor?: string }>(rows: T[], font: string, fill: string): T[] {
  let best: T[] = [];
  let bestScore = Infinity;
  for (const row of rows) {
    const rowFill = normalizeFillColor(row.fillColor);
    if (Boolean(rowFill) !== Boolean(fill)) continue;
    const fontGap = colourDistance(normalizeColor(row.fontColor), font);
    const fillGap = fill ? colourDistance(rowFill, fill) : 0;
    if (fontGap > SAME_COLOUR_DISTANCE || fillGap > SAME_COLOUR_DISTANCE) continue;
    const score = fontGap + fillGap;
    if (score < bestScore - 0.5) {
      best = [row];
      bestScore = score;
    } else if (Math.abs(score - bestScore) <= 0.5) {
      best.push(row);
    }
  }
  return best;
}

// Rows whose fill colour is closest to the given one (no fill only matches no fill); for files
// that mark their blocks by fill alone
function closestFillGroup<T extends { fillColor?: string }>(rows: T[], fill: string): T[] {
  if (!fill) return rows.filter((row) => !normalizeFillColor(row.fillColor));
  let best: T[] = [];
  let bestGap = Infinity;
  for (const row of rows) {
    const rowFill = normalizeFillColor(row.fillColor);
    if (!rowFill) continue;
    const gap = colourDistance(rowFill, fill);
    if (gap > SAME_COLOUR_DISTANCE) continue;
    if (gap < bestGap - 0.5) {
      best = [row];
      bestGap = gap;
    } else if (Math.abs(gap - bestGap) <= 0.5) {
      best.push(row);
    }
  }
  return best;
}

// A project code is the 5-digit project number, optionally followed by the stream:
// 251242 = project 25124 stream 2, 2512410 = project 25124 stream 10
function splitProjectCode(code: any): { project: string; stream: string | null } {
  const c = cleanStr(code);
  if (/^\d{6,7}$/.test(c)) {
    const stream = String(parseInt(c.slice(5), 10));
    return { project: c.slice(0, 5), stream: stream === '0' || stream === 'NaN' ? null : stream };
  }
  return { project: c, stream: null };
}

// One entry of a stream's Shell Plan approval history
export interface ApprovalEntry {
  key: string;
  status: string;
  revision: string | null;
  approvedDate: string | null;
  submittedDate: string | null;
  recordedOn: string;
}

// A stream's Shell Plan approval history, with the project it belongs to
export interface ApprovalHistoryGroup {
  projectNo: string | null;
  shortName: string | null;
  projectName: string | null;
  stream: string;
  fillColor: string;
  entries: ApprovalEntry[];
}

// Identity of an MR11 row across runs (to compare with the previous MR11)
function mr11RowKey(short: any, stream: any, font: any, fill: any, productType: any): string {
  return [cleanStr(short), normalizeStream(stream), normalizeColor(font), normalizeFillColor(fill), cleanStr(productType)].join('|');
}

function takePreviousRecord(byKey: Record<string, Record<string, any>[]>, key: string): Record<string, any> | null {
  const list = byKey[key];
  return list && list.length > 0 ? list.shift()! : null;
}

// Today's date in Malaysia (YYYY-MM-DD), the date shown for an upload
function malaysiaDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date());
}

function normalizeFillColor(color: any): string {
  if (!color) return '';
  const s = String(color).trim().toUpperCase();
  if (
    s === '#FFFFFF' ||
    s === 'WHITE' ||
    s === '#000000' ||
    s === 'BLACK' ||
    s === 'TRANSPARENT' ||
    s === 'NONE'
  ) {
    return '';
  }
  return s.startsWith('#') ? s : `#${s}`;
}

function getProjectIdentifier(row: Record<string, any>): string {
  const pNo = cleanStr(
    row['Project No'] ||
    row['Project No.'] ||
    row['Project No. (from design column A)'] ||
    row['Project No. (from bd column B)'] ||
    row['PROJECT NO'] ||
    row['PROJECT NO.']
  );
  const pShort = cleanStr(
    row['Short Name'] ||
    row['Project Shortname'] ||
    row['Project Shortname (from bd column C)'] ||
    row['Project Shortname (from planning column B)'] ||
    row['Shortname']
  );
  const pName = cleanStr(
    row['Customer & Project Name'] ||
    row['Project Name'] ||
    row['Project Name (from design column B)'] ||
    row['Project Name (from bd column A)'] ||
    row['Project Name (from planning column C)']
  );
  return pNo || pShort || pName;
}

function parseFlexibleDate(val: any): Date | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;

  const rawStr = String(val).trim();
  if (!rawStr || rawStr === '-' || rawStr === '0' || rawStr.toLowerCase() === 'null' || rawStr.toLowerCase() === 'tbc') return null;

  const num = typeof val === 'number' ? val : parseFloat(rawStr);
  if (!isNaN(num) && num > 30000 && !rawStr.includes('/') && !rawStr.includes('-')) {
    const parsedExcelDate = new Date(Math.round((num - 25569) * 86400 * 1000));
    return isNaN(parsedExcelDate.getTime()) ? null : parsedExcelDate;
  }

  const dmyMatch = rawStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const ymdMatch = rawStr.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(rawStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateString(val: any): string | null {
  if (!val) return null;
  const d = parseFlexibleDate(val);
  if (d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(val).trim();
}

/**
 * Design status for one project stream (same rule as ShellPlan):
 * 1. Ongoing   - any row is ongoing
 * 2. To Start  - any row is still to start (e.g. Completed + to start)
 * 3. Completed - only when every row is completed
 */
function resolveConsolidatedDesignStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'To Start';
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  const isOngoing = (s: string) => s.includes('ongoing') || s.includes('progress');
  const isToStart = (s: string) => s.includes('start') || s.includes('pending') || s.includes('hold');
  const isCompleted = (s: string) => s.includes('complete');

  if (normalized.some(isOngoing)) return 'Ongoing';
  if (normalized.some(isToStart)) return 'To Start';
  if (normalized.every(isCompleted)) return 'Completed';

  const first = statuses[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function resolveConsolidatedHolingStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'Not Completed';
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  return normalized.every((s) => s === 'completed') ? 'Completed' : 'Not Completed';
}

function resolveConsolidatedAccessoriesStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'to start';
  const normalized = statuses.map((s) => s.toLowerCase().trim());
  if (normalized.every((s) => s === 'completed')) return 'completed';
  if (normalized.some((s) => s.includes('ongoing') || s.includes('progress') || s === 'completed')) return 'ongoing';
  if (normalized.some((s) => s.includes('hold'))) return 'on hold';
  return 'to start';
}

/**
 * ShellPlan status for one project stream:
 * 1. In Progress      - any row is in progress
 * 2. Pending Drawings - any row is pending drawings
 * 3. Reapprove        - every row is approved / reapprove, with at least one reapprove
 * 4. Approved         - only when every row is approved
 */
function resolveConsolidatedShellplanStatus(statuses: string[]): string {
  if (statuses.length === 0) return 'Not Started';

  const normalized = statuses.map((s) => s.toLowerCase().trim());
  const isInProgress = (s: string) => s.includes('progress') || s.includes('ongoing');
  const isPending = (s: string) => s.includes('pending') || s.includes('drawing') || s.includes('waiting');
  const isReapprove = (s: string) => /re[\s-]?approv/.test(s);
  const isApproved = (s: string) => s.includes('approv') || s.includes('completed') || s === 'issued';

  if (normalized.some(isInProgress)) return 'In Progress';
  if (normalized.some(isPending)) return 'Pending Drawings';
  if (normalized.every(isApproved)) {
    return normalized.some(isReapprove) ? 'Reapprove' : 'Approved';
  }

  if (normalized.every((s) => s.includes('start') || s.includes('haven') || s.includes('hold'))) {
    return 'Not Started';
  }

  const first = statuses[0].trim();
  return first.charAt(0).toUpperCase() + first.slice(1);
}

// The date of a Local Dispatch day column, whose header is a date (an Excel day number such
// as 46357, or text such as 2026-12-01 / 1/12/2026); null for any other column
function dispatchDayOf(header: string): string | null {
  const h = String(header ?? '').trim();
  if (/^\d{5}(\.0+)?$/.test(h)) {
    const serial = Number(h);
    return serial > 40000 && serial < 60000 ? formatDateString(serial) : null;
  }
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(h) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(h)) {
    return parseFlexibleDate(h) ? formatDateString(h) : null;
  }
  return null;
}

function isCellFilled(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim();
  if (s === '' || s === '-' || s === '0' || s === '0.0' || s === '0.00') return false;
  const num = parseNumeric(val);
  return !isNaN(num) ? num > 0 : s.length > 0;
}

// Two-row headers: a group header repeated across columns (e.g. "Payment terms") with
// sub-headers below it (Percentage / Type / ...). Promote the sub-headers, then make
// duplicate names unique ("Type", "Type 2", ...) so columns don't overwrite each other.
function refineHeaders(headers: Record<number, string>, rowTexts: Record<number, Record<number, string>>): void {
  const headerCount = (name: string) => Object.values(headers).filter((h) => h === name).length;
  for (const texts of Object.values(rowTexts)) {
    const matches = Object.entries(texts).filter(([c, t]) => t && headers[Number(c)] === t).length;
    if (matches < 3) continue;
    const promoted: Record<number, string> = {};
    for (const [c, t] of Object.entries(texts)) {
      const h = headers[Number(c)];
      if (t && h && t !== h && headerCount(h) > 1) promoted[Number(c)] = t;
    }
    Object.assign(headers, promoted);
  }

  const seen: Record<string, number> = {};
  for (const c of Object.keys(headers).map(Number).sort((a, b) => a - b)) {
    const name = headers[c];
    seen[name] = (seen[name] || 0) + 1;
    if (seen[name] > 1) headers[c] = `${name} ${seen[name]}`;
  }
}

export function sheetToRecordsWithStyles(sheet: FortuneSheet): {
  rows: ExtractedRow[];
  detectedSeries: number;
  headers: Record<number, string>;
} {
  const headers: Record<number, string> = {};
  const rowsMap: Record<number, Record<string, any>> = {};
  const rawCellsMap: Record<number, Record<number, any>> = {};
  const rowStyleMap: Record<number, { fontColor?: string; fillColor?: string }> = {};
  let detectedSeries = 0;

  if (!sheet) return { rows: [], detectedSeries: 0, headers: {} };

  const celldata = Array.isArray(sheet.celldata) ? sheet.celldata : [];

  if (celldata.length === 0 && Array.isArray((sheet as any).data)) {
    const matrix: any[][] = (sheet as any).data;
    if (matrix.length > 0 && Array.isArray(matrix[0])) {
      for (let hR = 0; hR <= Math.min(3, matrix.length - 1); hR++) {
        if (Array.isArray(matrix[hR])) {
          matrix[hR].forEach((col: any, cIdx: number) => {
            const val = typeof col === 'object' && col !== null ? col?.v ?? col?.m : col;
            if (val !== undefined && val !== null && !headers[cIdx]) {
              headers[cIdx] = String(val).trim();
            }
          });
        }
      }

      const matrixRowTexts: Record<number, Record<number, string>> = {};
      for (let hR = 1; hR <= Math.min(3, matrix.length - 1); hR++) {
        matrixRowTexts[hR] = {};
        (matrix[hR] || []).forEach((col: any, cIdx: number) => {
          const val = typeof col === 'object' && col !== null ? col?.v ?? col?.m : col;
          if (val !== undefined && val !== null) matrixRowTexts[hR][cIdx] = String(val).trim();
        });
      }
      refineHeaders(headers, matrixRowTexts);

      for (let r = 1; r < matrix.length; r++) {
        const row = matrix[r];
        if (!row || !Array.isArray(row)) continue;
        rowsMap[r] = {};
        rawCellsMap[r] = {};
        rowStyleMap[r] = {};
        row.forEach((cell: any, cIdx: number) => {
          const colName = headers[cIdx];
          const val = typeof cell === 'object' && cell !== null ? cell?.v ?? cell?.m : cell;
          if (val !== undefined) rawCellsMap[r][cIdx] = val;
          if (colName && val !== undefined) rowsMap[r][colName] = val;

          if (cIdx === 10 && val !== undefined) rowsMap[r]['__COLUMN_K__'] = val;
          if (cIdx === 16 && val !== undefined) rowsMap[r]['__COLUMN_Q__'] = val;
          if (cIdx === 22 && val !== undefined) rowsMap[r]['__COLUMN_W__'] = val;

          if (cell && typeof cell === 'object' && cIdx <= 4) {
            const fc = cell.fc || cell.v?.fc;
            const bg = cell.bg || cell.v?.bg;
            if (fc && !rowStyleMap[r].fontColor) {
              const sfc = String(fc).toUpperCase();
              if (sfc !== '#000000' && sfc !== 'BLACK' && sfc !== '#000') {
                rowStyleMap[r].fontColor = sfc;
              }
            }
            if (bg && !rowStyleMap[r].fillColor) {
              const sbg = String(bg).toUpperCase();
              if (sbg !== '#FFFFFF' && sbg !== 'WHITE' && sbg !== '#000000' && sbg !== 'TRANSPARENT') {
                rowStyleMap[r].fillColor = sbg;
              }
            }
          }
        });
      }
    }
  } else {
    for (let checkR = 0; checkR <= 3; checkR++) {
      const rCells = celldata.filter((c) => c && c.r === checkR);
      for (const cell of rCells) {
        const text = String(cell.v?.v ?? cell.v?.m ?? '').trim();
        if (text) {
          if (!headers[cell.c]) headers[cell.c] = text;
          const match = text.match(/series\s*(\d+)/i);
          if (match && detectedSeries === 0) {
            detectedSeries = parseInt(match[1], 10);
          }
        }
      }
    }

    const cellRowTexts: Record<number, Record<number, string>> = {};
    for (const cell of celldata) {
      if (!cell || cell.r < 1 || cell.r > 3) continue;
      const text = String(cell.v?.v ?? cell.v?.m ?? '').trim();
      if (text) (cellRowTexts[cell.r] ||= {})[cell.c] = text;
    }
    refineHeaders(headers, cellRowTexts);

    const bodyCells = celldata.filter((c) => c && c.r > 0);
    for (const cell of bodyCells) {
      if (!rowsMap[cell.r]) {
        rowsMap[cell.r] = {};
        rawCellsMap[cell.r] = {};
        rowStyleMap[cell.r] = {};
      }

      const val = cell.v?.m !== undefined && cell.v?.m !== null && String(cell.v.m).trim() !== ''
        ? cell.v.m
        : cell.v?.v ?? cell.v?.m;

      if (val !== undefined) rawCellsMap[cell.r][cell.c] = val;

      const colName = headers[cell.c];
      if (colName && val !== undefined) {
        rowsMap[cell.r][colName] = val;
      }

      if (cell.c === 10 && val !== undefined) rowsMap[cell.r]['__COLUMN_K__'] = val;
      if (cell.c === 16 && val !== undefined) rowsMap[cell.r]['__COLUMN_Q__'] = val;
      if (cell.c === 22 && val !== undefined) rowsMap[cell.r]['__COLUMN_W__'] = val;

      if (cell.c <= 4) {
        if (cell.v?.fc && !rowStyleMap[cell.r].fontColor) {
          const fc = String(cell.v.fc).toUpperCase();
          if (fc !== '#000000' && fc !== 'BLACK' && fc !== '#000') {
            rowStyleMap[cell.r].fontColor = fc;
          }
        }
        if (cell.v?.bg && !rowStyleMap[cell.r].fillColor) {
          const bg = String(cell.v.bg).toUpperCase();
          if (bg !== '#FFFFFF' && bg !== 'WHITE' && bg !== '#000000' && bg !== 'TRANSPARENT') {
            rowStyleMap[cell.r].fillColor = bg;
          }
        }
      }
    }
  }

  // Merged identity cells (e.g. Project Shortname merged down a whole block) carry the
  // block's colour only on the top cell; apply it to every row the merge covers.
  const merges: Record<string, { r: number; c: number; rs: number; cs: number }> =
    (sheet as any).config?.merge || {};
  const masterStyle = (r: number, c: number): { fc?: any; bg?: any } => {
    if (celldata.length > 0) {
      const cell = celldata.find((x) => x && x.r === r && x.c === c);
      return { fc: cell?.v?.fc, bg: cell?.v?.bg };
    }
    const cell = (sheet as any).data?.[r]?.[c];
    return cell && typeof cell === 'object' ? { fc: cell.fc || cell.v?.fc, bg: cell.bg || cell.v?.bg } : {};
  };
  for (const m of Object.values(merges)) {
    if (!m || m.c > 4 || m.rs < 2) continue;
    const { fc, bg } = masterStyle(m.r, m.c);
    const sfc = fc ? String(fc).toUpperCase() : '';
    const sbg = bg ? String(bg).toUpperCase() : '';
    const useFont = sfc && sfc !== '#000000' && sfc !== 'BLACK' && sfc !== '#000';
    const useFill = sbg && sbg !== '#FFFFFF' && sbg !== 'WHITE' && sbg !== '#000000' && sbg !== 'TRANSPARENT';
    for (let rr = m.r + 1; rr < m.r + m.rs; rr++) {
      const style = rowStyleMap[rr];
      if (!style) continue;
      if (useFont && !style.fontColor) style.fontColor = sfc;
      if (useFill && !style.fillColor) style.fillColor = sbg;
    }
  }

  // Skip rows that repeat the header text (some workbooks duplicate the header on row 2,
  // or put sub-headers such as ACTUAL / F'CAST there)
  const isRepeatedHeaderRow = (rKey: number): boolean => {
    const cells = rawCellsMap[rKey] || {};
    let filled = 0;
    let matches = 0;
    for (const [c, v] of Object.entries(cells)) {
      const text = String(v ?? '').trim();
      if (!text) continue;
      filled++;
      if (headers[Number(c)] && headers[Number(c)] === text) matches++;
    }
    return matches >= 3 || (matches >= 2 && matches * 2 >= filled);
  };

  const sortedRowKeys = Object.keys(rowsMap)
    .map(Number)
    .sort((a, b) => a - b)
    .filter((rKey) => !isRepeatedHeaderRow(rKey));

  // Multi-Building / Sub-level Forward-Fill Logic
  let lastProjectNo: any = null;
  let lastShortname: any = null;
  let lastName: any = null;
  let lastFontColor: string | undefined = undefined;
  let lastFillColor: string | undefined = undefined;

  for (const rKey of sortedRowKeys) {
    const row = rowsMap[rKey];
    const pNo = row['Project No'] || row['Project No.'] || row['Project No. (from design column A)'] || row['Project No. (from bd column B)'] || row['PROJECT NO'];
    const pShort = row['Short Name'] || row['Project Shortname'] || row['Project Shortname (from bd column C)'];
    const pName = row['Customer & Project Name'] || row['Project Name'] || row['Project Name (from design column B)'] || row['Project Name (from bd column A)'];

    if (pNo || pShort || pName) {
      if (pNo) lastProjectNo = pNo;
      if (pShort) lastShortname = pShort;
      if (pName) lastName = pName;
      lastFontColor = rowStyleMap[rKey]?.fontColor;
      lastFillColor = rowStyleMap[rKey]?.fillColor;
    } else {
      if (lastProjectNo && !row['Project No']) row['Project No'] = lastProjectNo;
      if (lastProjectNo && !row['Project No.']) row['Project No.'] = lastProjectNo;
      if (lastShortname && !row['Short Name']) row['Short Name'] = lastShortname;
      if (lastName && !row['Customer & Project Name']) row['Customer & Project Name'] = lastName;
      if (lastName && !row['Project Name']) row['Project Name'] = lastName;
      if (lastFontColor && !rowStyleMap[rKey]?.fontColor) {
        rowStyleMap[rKey].fontColor = lastFontColor;
      }
      if (lastFillColor && !rowStyleMap[rKey]?.fillColor) {
        rowStyleMap[rKey].fillColor = lastFillColor;
      }
    }
  }

  // Cells covered by a merge (other than its top-left cell) carry a copy of the merged value
  const mergeCopies: Record<number, Set<string>> = {};
  for (const m of Object.values(merges)) {
    if (!m) continue;
    for (let rr = m.r; rr < m.r + m.rs; rr++) {
      for (let cc = m.c; cc < m.c + m.cs; cc++) {
        if ((rr !== m.r || cc !== m.c) && headers[cc]) (mergeCopies[rr] ||= new Set()).add(headers[cc]);
      }
    }
  }

  const rows = sortedRowKeys.map((rKey) => ({
    data: rowsMap[rKey],
    fontColor: normalizeColor(rowStyleMap[rKey]?.fontColor),
    fillColor: normalizeFillColor(rowStyleMap[rKey]?.fillColor),
    rawCells: rawCellsMap[rKey],
    mergedCopyHeaders: [...(mergeCopies[rKey] || [])],
  }));

  return { rows, detectedSeries, headers };
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// English and Malay month abbreviations (Mac = March, Mei = May, Ogo = August, Okt = October, Dis = December)
const MONTH_NAME_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, mac: 2, apr: 3, may: 4, mei: 4, jun: 5, jul: 6,
  aug: 7, ogo: 7, sep: 8, oct: 9, okt: 9, nov: 10, dec: 11, dis: 11,
};

// Maps Finance month headers to MR11 labels ("Jan-26"). Headers come as text ("Mac - 26")
// or as Excel dates where a typed "Jan-27" became 2026-01-27, so the year is taken from
// the "Total YYYY" column that closes each block, falling back to the header itself.
export function buildFinanceMonthColumns(headers: Record<number, string>): { header: string; label: string }[] {
  const result: { header: string; label: string }[] = [];
  let pending: { header: string; month: number; year: number | null }[] = [];

  const flush = (year: number | null) => {
    for (const p of pending) {
      const y = year ?? p.year;
      if (y !== null) result.push({ header: p.header, label: `${MONTH_LABELS[p.month]}-${String(y).slice(-2)}` });
    }
    pending = [];
  };

  for (const c of Object.keys(headers).map(Number).sort((a, b) => a - b)) {
    const header = String(headers[c] ?? '').trim();
    const total = header.match(/^total\s*(\d{4})\b/i);
    if (total) {
      flush(parseInt(total[1], 10));
      continue;
    }

    const iso = header.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const day = parseInt(iso[3], 10);
      pending.push({ header, month: parseInt(iso[2], 10) - 1, year: day === 1 ? parseInt(iso[1], 10) : 2000 + day });
      continue;
    }

    const named = header.match(/^([a-z]{3})[a-z]*\s*[-\s']\s*(\d{2}|\d{4})$/i);
    if (named && MONTH_NAME_INDEX[named[1].toLowerCase()] !== undefined) {
      const y = parseInt(named[2], 10);
      pending.push({ header, month: MONTH_NAME_INDEX[named[1].toLowerCase()], year: y < 100 ? 2000 + y : y });
    }
  }
  flush(null);
  return result;
}

// A cell value usable as-is: not empty, not an Excel error (#VALUE!, #REF!, ...)
function isUsableValue(val: any): boolean {
  if (val === null || val === undefined || typeof val === 'object') return false;
  const s = String(val).trim();
  return s !== '' && !s.startsWith('#');
}

/**
 * LME Adjusted and Final Selling Price for a BD row. BD's own (cached) values are used
 * when present; when a formula has no saved result or returns an Excel error, the value
 * is worked out with the same rules as the BD workbook formulas:
 *   LME Adjusted = Fixed -> adjustment for the LME rate (0 if blank), Freeze -> "Check",
 *                  Variable -> adjustment for the LME rate (or "Check" if blank)
 *   Final Selling Price = Selling Price + Props + Aluminium + Freight
 *                         + LME Adjusted when it is a number (a "Check" counts as 0)
 * The LME rate is either the adjustment itself (a small figure, e.g. 10) or the aluminium
 * market price in USD/t (e.g. 3107), which BD turns into (rate - 3060) / 1000 x 22.5.
 */
const LME_BASE_PRICE = 3060; // USD/t the selling price already allows for
const LME_USD_PER_1000 = 22.5; // USD per m2 for every USD 1,000/t above the base

function lmeAdjustmentFor(rate: number): number {
  return rate >= 1000 ? Math.round(((rate - LME_BASE_PRICE) / 1000) * LME_USD_PER_1000 * 1e6) / 1e6 : rate;
}

export function resolveLmePricing(bdData: Record<string, any>): {
  lmeAdjusted: number | string | null;
  finalSellingPrice: number | string | null;
} {
  const keyWhere = (test: (k: string) => boolean) =>
    Object.keys(bdData).find((k) => test(k.toLowerCase().trim()));
  const lmeType = String(bdData[keyWhere((k) => k === 'lme' || k.startsWith('lme ('))!] ?? '')
    .trim()
    .toLowerCase();
  const lmeRate = bdData[keyWhere((k) => k.startsWith('lme rate'))!];

  const rateIsNumber = isUsableValue(lmeRate) && !isNaN(Number(lmeRate));
  let computedAdjusted: number | string | null = null;
  if (lmeType === 'fixed') computedAdjusted = rateIsNumber ? lmeAdjustmentFor(Number(lmeRate)) : 0;
  else if (lmeType === 'freeze') computedAdjusted = 'Check';
  else if (lmeType === 'variable') computedAdjusted = rateIsNumber ? lmeAdjustmentFor(Number(lmeRate)) : 'Check';

  // Strict lookups: a loose prefix match would take the "LME" column for "LME Adjusted"
  const col = (prefix: string) => bdData[keyWhere((k) => k.startsWith(prefix))!];

  const bdAdjusted = col('lme adjusted');
  let lmeAdjusted = isUsableValue(bdAdjusted) ? bdAdjusted : computedAdjusted;

  // A "Check" (Freeze, or Variable without a confirmed price) takes the adjustment for the
  // LME rate when one is entered, and the final price is then recalculated to include it
  const replacedCheck = String(lmeAdjusted ?? '').trim().toLowerCase() === 'check' && rateIsNumber;
  if (replacedCheck) lmeAdjusted = lmeAdjustmentFor(Number(lmeRate));

  const bdFinal = col('final selling price');
  if (isUsableValue(bdFinal) && !replacedCheck) return { lmeAdjusted, finalSellingPrice: bdFinal };

  const isNumber = (v: any) => isUsableValue(v) && !isNaN(Number(v));
  const parts = [
    col('selling price'),
    col('props, wpb, waler'),
    col('aluminium weight adjusted'),
    lmeAdjusted,
    col('freight adjusted'),
  ];
  if (!parts.some(isNumber)) return { lmeAdjusted, finalSellingPrice: null };
  const total = parts.reduce((sum: number, p) => sum + (isNumber(p) ? Number(p) : 0), 0);
  return { lmeAdjusted, finalSellingPrice: Math.round(total * 1e6) / 1e6 };
}

function findCellValue(row: Record<string, any>, candidateHeader: string): any {
  if (!row) return null;
  if (row[candidateHeader] !== undefined) return row[candidateHeader];
  const target = candidateHeader.toLowerCase().trim();
  for (const key of Object.keys(row)) {
    const normalized = key.toLowerCase().trim();
    if (normalized === target || normalized.startsWith(target) || target.startsWith(normalized)) {
      return row[key];
    }
  }
  return null;
}

export async function executeMr11Pipeline(
  prisma: PrismaClient,
  options: { persist?: boolean } = {}
): Promise<string> {
  const { persist = true } = options;

  // Continue from the series history saved with the latest MR11 in the database, which may come
  // from another instance or from before a restart, rather than from this instance's memory
  const latestDbRun = await fetchLatestMr11RunFromDb();
  restoreEngineHistory(latestDbRun);

  const activeDepartments = await prisma.department.findMany({
    include: { activeVersion: true },
  });

  const sourceSnapshot: Record<string, any> = {};
  const datasetMap: Partial<Record<RoleCode, ExtractedRow[]>> = {};
  let productionHeaders: Record<number, string> = {};
  const dispatchHeadersByPart: Partial<Record<DispatchPart, Record<number, string>>> = {};
  let bdMonthColumns: { header: string; label: string }[] = [];
  let detectedProdSeries = 0;

  for (const dept of activeDepartments) {
    if (dept.activeVersion?.parsedWorkbook) {
      sourceSnapshot[dept.code] = dept.activeVersion.id;
      const rawWb = dept.activeVersion.parsedWorkbook;

      const sheets: FortuneSheet[] = Array.isArray(rawWb)
        ? (rawWb as unknown as FortuneSheet[])
        : (((rawWb as any)?.sheets as unknown as FortuneSheet[]) || []);

      // Dispatch's Local and Overseas files are kept together, each read with its own headers;
      // a workbook saved before the split is the Overseas file
      if (dept.code === RoleCode.DISPATCH) {
        const files = (rawWb as any)?.dispatchFiles;
        const dispatchRowsAll: ExtractedRow[] = [];
        for (const part of DISPATCH_PARTS) {
          const partSheets: FortuneSheet[] | undefined = files ? files[part]?.sheets : part === 'OVERSEAS' ? sheets : undefined;
          if (!partSheets || partSheets.length === 0) continue;
          const { rows, headers } = sheetToRecordsWithStyles(partSheets[0]);
          dispatchHeadersByPart[part] = headers;
          dispatchRowsAll.push(...rows.map((row) => ({ ...row, dispatchPart: part })));
        }
        datasetMap[RoleCode.DISPATCH] = dispatchRowsAll;
        continue;
      }

      if (sheets.length > 0) {
        const { rows, detectedSeries, headers } = sheetToRecordsWithStyles(sheets[0]);
        datasetMap[dept.code as RoleCode] = rows;
        if (dept.code === RoleCode.PRODUCTION) {
          productionHeaders = headers;
          if (detectedSeries > 0) {
            detectedProdSeries = detectedSeries;
          }
        }
        if (dept.code === RoleCode.BD) {
          bdMonthColumns = buildFinanceMonthColumns(headers);
        }
      }
    }
  }

  // Shell Plan and Design share one workbook: when the Design file has the Shell Plan columns,
  // its rows are the Shell Plan rows too (an older separate Shell Plan file is then ignored)
  const designHasShellplan = (datasetMap[RoleCode.DESIGN] || []).some((row) =>
    Object.keys(row.data).some((k) => /^shell plan status/i.test(k.trim()))
  );
  if (designHasShellplan) datasetMap[RoleCode.SHELLPLAN] = datasetMap[RoleCode.DESIGN];

  // A BD row only counts when one of its own cells holds a value: empty formatted rows
  // (e.g. merged blocks below the data) would otherwise inherit the project above them
  if (datasetMap[RoleCode.BD]) {
    datasetMap[RoleCode.BD] = datasetMap[RoleCode.BD]!.filter((row) =>
      Object.values(row.rawCells || {}).some((v) => v !== null && v !== undefined && String(v).trim() !== '')
    );
  }

  const STREAM_HEADER_CANDIDATES = [
    'Stream',
    'stream',
    'Stream (from design column D)',
    'Stream (from planning column D)',
    'stream (from bd column D)',
    'Stream (from bd column D)',
  ];

  const todayStr = new Date().toISOString().split('T')[0];

  // --------------------------------------------------------------------------
  // 1. PLANNING SERIES & QUANTITY TRACKER (Color & Stream tracked)
  // --------------------------------------------------------------------------
  const planningRows = datasetMap[RoleCode.PLANNING] || [];
  const incomingPlanningTotals: Record<string, { projectNo: string; pShort: string; pName: string; stream: string; fontColor: string; totalQty: number }> = {};

  // BD is the master list: a project's number comes from BD by its short name, so a wrong
  // number typed in the Planning file cannot merge two projects' series
  const bdProjectNoByShort: Record<string, string> = {};
  for (const bdRow of datasetMap[RoleCode.BD] || []) {
    const s = cleanStr(findCellValue(bdRow.data, 'Short Name') || findCellValue(bdRow.data, 'Project Shortname'));
    const n = cleanStr(findCellValue(bdRow.data, 'Project No') || findCellValue(bdRow.data, 'Project No.'));
    if (s && n && !bdProjectNoByShort[s]) bdProjectNoByShort[s] = n;
  }

  for (const row of planningRows) {
    const pShort = cleanStr(findCellValue(row.data, 'Short Name') || findCellValue(row.data, 'Project Shortname') || findCellValue(row.data, 'Project Shortname (from bd column C)'));
    const pNoInFile = cleanStr(findCellValue(row.data, 'Project No') || findCellValue(row.data, 'Project No.') || findCellValue(row.data, 'Project No. (from design column A)'));
    const pNo = (pShort && bdProjectNoByShort[pShort]) || pNoInFile;
    const pName = findCellValue(row.data, 'Customer & Project Name') || findCellValue(row.data, 'Project Name') || findCellValue(row.data, 'Project Name (from design column B)');

    let stream = '1';
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(row.data, sh);
      if (v !== null && v !== undefined && v !== '') {
        stream = normalizeStream(v);
        break;
      }
    }

    const rawSeries = findCellValue(row.data, 'Series') || findCellValue(row.data, 'Series No');
    const seriesNumber = rawSeries ? parseInt(String(rawSeries).replace(/[^0-9]/g, ''), 10) : 0;
    const fontColor = normalizeColor(row.fontColor);

    if (pNo && stream) {
      const compKey = `${pNo}_${stream}_${fontColor}`;
      const rawQty = findCellValue(row.data, 'Total Quantity (m2)');
      const parsedQty = rawQty ? parseFloat(String(rawQty).replace(/[^0-9.-]/g, '')) || 0 : 0;

      if (!incomingPlanningTotals[compKey]) {
        incomingPlanningTotals[compKey] = {
          projectNo: pNo,
          pShort,
          pName,
          stream,
          fontColor,
          totalQty: parsedQty,
        };
      } else {
        incomingPlanningTotals[compKey].totalQty += parsedQty;
      }

      if (seriesNumber > 0) {
        const rawProcessed = findCellValue(row.data, 'Total Processed ') || findCellValue(row.data, 'Total Processed');
        const totalProcessed = parseNumeric(rawProcessed);
        const closingDate = findCellValue(row.data, 'Closing Date ')
          ? String(findCellValue(row.data, 'Closing Date '))
          : findCellValue(row.data, 'Closing Date')
          ? String(findCellValue(row.data, 'Closing Date'))
          : findCellValue(row.data, 'Processed Date')
          ? String(findCellValue(row.data, 'Processed Date'))
          : null;

        await prisma.planningSeriesHistory.upsert({
          where: {
            projectNo_stream_fontColor_seriesNumber: {
              projectNo: pNo,
              stream,
              fontColor,
              seriesNumber,
            },
          },
          update: {
            totalProcessed,
            totalQuantity: parsedQty > 0 ? parsedQty : null,
            closingDate,
            projectShortname: pShort || null,
            projectName: pName || null,
          },
          create: {
            projectNo: pNo,
            projectShortname: pShort || null,
            projectName: pName || null,
            stream,
            fontColor,
            seriesNumber,
            totalProcessed,
            totalQuantity: parsedQty > 0 ? parsedQty : null,
            closingDate,
          },
        });
      }
    }
  }

  for (const key of Object.keys(incomingPlanningTotals)) {
    const item = incomingPlanningTotals[key];
    const existing = await prisma.planningProjectQuantityTracker.findUnique({
      where: {
        projectNo_stream_fontColor: {
          projectNo: item.projectNo,
          stream: item.stream,
          fontColor: item.fontColor,
        },
      },
    });

    if (!existing) {
      await prisma.planningProjectQuantityTracker.create({
        data: {
          projectNo: item.projectNo,
          stream: item.stream,
          fontColor: item.fontColor,
          projectShortname: item.pShort || null,
          projectName: item.pName || null,
          lastQuantity: item.totalQty,
          lastChangedDate: todayStr,
        },
      });
    } else if (existing.lastQuantity !== item.totalQty) {
      await prisma.planningProjectQuantityTracker.update({
        where: { id: existing.id },
        data: {
          lastQuantity: item.totalQty,
          lastChangedDate: todayStr,
          projectShortname: item.pShort || existing.projectShortname,
          projectName: item.pName || existing.projectName,
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. PRODUCTION SERIES HISTORY (Color & Stream tracked)
  // --------------------------------------------------------------------------
  const productionRows = datasetMap[RoleCode.PRODUCTION] || [];

  for (const row of productionRows) {
    const pShortRaw =
      findCellValue(row.data, 'Short Name') ||
      findCellValue(row.data, 'Project Shortname') ||
      findCellValue(row.data, 'Project Shortname (from planning column B)') ||
      findCellValue(row.data, 'Customer & Project Name') ||
      findCellValue(row.data, 'Project Name') ||
      row.rawCells?.[1] ||
      row.rawCells?.[0] ||
      row.rawCells?.[2];

    const pShort = cleanStr(pShortRaw);
    const pNo = cleanStr(findCellValue(row.data, 'Project No') || findCellValue(row.data, 'Project No.') || row.rawCells?.[0]);
    const pName = String(pShortRaw || '');

    let stream = '1';
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(row.data, sh);
      if (v !== null && v !== undefined && v !== '') {
        stream = normalizeStream(v);
        break;
      }
    }

    const rawSeries =
      findCellValue(row.data, 'Series (from planning column G)') ||
      findCellValue(row.data, 'Series') ||
      findCellValue(row.data, 'Series No') ||
      row.rawCells?.[6];

    let seriesNumber = rawSeries ? parseInt(String(rawSeries).replace(/[^0-9]/g, ''), 10) : 0;
    if (!seriesNumber || isNaN(seriesNumber)) {
      seriesNumber = detectedProdSeries > 0 ? detectedProdSeries : 1;
    }

    const fontColor = normalizeColor(row.fontColor);

    // By header name first, so added or moved columns in the template don't shift it;
    // column Q is only the fallback for files without a recognisable header
    const rawProduced =
      findCellValue(row.data, 'Total Produced') ??
      findCellValue(row.data, 'Total Produced Quantity') ??
      findCellValue(row.data, 'Produced Quantity') ??
      findCellValue(row.data, 'Produced (m2)') ??
      findCellValue(row.data, 'Column Q') ??
      row.rawCells?.[16] ??
      findCellValue(row.data, '__COLUMN_Q__');

    const totalProduced = parseNumeric(rawProduced);

    if (pShort && seriesNumber > 0 && totalProduced > 0) {
      await prisma.productionSeriesHistory.upsert({
        where: {
          projectShortname_stream_fontColor_seriesNumber: {
            projectShortname: pShort,
            stream,
            fontColor,
            seriesNumber,
          },
        },
        update: {
          totalProduced,
          projectNo: pNo || undefined,
          projectName: pName || undefined,
        },
        create: {
          projectShortname: pShort,
          projectNo: pNo || null,
          projectName: pName || null,
          stream,
          fontColor,
          seriesNumber,
          totalProduced,
        },
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. FETCH HISTORICAL PLANNING & PREVIOUS RUN FOR DISPATCH TRACKING
  // --------------------------------------------------------------------------
  const allQuantityTrackers = await prisma.planningProjectQuantityTracker.findMany();
  const allHistoricalPlanningSeries = await prisma.planningSeriesHistory.findMany({
    orderBy: { seriesNumber: 'asc' },
  });

  const previousRun =
    (latestDbRun?.records?.length > 0 ? latestDbRun : null) ??
    (await prisma.mr11Run.findFirst({
      where: {
        status: 'READY',
        recordCount: { gt: 0 },
      },
      orderBy: { generatedAt: 'desc' },
    }));

  // Previous MR11 rows, for Processed Date (kept while Total Processed doesn't change)
  const uploadDateStr = malaysiaDate();
  const previousRecordsByRow: Record<string, Record<string, any>[]> = {};
  // Shell Plan approval history kept with each MR11, continued from the previous one
  const approvalHistory: Record<string, ApprovalHistoryGroup> = JSON.parse(
    JSON.stringify((previousRun?.sourceSnapshot as any)?.shellplanApprovalHistory || {})
  );
  for (const r of (previousRun?.records as Record<string, any>[]) || []) {
    const k = mr11RowKey(r['Short Name'] || r['Project Shortname'], r['Stream'], r['_fontColor'], r['_fillColor'], r['Products type']);
    (previousRecordsByRow[k] ||= []).push(r);
  }

  const prevDispatchHistory: Record<string, { quantity: number; date: string }> = {
    ...((previousRun?.sourceSnapshot as any)?.dispatchTracker || {}),
  };

  if (previousRun && Array.isArray(previousRun.records)) {
    for (const r of previousRun.records as Record<string, any>[]) {
      const rShort = cleanStr(r['Short Name'] || r['Project Shortname'] || r['Project Short Code'] || r['Short Code'] || getProjectIdentifier(r));
      const rName = cleanStr(r['Customer & Project Name'] || r['Project Name']);
      const rStream = normalizeStream(r['Stream']);
      const rFont = normalizeColor(r['_fontColor']);
      const rFill = normalizeFillColor(r['_fillColor']);

      const k = `${rShort}__${rName}__${rStream}__${rFont}__${rFill}`;

      const q = parseNumeric(
        r['Total Dispatch'] ??
        r['Total Dispatched'] ??
        r['Total Dispatched Quantity'] ??
        r['Total Dispatch (m2)'] ??
        r['Total Dispatched (m2)']
      );

      let d: string | null = null;
      for (const key of Object.keys(r)) {
        const lk = key.toLowerCase();
        if (lk.includes('dispatch') && lk.includes('date') && r[key]) {
          d = String(r[key]).trim();
          break;
        }
      }

      if (q > 0 && !prevDispatchHistory[k]) {
        prevDispatchHistory[k] = { quantity: q, date: d || todayStr };
      }
    }
  }

  const newDispatchTracker: Record<string, { quantity: number; date: string }> = {};

  const bdRecords = datasetMap[RoleCode.BD];
  if (!bdRecords || bdRecords.length === 0) {
    const run = await prisma.mr11Run.create({
      data: {
        status: 'PARTIAL' as any,
        sourceSnapshot,
        recordCount: 0,
        records: [],
      },
    });
    return run.id;
  }

  // --------------------------------------------------------------------------
  // 4. DERIVE MASTER MR11 ROWS
  // --------------------------------------------------------------------------
  const designRows = datasetMap[RoleCode.DESIGN] || [];
  const shellplanRows = datasetMap[RoleCode.SHELLPLAN] || [];
  const dispatchRows = datasetMap[RoleCode.DISPATCH] || [];

  // The Shell Plan file has no Stream column: a building's stream is taken from the Design
  // file, which lists each project's buildings (Tower A, Tower B ...) with their stream
  const streamOfBuilding: Record<string, string> = {};
  for (const d of designRows) {
    const no = cleanStr(findCellValue(d.data, 'Project No') || findCellValue(d.data, 'Project No.'));
    const building = cleanStr(findCellValue(d.data, 'Building Name'));
    let stream: string | null = null;
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(d.data, sh);
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        stream = normalizeStream(v);
        break;
      }
    }
    if (no && building && stream && !streamOfBuilding[`${no}|${building}`]) streamOfBuilding[`${no}|${building}`] = stream;
  }

  const derivedMr11Rows = bdRecords.map((bdRowItem) => {
    const bdData = bdRowItem.data;
    const projectNo = cleanStr(findCellValue(bdData, 'Project No') || findCellValue(bdData, 'Project No.') || bdRowItem.rawCells?.[1]);
    const shortName = cleanStr(findCellValue(bdData, 'Short Name') || findCellValue(bdData, 'Project Shortname') || bdRowItem.rawCells?.[2]);
    const projectName = cleanStr(findCellValue(bdData, 'Customer & Project Name') || findCellValue(bdData, 'Project Name') || bdRowItem.rawCells?.[0]);

    let bdStream = '1';
    for (const sh of STREAM_HEADER_CANDIDATES) {
      const v = findCellValue(bdData, sh);
      if (v !== null && v !== undefined && v !== '') {
        bdStream = normalizeStream(v);
        break;
      }
    }
    // A project number may carry the stream as an extra last digit (251242 = project 25124,
    // stream 2), as the Shell Plan & Design file does; that digit then decides the stream
    const streamInProjectNo = splitProjectCode(projectNo).stream;
    // Same project code as another file's: a full code with the stream must match exactly,
    // otherwise the 5-digit project number is compared
    const codeMatches = (other: string): boolean => {
      if (!projectNo || !other) return false;
      const mine = splitProjectCode(projectNo);
      const theirs = splitProjectCode(other);
      return mine.stream && theirs.stream ? projectNo === other : mine.project === theirs.project;
    };
    if (streamInProjectNo) bdStream = streamInProjectNo;

    const bdFontColor = normalizeColor(bdRowItem.fontColor);
    const bdFillColor = normalizeFillColor(bdRowItem.fillColor);
    const outRow: Record<string, any> = {};
    const cellColors: Record<string, string> = {};

    // 1. Populate defined BD columns directly from BD. Exact columns match the whole header
    // name (any letter case), so a blank "PO date" can't pick up "PO" or "LME Rate" pick up "LME"
    const exactValue = (name: string) => {
      const target = name.toLowerCase().trim();
      const key = Object.keys(bdData).find((k) => k.toLowerCase().trim() === target);
      return key !== undefined ? bdData[key] ?? null : null;
    };
    for (const mapping of MR11_ORDERED_COLUMNS) {
      if (mapping.sourceDept === RoleCode.BD) {
        const read = (name: string) => (mapping.exact ? exactValue(name) : findCellValue(bdData, name));
        let value = read(mapping.sourceColumn);
        for (const alias of mapping.aliases || []) {
          if (value !== null && value !== undefined && value !== '') break;
          value = read(alias);
        }
        outRow[mapping.target] = value;
      }
    }
    // MR11 shows the stream the row was matched on
    if (streamInProjectNo) outRow['Stream'] = bdStream;
    const lmePricing = resolveLmePricing(bdData);
    outRow['LME Adjusted (USD)'] = lmePricing.lmeAdjusted;
    outRow['Final Selling Price (USD)'] = lmePricing.finalSellingPrice;

    // 2. FINANCE: the Finance row for this BD row - same project & stream, the closest font and
    // fill colour (Finance may use its own shades, e.g. #FF9900 for #FF9933), then the same product type
    const financeCandidates = (datasetMap[RoleCode.FINANCE] || []).filter((f) => {
      const fShort = cleanStr(findCellValue(f.data, 'Project Shortname') || findCellValue(f.data, 'Short Name'));
      const fNo = cleanStr(findCellValue(f.data, 'Project No') || findCellValue(f.data, 'Project No.'));
      const idMatches = shortName && fShort ? fShort === shortName : Boolean(projectNo && fNo === projectNo);
      if (!idMatches) return false;
      let fStream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(f.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          fStream = normalizeStream(v);
          break;
        }
      }
      return fStream === bdStream;
    });
    const financeGroup = closestColourGroup(financeCandidates, bdFontColor, bdFillColor);
    const bdProductType = cleanStr(outRow['Products type']);
    const financeRow =
      financeGroup.find((f) => cleanStr(findCellValue(f.data, 'Product Type') || findCellValue(f.data, 'Products type')) === bdProductType) ??
      financeGroup[0] ??
      null;
    for (const mapping of MR11_ORDERED_COLUMNS) {
      if (mapping.sourceDept === RoleCode.FINANCE) {
        outRow[mapping.target] = financeRow ? findCellValue(financeRow.data, mapping.sourceColumn) : null;
      }
    }

    // ------------------------------------------------------------------------
    // DISPATCH MAPPINGS
    // ------------------------------------------------------------------------
    // Which Dispatch file the project is in: Malaysia (BD "Countries") is Local, every other
    // country Overseas. Until that file is uploaded, the other one is used.
    const country = String(outRow['Countries'] ?? '').trim() || String(findCellValue(bdData, 'Customer & Project Name') ?? '').split(' - ')[0];
    const homePart: DispatchPart = /^malaysia\b/i.test(country.trim()) ? 'LOCAL' : 'OVERSEAS';
    const otherPart: DispatchPart = homePart === 'LOCAL' ? 'OVERSEAS' : 'LOCAL';
    const dispatchPart: DispatchPart = dispatchHeadersByPart[homePart] || !dispatchHeadersByPart[otherPart] ? homePart : otherPart;
    const dispatchHeaders: Record<number, string> = dispatchHeadersByPart[dispatchPart] || {};
    outRow['_dispatchFile'] = dispatchPart === 'LOCAL' ? 'Local' : 'Overseas';

    // The Dispatch blocks for this BD row: same file, project & stream, and the closest font and
    // fill colour (Dispatch uses its own shades, e.g. #FF9933 for BD's #FF9900)
    const dispatchCandidates = dispatchRows.filter((dRow) => {
      if (dRow.dispatchPart !== dispatchPart) return false;
      const dShort = cleanStr(findCellValue(dRow.data, 'Short Name') || findCellValue(dRow.data, 'Project Shortname') || findCellValue(dRow.data, 'Project Shortname (from bd column C)'));
      const dNo = cleanStr(findCellValue(dRow.data, 'Project No') || findCellValue(dRow.data, 'Project No.'));
      const idMatches = shortName && dShort ? dShort === shortName : Boolean(projectNo && dNo === projectNo);
      if (!idMatches) return false;
      let dStream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(dRow.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          dStream = normalizeStream(v);
          break;
        }
      }
      return dStream === bdStream;
    });
    const dispatchMatches = closestColourGroup(dispatchCandidates, bdFontColor, bdFillColor);

    // A column's values summed over those blocks, each merged cell counted once
    const sumDispatchColumn = (header: RegExp): number | null => {
      let total: number | null = null;
      for (const dRow of dispatchMatches) {
        const key = Object.keys(dRow.data).find((k) => header.test(k.trim()));
        if (!key || dRow.mergedCopyHeaders?.includes(key) || !isCellFilled(dRow.data[key])) continue;
        total = (total ?? 0) + parseNumeric(dRow.data[key]);
      }
      return total;
    };

    // Total Dispatch = "Cumulative Dispatched (Project)"; Quantity Sailed = "Formwork Quantity Sailed (m2)"
    const totalDispatched = sumDispatchColumn(/^cumulative dispatched/i);
    const totalSailed = sumDispatchColumn(/^formwork quantity sailed/i);
    for (const key of ['Total Dispatch', 'Total Dispatched', 'Total Dispatched Quantity', 'Total Dispatch (m2)', 'Total Dispatched (m2)', 'Total Dispatched Quantity m2']) {
      outRow[key] = totalDispatched;
    }
    for (const key of ['Formwork Quantity Sailed (m2)', 'Formwork Quantity Sailed m2', 'Formwork Quantity Sailed']) {
      outRow[key] = totalSailed;
    }

    // Each Dispatch row's own dates: its ETD is the latest of the original and revised ETD columns
    // (ETA POL, Rev ETD, Rev 2 ETD ...); a row with an ATD has sailed and is listed under ATD instead.
    // Each date shows that row's m2 from "Total Area m2", e.g. "12/12/2026 (100 m2), 11/12/2026 (400 m2)".
    const dispatchColumns = (header: RegExp) =>
      Object.entries(dispatchHeaders)
        .filter(([, h]) => header.test(String(h).trim()))
        .map(([c]) => Number(c));
    const etdColumns = dispatchColumns(/\betd\b|^eta pol$/i);
    const atdColumns = dispatchColumns(/^(atd|atd date|actual time of departure)$/i);
    const latestDateIn = (dRow: ExtractedRow, columns: number[]): string | null => {
      let latest: string | null = null;
      for (const c of columns) {
        const v = dRow.rawCells?.[c] ?? dRow.data[dispatchHeaders[c]];
        const d = isCellFilled(v) && parseFlexibleDate(v) ? formatDateString(v) : null;
        if (d && (!latest || d > latest)) latest = d;
      }
      return latest;
    };

    // Local file: one column per day (header 1/12/2026), holding the m2 dispatched that day
    const localDayColumns = Object.entries(dispatchHeaders)
      .map(([c, h]) => ({ c: Number(c), h, date: dispatchDayOf(h) }))
      .filter((d): d is { c: number; h: string; date: string } => d.date !== null);

    const etdByDate = new Map<string, number | null>();
    const atdByDate = new Map<string, number | null>();
    const dispatchedByDate = new Map<string, number | null>();
    const addDate = (byDate: Map<string, number | null>, date: string, m2: number | null) => {
      const current = byDate.has(date) ? byDate.get(date)! : null;
      byDate.set(date, m2 === null ? current : (current ?? 0) + m2);
    };
    for (const dRow of dispatchMatches) {
      const areaKey = Object.keys(dRow.data).find((k) => /^total area/i.test(k.trim()));
      const m2 =
        areaKey && !dRow.mergedCopyHeaders?.includes(areaKey) && isCellFilled(dRow.data[areaKey])
          ? parseNumeric(dRow.data[areaKey])
          : null;
      if (dispatchPart === 'LOCAL') {
        for (const { c, h, date } of localDayColumns) {
          const v = dRow.rawCells?.[c] ?? dRow.data[h];
          if (!dRow.mergedCopyHeaders?.includes(h) && isCellFilled(v)) addDate(dispatchedByDate, date, parseNumeric(v));
        }
        continue;
      }
      const atd = latestDateIn(dRow, atdColumns);
      const etd = latestDateIn(dRow, etdColumns);
      if (atd) addDate(atdByDate, atd, m2);
      else if (etd) addDate(etdByDate, etd, m2);
    }

    // "2026-12-12" -> "12/12/2026 (100 m2)", latest date first
    const formatDispatchDates = (byDate: Map<string, number | null>): string | null => {
      if (byDate.size === 0) return null;
      return [...byDate.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([iso, m2]) => {
          const [y, m, d] = iso.split('-').map((p) => parseInt(p, 10));
          return `${d}/${m}/${y}${m2 !== null ? ` (${Number(m2.toFixed(2))} m2)` : ''}`;
        })
        .join(', ');
    };
    const latestOf = (byDate: Map<string, number | null>) => [...byDate.keys()].sort().pop() ?? null;

    // ETD and ATD share one column, one line each:
    //   ETD: 12/12/2026 (100 m2), 11/12/2026 (400 m2)
    //   ATD: 9/11/2026 (300 m2)
    const etdText = formatDispatchDates(etdByDate);
    const atdText = formatDispatchDates(atdByDate);
    // A Local project never sails: the column lists its dispatch days instead
    //   Dispatched: 3/12/2026 (500 m2), 1/12/2026 (600 m2)
    const dispatchedText = formatDispatchDates(dispatchedByDate);
    const etdAtd =
      [etdText && `ETD: ${etdText}`, atdText && `ATD: ${atdText}`, dispatchedText && `Dispatched: ${dispatchedText}`]
        .filter(Boolean)
        .join('\n') || null;
    outRow['ETD/ATD'] = etdAtd;

    // The previous MR11's version of this row (for dates kept while a total is unchanged)
    const previousRow = takePreviousRecord(previousRecordsByRow, mr11RowKey(shortName, bdStream, bdFontColor, bdFillColor, outRow['Products type']));

    // The upload date on which a total last changed: today when it differs from the previous
    // MR11, otherwise the date kept from then
    const dateOfChange = (current: number | null, valueKey: string, dateKey: string): string | null => {
      if (current === null) return null;
      const previousValue = previousRow && isCellFilled(previousRow[valueKey]) ? parseNumeric(previousRow[valueKey]) : null;
      const previousDate = String(previousRow?.[dateKey] ?? '');
      return previousValue === current && /^\d{4}-\d{2}-\d{2}$/.test(previousDate) ? previousDate : uploadDateStr;
    };

    // Local projects are delivered by road and never sail
    if (dispatchPart === 'LOCAL') {
      for (const key of ['Formwork Quantity Sailed (m2)', 'Formwork Quantity Sailed m2', 'Formwork Quantity Sailed']) {
        outRow[key] = '-';
      }
    }

    // Single dates for month grouping on the CEO dashboard: dispatched = when Total Dispatch
    // last changed, sailed = latest ATD
    outRow['_dispatchedDate'] = dateOfChange(totalDispatched, 'Total Dispatch', '_dispatchedDate');

    // Dispatch Date: the Local file's latest day with a dispatch; the Overseas file has no
    // dispatch days, so the upload date on which Total Dispatch last changed
    outRow['Dispatch Date'] =
      dispatchPart === 'LOCAL' ? latestOf(dispatchedByDate) : totalDispatched === null ? null : outRow['_dispatchedDate'];
    outRow['_atdDate'] = latestOf(atdByDate);
    outRow['_atdColor'] = null;

    outRow['_cellColors'] = cellColors;

    // Monthly breakdown (from the BD row's own ACTUAL / F'CAST month columns)
    const MONTH_COLUMNS_26 = MONTH_LABELS.map((m) => `${m}-26`);
    const MONTH_COLUMNS_27 = MONTH_LABELS.map((m) => `${m}-27`);

    const monthValues: Record<string, number> = {};
    for (const { header, label } of bdMonthColumns) {
      const v = parseNumeric(bdData[header]);
      if (v > 0) monthValues[label] = (monthValues[label] || 0) + v;
    }

    let sum2026 = 0;
    let sum2027 = 0;

    MONTH_COLUMNS_26.forEach((mCol) => {
      const val = monthValues[mCol] || 0;
      outRow[mCol] = val > 0 ? val : null;
      sum2026 += val;
    });
    outRow['Total 2026 m2'] = sum2026 > 0 ? sum2026 : null;

    MONTH_COLUMNS_27.forEach((mCol) => {
      const val = monthValues[mCol] || 0;
      outRow[mCol] = val > 0 ? val : null;
      sum2027 += val;
    });
    outRow['Total 2027 m2'] = sum2027 > 0 ? sum2027 : null;

    // ------------------------------------------------------------------------
    // DESIGN MAPPINGS (same project & stream, then the BD row's fill colour block)
    // ------------------------------------------------------------------------
    const designCandidates = designRows.filter((dRow) => {
      const dProjNo = cleanStr(findCellValue(dRow.data, 'Project No') || findCellValue(dRow.data, 'Project No.') || dRow.rawCells?.[0]);
      const dProjName = cleanStr(findCellValue(dRow.data, 'Project Name') || findCellValue(dRow.data, 'Customer & Project Name') || dRow.rawCells?.[1]);
      
      let dStream: string | null = null;
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(dRow.data, sh);
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          dStream = normalizeStream(v);
          break;
        }
      }

      const idMatches =
        codeMatches(dProjNo) ||
        (projectName && dProjName && (dProjName === projectName || dProjName.includes(projectName) || projectName.includes(dProjName))) ||
        (shortName && dProjName && dProjName.includes(shortName));

      if (!idMatches) return false;

      if (dStream && dStream !== bdStream) {
        return false;
      }

      return true;
    });
    // Design marks its blocks by fill colour only (its fonts are all black): a filled BD row
    // takes the block with the closest fill, an unfilled one the unfilled rows
    const streamMatchedDesign = closestFillGroup(designCandidates, bdFillColor);

    const designStatuses = streamMatchedDesign
      .map((d) => 
        findCellValue(d.data, 'Formwork Design Status') || 
        findCellValue(d.data, 'design status') || 
        findCellValue(d.data, 'Design Status') ||
        findCellValue(d.data, 'Status')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const resolvedFormworkStatus = resolveConsolidatedDesignStatus(designStatuses.map(String));
    outRow['Formwork Design Status'] = resolvedFormworkStatus;
    outRow['design status'] = resolvedFormworkStatus;
    // Where this stream's design stands (all levels completed / under way / not started); the
    // project-level status (Fully / Partially Complete...) is worked out once every row is built
    const doneLevels = designStatuses.filter((s) => /complete/i.test(String(s)) && !/not/i.test(String(s))).length;
    outRow['_designState'] =
      designStatuses.length === 0
        ? 'none'
        : doneLevels === designStatuses.length
        ? 'completed'
        : doneLevels > 0 || designStatuses.some((s) => /ongoing|progress/i.test(String(s)))
        ? 'ongoing'
        : 'tostart';

    const designDates = streamMatchedDesign
      .map((d) =>
        findCellValue(d.data, 'Actual Formwork Order Completion Date') ||
        findCellValue(d.data, 'Actual Completion Date') ||
        findCellValue(d.data, 'Completion Date')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    let latestDesignDate: string | null = null;
    for (const dv of designDates) {
      const fDate = formatDateString(dv);
      if (fDate && (!latestDesignDate || fDate > latestDesignDate)) {
        latestDesignDate = fDate;
      }
    }
    // Completion date per level ("Typical: 2026-11-04, Upper lv.10: 2026-11-05"); one date when
    // every level has the same date
    const dateByLevel = new Map<string, string>();
    // Whether every row of a level is completed (decides the colour of that level's date)
    const levelDone = new Map<string, boolean>();
    const levelOf = (d: ExtractedRow) =>
      String(findCellValue(d.data, 'Level') ?? findCellValue(d.data, 'Building type') ?? '').trim() || 'Other';
    for (const d of streamMatchedDesign) {
      const status = String(findCellValue(d.data, 'Formwork Design Status') || findCellValue(d.data, 'Design Status') || '');
      const done = /complete/i.test(status) && !/not/i.test(status);
      levelDone.set(levelOf(d), (levelDone.get(levelOf(d)) ?? true) && done);
    }
    for (const d of streamMatchedDesign) {
      const date = formatDateString(
        findCellValue(d.data, 'Actual Formwork Order Completion Date') ||
          findCellValue(d.data, 'Actual Completion Date') ||
          findCellValue(d.data, 'Completion Date')
      );
      if (!date) continue;
      const level = levelOf(d);
      const current = dateByLevel.get(level);
      if (!current || date > current) dateByLevel.set(level, date);
    }
    const levelDates = [...dateByLevel.entries()];
    const splitByLevel = levelDates.length > 1 && new Set(levelDates.map(([, d]) => d)).size > 1;
    outRow['Actual Formwork Order Completion Date'] = splitByLevel
      ? levelDates.map(([level, d]) => `${level}: ${d}`).join(', ')
      : latestDesignDate;
    // Each date shown with whether its level is completed, so the page and the export can colour it
    // (completed & passed: dark green, completed & still ahead: yellow, not completed: red)
    outRow['_designDateParts'] = splitByLevel
      ? levelDates.map(([level, date]) => ({ level, date, completed: levelDone.get(level) === true }))
      : latestDesignDate
      ? [{ level: null, date: latestDesignDate, completed: levelDone.size > 0 && [...levelDone.values()].every(Boolean) }]
      : [];
    outRow['latest design date'] = latestDesignDate;
    outRow['_designDate'] = latestDesignDate;

    const holingStatuses = streamMatchedDesign
      .map((d) => 
        findCellValue(d.data, 'holing status (Completed/Not Completed/) -dropdown') || 
        findCellValue(d.data, 'holing status') || 
        findCellValue(d.data, 'Holing Status')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const resolvedHolingStatus = resolveConsolidatedHolingStatus(holingStatuses.map(String));
    outRow['holing status'] = resolvedHolingStatus;
    outRow['Holing Status'] = resolvedHolingStatus;

    const holingDates = streamMatchedDesign
      .map((d) => 
        findCellValue(d.data, 'holing completion date') || 
        findCellValue(d.data, 'holing date') || 
        findCellValue(d.data, 'Holing Completion Date')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    let latestHolingDate: string | null = null;
    for (const hd of holingDates) {
      const fDate = formatDateString(hd);
      if (fDate && (!latestHolingDate || fDate > latestHolingDate)) {
        latestHolingDate = fDate;
      }
    }
    outRow['holing date'] = latestHolingDate;
    outRow['Holing Date'] = latestHolingDate;

    const accStatuses = streamMatchedDesign
      .map((d) => 
        findCellValue(d.data, 'accessories status dropdown (to start, ongoing, completed, on hold)') || 
        findCellValue(d.data, 'accessories status') || 
        findCellValue(d.data, 'Accessories Status')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const resolvedAccStatus = resolveConsolidatedAccessoriesStatus(accStatuses.map(String));
    outRow['accessories status'] = resolvedAccStatus;
    outRow['Accessories Status'] = resolvedAccStatus;

    const accDates = streamMatchedDesign
      .map((d) => 
        findCellValue(d.data, 'accessories completion date') || 
        findCellValue(d.data, 'accessories date') || 
        findCellValue(d.data, 'Accessories Completion Date')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    let latestAccDate: string | null = null;
    for (const ad of accDates) {
      const fDate = formatDateString(ad);
      if (fDate && (!latestAccDate || fDate > latestAccDate)) {
        latestAccDate = fDate;
      }
    }
    outRow['accessories date'] = latestAccDate;
    outRow['Accessories Date'] = latestAccDate;

    let totalQuantityOrdered = 0;
    let hasQuantity = false;
    for (const d of streamMatchedDesign) {
      const rawQ =
        findCellValue(d.data, 'Total Quantity Ordered m2') ??
        findCellValue(d.data, 'Total Quantity Ordered (m2)') ??
        findCellValue(d.data, 'Total Quantity Ordered') ??
        findCellValue(d.data, 'Total Quantity') ??
        findCellValue(d.data, 'Quantity Ordered');
      const num = parseNumeric(rawQ);
      if (!isNaN(num) && num > 0) {
        totalQuantityOrdered += num;
        hasQuantity = true;
      }
    }
    const finalQuantityAN = hasQuantity ? totalQuantityOrdered : null;
    outRow['Total Quantity Ordered m2'] = finalQuantityAN;
    outRow['Total Quantity Ordered (m2)'] = finalQuantityAN;
    outRow['Total Quantity Ordered'] = finalQuantityAN;
    outRow['processed qty'] = finalQuantityAN;

    // ------------------------------------------------------------------------
    // SHELLPLAN MAPPINGS (same project & stream, then the BD row's fill colour block)
    // ------------------------------------------------------------------------
    const shellplanCandidates = shellplanRows.filter((spRow) => {
      const spProjNo = cleanStr(findCellValue(spRow.data, 'Project No') || findCellValue(spRow.data, 'Project No.') || spRow.rawCells?.[0]);
      const spProjName = cleanStr(findCellValue(spRow.data, 'Project Name') || findCellValue(spRow.data, 'Customer & Project Name') || spRow.rawCells?.[1]);

      let spStream: string | null = null;
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(spRow.data, sh);
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          spStream = normalizeStream(v);
          break;
        }
      }

      const idMatches =
        codeMatches(spProjNo) ||
        (projectName && spProjName && (spProjName === projectName || spProjName.includes(projectName) || projectName.includes(spProjName))) ||
        (shortName && spProjName && spProjName.includes(shortName));

      if (!idMatches) return false;

      // No Stream column: the stream of the row's building in the Design file
      if (!spStream) {
        const building = cleanStr(findCellValue(spRow.data, 'Building Name'));
        spStream = streamOfBuilding[`${spProjNo}|${building}`] ?? null;
      }

      if (spStream && spStream !== bdStream) {
        return false;
      }

      return true;
    });
    // Shell Plan marks its blocks by fill colour only, like Design
    const streamMatchedShellplan = closestFillGroup(shellplanCandidates, bdFillColor);

    const spStatuses = streamMatchedShellplan
      .map((c) =>
        findCellValue(c.data, 'Shell Plan Status') ||
        findCellValue(c.data, 'shellplan status') ||
        findCellValue(c.data, 'Shell Plan Status - Pending Consultant Drawings') ||
        findCellValue(c.data, 'Status')
      )
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const resolvedSpStatus = resolveConsolidatedShellplanStatus(spStatuses.map(String));
    outRow['shellplan status'] = resolvedSpStatus;
    outRow['Shell Plan Status'] = resolvedSpStatus;
    outRow['Shell Plan Status - Pending Consultant Drawings'] = resolvedSpStatus;

    const spRevisions = streamMatchedShellplan
      .map((c) => findCellValue(c.data, 'Latest Revision') || findCellValue(c.data, 'latest revision version'))
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    const latestRevision = spRevisions.length > 0 ? spRevisions[spRevisions.length - 1] : null;
    outRow['latest revision version'] = latestRevision;
    outRow['Latest Revision'] = latestRevision;

    const spSubmissionDates = streamMatchedShellplan
      .map((c) => findCellValue(c.data, 'Latest Submission Date') || findCellValue(c.data, 'latest revision date'))
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    let latestSubmissionDateStr: string | null = null;
    for (const sv of spSubmissionDates) {
      const fDate = formatDateString(sv);
      if (fDate && (!latestSubmissionDateStr || fDate > latestSubmissionDateStr)) {
        latestSubmissionDateStr = fDate;
      }
    }
    outRow['latest revision date'] = latestSubmissionDateStr;
    outRow['Latest Submission Date'] = latestSubmissionDateStr;

    const spApprovedDates = streamMatchedShellplan
      .map((c) => findCellValue(c.data, 'Shell Plan Approved Date') || findCellValue(c.data, 'shellplan approval date') || findCellValue(c.data, 'Approved Date'))
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== '');
    let latestApprovedDateStr: string | null = null;
    for (const sv of spApprovedDates) {
      const fDate = formatDateString(sv);
      if (fDate && (!latestApprovedDateStr || fDate > latestApprovedDateStr)) {
        latestApprovedDateStr = fDate;
      }
    }
    outRow['shellplan approval date'] = latestApprovedDateStr;
    outRow['Shell Plan Approved Date'] = latestApprovedDateStr;

    // Approval history (shown on the Shell Plan & Design page): every Approved / Reapprove, with
    // its revision and date, seen for this stream is kept from one MR11 to the next, with the
    // date it was first seen
    const historyKey = `${projectNo || shortName}|${bdStream}|${bdFillColor}`;
    const historyGroup = (approvalHistory[historyKey] ||= {
      projectNo: null,
      shortName: null,
      projectName: null,
      stream: bdStream,
      fillColor: bdFillColor,
      entries: [],
    });
    historyGroup.projectNo = outRow['Project No'] != null ? String(outRow['Project No']) : historyGroup.projectNo;
    historyGroup.shortName = outRow['Short Name'] ?? historyGroup.shortName;
    historyGroup.projectName = outRow['Customer & Project Name'] ?? historyGroup.projectName;
    const history = historyGroup.entries;
    for (const sp of streamMatchedShellplan) {
      const status = String(findCellValue(sp.data, 'Shell Plan Status') || findCellValue(sp.data, 'shellplan status') || '').trim();
      if (!/approv/i.test(status)) continue;
      const rawRevision = findCellValue(sp.data, 'Latest Revision') ?? findCellValue(sp.data, 'latest revision version');
      let revision = isCellFilled(rawRevision) ? String(rawRevision).trim() : null;
      // A revision number typed into a date-formatted cell reads as a date in early 1900
      // (2 -> 1900-01-01); turn it back into the number
      if (revision && /^1900-\d{2}-\d{2}/.test(revision)) {
        revision = String(
          Math.round(
            (Date.UTC(1900, Number(revision.slice(5, 7)) - 1, Number(revision.slice(8, 10))) - Date.UTC(1899, 11, 30)) / 86400000
          )
        );
      }
      const approvedDate = formatDateString(findCellValue(sp.data, 'Shell Plan Approved Date') || findCellValue(sp.data, 'Approved Date'));
      const submittedDate = formatDateString(findCellValue(sp.data, 'Latest Submission Date'));
      const key = `${status.toLowerCase()}|${revision ?? ''}|${approvedDate ?? ''}`;
      if (!history.some((h) => h.key === key)) {
        history.push({ key, status, revision, approvedDate, submittedDate, recordedOn: uploadDateStr });
      }
    }

    // ------------------------------------------------------------------------
    // PLANNING MAPPINGS (Color & Fill Aware)
    // ------------------------------------------------------------------------
    // Same project: the short name decides when both sides have one (a wrong project number in a
    // department file must not pull in another project's rows); otherwise the project number
    const sameProject = (otherNo: string, otherShort: string): boolean =>
      shortName && otherShort ? otherShort === shortName : Boolean(projectNo && otherNo === projectNo);

    // Total Processed = the Planning file's "Cumulative Processed (Project)" summed over the
    // blocks for this BD row: same project & stream, and the same font and fill colour. Planning
    // uses its own shades (e.g. #FF0000 for BD's #C00000), so the closest colour counts as the same.
    const planningCandidates = planningRows.filter((p) => {
      const pNo = cleanStr(findCellValue(p.data, 'Project No') || findCellValue(p.data, 'Project No.') || findCellValue(p.data, 'Project No. (from design column A)'));
      const pShort = cleanStr(findCellValue(p.data, 'Short Name') || findCellValue(p.data, 'Project Shortname') || findCellValue(p.data, 'Project Shortname (from bd column C)'));
      if (!sameProject(pNo, pShort)) return false;
      let pStream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(p.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          pStream = normalizeStream(v);
          break;
        }
      }
      return pStream === bdStream;
    });
    const planningMatches = closestColourGroup(planningCandidates, bdFontColor, bdFillColor);

    let processedTotal: number | null = null;
    for (const p of planningMatches) {
      const key = Object.keys(p.data).find((k) => /^cumulative processed/i.test(k.trim()));
      // A merged cell's value is copied to every row it covers; count it once
      if (!key || p.mergedCopyHeaders?.includes(key) || !isCellFilled(p.data[key])) continue;
      processedTotal = (processedTotal ?? 0) + parseNumeric(p.data[key]);
    }
    outRow['Total Processed'] = processedTotal;
    outRow['Total Processed (m2)'] = processedTotal;

    // Processed Date = the upload date on which Total Processed last changed: a new value takes
    // today's date, an unchanged value keeps the date from the previous MR11
    const previous = previousRow;
    const previousTotal = previous && isCellFilled(previous['Total Processed']) ? parseNumeric(previous['Total Processed']) : null;
    let resolvedProcessedDate: string | null = null;
    if (processedTotal !== null) {
      resolvedProcessedDate =
        previousTotal !== null && previousTotal === processedTotal && previous?.['Processed Date']
          ? String(previous['Processed Date'])
          : uploadDateStr;
    }

    outRow['Processed Date'] = resolvedProcessedDate;
    outRow['Closing Date'] = resolvedProcessedDate;

    // ------------------------------------------------------------------------
    // PRODUCTION MAPPINGS (Color & Fill Aware)
    // ------------------------------------------------------------------------
    // The Production blocks for this BD row: same project & stream, and the closest font and
    // fill colour (Production uses its own shades, e.g. #FF9933 for BD's #FF9900)
    const productionCandidates = productionRows.filter((p) => {
      const pShort = cleanStr(findCellValue(p.data, 'Short Name') || findCellValue(p.data, 'Project Shortname') || findCellValue(p.data, 'Project Shortname (from planning column B)'));
      const pNo = cleanStr(findCellValue(p.data, 'Project No') || findCellValue(p.data, 'Project No.'));
      if (!sameProject(pNo, pShort)) return false;
      let pStream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(p.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          pStream = normalizeStream(v);
          break;
        }
      }
      return pStream === bdStream;
    });
    const productionMatches = closestColourGroup(productionCandidates, bdFontColor, bdFillColor);

    // Total Produced = "Cumulative Produced (Project)" summed over those blocks (each merged cell once)
    let producedTotal: number | null = null;
    for (const p of productionMatches) {
      const key = Object.keys(p.data).find((k) => /^cumulative produced/i.test(k.trim()));
      if (!key || p.mergedCopyHeaders?.includes(key) || !isCellFilled(p.data[key])) continue;
      producedTotal = (producedTotal ?? 0) + parseNumeric(p.data[key]);
    }
    outRow['Total Produced'] = producedTotal;
    outRow['Total Produced Quantity'] = producedTotal;
    outRow['produced qty'] = producedTotal;

    // Produced Date = the latest day with output: every Production column whose header is a
    // date (the daily columns, any month), across all of those blocks' rows
    let latestFilledDate: string | null = null;
    const dayColumns = Object.entries(productionHeaders)
      .map(([c, h]) => ({ c: Number(c), date: /^\d{4}-\d{2}-\d{2}/.test(String(h).trim()) ? formatDateString(h) : null }))
      .filter((d): d is { c: number; date: string } => Boolean(d.date));
    for (const pRow of productionMatches) {
      for (const { c, date } of dayColumns) {
        const cellVal = pRow.rawCells?.[c];
        const targetVal = cellVal !== undefined ? cellVal : pRow.data[productionHeaders[c]];
        if (isCellFilled(targetVal) && (!latestFilledDate || date > latestFilledDate)) {
          latestFilledDate = date;
        }
      }
    }

    outRow['Produced Date'] = latestFilledDate;

    // Blue-font BD rows only go as far as Planning: Production and Dispatch have no rows for
    // them, so their Production and Dispatch columns show "-"
    if (isBlueColor(bdFontColor)) {
      for (const key of Object.keys(outRow)) {
        if (PRODUCTION_DISPATCH_COLUMN.test(key.trim())) outRow[key] = '-';
      }
      for (const key of Object.keys(cellColors)) {
        if (PRODUCTION_DISPATCH_COLUMN.test(key.trim())) delete cellColors[key];
      }
      outRow['_atdColor'] = null;
    }

    outRow['_fontColor'] = bdFontColor;
    outRow['_fillColor'] = bdFillColor;

    return outRow;
  });

  // --------------------------------------------------------------------------
  // Formwork Design Status for a project (per fill colour block): Fully Complete when every
  // stream's design is completed, Partially Complete when at least one stream is, Ongoing when
  // any is under way, otherwise To Start
  const designStatesByProject = new Map<string, Map<string, string>>();
  const projectKeyOf = (r: Record<string, any>) =>
    `${splitProjectCode(r['Project No']).project || cleanStr(r['Short Name'])}|${normalizeFillColor(r['_fillColor'])}`;
  for (const r of derivedMr11Rows) {
    const streams = designStatesByProject.get(projectKeyOf(r)) || new Map<string, string>();
    streams.set(normalizeStream(r['Stream']), r['_designState'] || 'none');
    designStatesByProject.set(projectKeyOf(r), streams);
  }
  for (const r of derivedMr11Rows) {
    const states = [...(designStatesByProject.get(projectKeyOf(r))?.values() || [])];
    const completed = states.filter((s) => s === 'completed').length;
    const status =
      states.length > 0 && completed === states.length
        ? 'Fully Complete'
        : completed > 0
        ? 'Partially Complete'
        : states.includes('ongoing')
        ? 'Ongoing'
        : 'To Start';
    r['Formwork Design Status'] = status;
    r['design status'] = status;
  }

  // 5. SORTING: PROJECT -> STREAM -> NO FILL BEFORE FILLED -> FILL COLOR -> FONT COLOR (BLACK FIRST)
  // --------------------------------------------------------------------------
  derivedMr11Rows.sort((a, b) => {
    const projA = getProjectIdentifier(a);
    const projB = getProjectIdentifier(b);
    if (projA !== projB) {
      return projA.localeCompare(projB);
    }

    const streamA = parseFloat(String(a['Stream'] || '1').replace(/[^0-9.]/g, '')) || 1;
    const streamB = parseFloat(String(b['Stream'] || '1').replace(/[^0-9.]/g, '')) || 1;
    if (streamA !== streamB) {
      return streamA - streamB;
    }

    // Rows without a fill colour come first so a stream's unfilled rows sit together and can merge
    const filledA = normalizeFillColor(a['_fillColor']) !== '';
    const filledB = normalizeFillColor(b['_fillColor']) !== '';
    if (filledA !== filledB) return filledA ? 1 : -1;

    // Rows with the same fill sit together so they can merge
    const fillA = normalizeFillColor(a['_fillColor']);
    const fillB = normalizeFillColor(b['_fillColor']);
    if (fillA !== fillB) return fillA.localeCompare(fillB);

    const colorA = normalizeColor(a['_fontColor']);
    const colorB = normalizeColor(b['_fontColor']);

    const isBlackA = colorA === '#000000';
    const isBlackB = colorB === '#000000';

    if (isBlackA && !isBlackB) return -1;
    if (!isBlackA && isBlackB) return 1;
    return colorA.localeCompare(colorB);
  });

  // --------------------------------------------------------------------------
  // 6. ATTACH STREAM MERGE METADATA (ONLY MERGES FOR SHELLPLAN & DESIGN)
  // Rows of the same Project & Stream merge when they have the same fill colour (or none),
  // whatever their font colour; a different fill colour always splits (fill takes priority).
  // --------------------------------------------------------------------------
  const fillOf = (row: Record<string, any>) => normalizeFillColor(row['_fillColor']);
  for (let i = 0; i < derivedMr11Rows.length; ) {
    const curProj = getProjectIdentifier(derivedMr11Rows[i]);
    const curStream = normalizeStream(derivedMr11Rows[i]['Stream']);
    let span = 1;

    // Expand span across the rows sharing the exact same Project, Stream and fill colour
    while (
      i + span < derivedMr11Rows.length &&
      fillOf(derivedMr11Rows[i + span]) === fillOf(derivedMr11Rows[i]) &&
      getProjectIdentifier(derivedMr11Rows[i + span]) === curProj &&
      normalizeStream(derivedMr11Rows[i + span]['Stream']) === curStream
    ) {
      span++;
    }

    // Lead row flag for ShellPlan & Design merged display
    derivedMr11Rows[i]['_isStreamLead'] = true;
    derivedMr11Rows[i]['_streamSpan'] = span;

    // Follower rows receive _streamSpan = 0 ONLY for ShellPlan & Design rendering
    for (let j = 1; j < span; j++) {
      derivedMr11Rows[i + j]['_isStreamLead'] = false;
      derivedMr11Rows[i + j]['_streamSpan'] = 0;

      // Duplicate lead values so non-merged table views stay consistent
      derivedMr11Rows[i + j]['Shell Plan Status - Pending Consultant Drawings'] =
        derivedMr11Rows[i]['Shell Plan Status - Pending Consultant Drawings'];
      derivedMr11Rows[i + j]['shellplan status'] =
        derivedMr11Rows[i]['shellplan status'];
      derivedMr11Rows[i + j]['Shell Plan Approved Date'] =
        derivedMr11Rows[i]['Shell Plan Approved Date'];
      derivedMr11Rows[i + j]['Formwork Design Status'] =
        derivedMr11Rows[i]['Formwork Design Status'];
      derivedMr11Rows[i + j]['Actual Formwork Order Completion Date'] =
        derivedMr11Rows[i]['Actual Formwork Order Completion Date'];
      derivedMr11Rows[i + j]['_designDateParts'] = derivedMr11Rows[i]['_designDateParts'];
      derivedMr11Rows[i + j]['Total Quantity Ordered m2'] =
        derivedMr11Rows[i]['Total Quantity Ordered m2'];
    }

    i += span;
  }

  const run = await prisma.mr11Run.create({
    data: {
      status: 'READY' as any,
      sourceSnapshot: {
        ...sourceSnapshot,
        dispatchTracker: newDispatchTracker,
        shellplanApprovalHistory: approvalHistory,
      },
      recordCount: derivedMr11Rows.length,
      records: derivedMr11Rows as any,
    },
  });

  // Save to the shared database (works with either Mr11Run table layout)
  if (persist) {
    try {
      await saveMr11RunToDb({
        id: run.id,
        sourceSnapshot: {
          ...sourceSnapshot,
          dispatchTracker: newDispatchTracker,
          shellplanApprovalHistory: approvalHistory,
          engineHistory: exportEngineHistory(),
        },
        records: derivedMr11Rows,
      });
    } catch (mr11DbErr: any) {
      console.error('[MR11 ENGINE] Could not save MR11 to the database:', mr11DbErr?.message);
    }
  }

  return run.id;
}