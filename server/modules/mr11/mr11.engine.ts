import { PrismaClient, RoleCode } from '@prisma/client';
import { MR11_ORDERED_COLUMNS, MR11_SOURCE_KEY_MAP, ORDERED_HEADER_LIST } from '../../config/mr11.config';
import { saveMr11RunToDb } from '../../db/supabase';
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
}

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

  const rows = sortedRowKeys.map((rKey) => ({
    data: rowsMap[rKey],
    fontColor: normalizeColor(rowStyleMap[rKey]?.fontColor),
    fillColor: normalizeFillColor(rowStyleMap[rKey]?.fillColor),
    rawCells: rawCellsMap[rKey],
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
 *   LME Adjusted = Fixed -> LME rate (0 if blank), Freeze -> "Check",
 *                  Variable -> LME rate (or "Check" if blank)
 *   Final Selling Price = Selling Price + Props + Aluminium + Freight
 *                         + LME Adjusted when it is a number (a "Check" counts as 0)
 */
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
  if (lmeType === 'fixed') computedAdjusted = rateIsNumber ? Number(lmeRate) : 0;
  else if (lmeType === 'freeze') computedAdjusted = 'Check';
  else if (lmeType === 'variable') computedAdjusted = rateIsNumber ? Number(lmeRate) : 'Check';

  // Strict lookups: a loose prefix match would take the "LME" column for "LME Adjusted"
  const col = (prefix: string) => bdData[keyWhere((k) => k.startsWith(prefix))!];

  const bdAdjusted = col('lme adjusted');
  const lmeAdjusted = isUsableValue(bdAdjusted) ? bdAdjusted : computedAdjusted;

  const bdFinal = col('final selling price');
  if (isUsableValue(bdFinal)) return { lmeAdjusted, finalSellingPrice: bdFinal };

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
  const activeDepartments = await prisma.department.findMany({
    include: { activeVersion: true },
  });

  const sourceSnapshot: Record<string, any> = {};
  const datasetMap: Partial<Record<RoleCode, ExtractedRow[]>> = {};
  let productionHeaders: Record<number, string> = {};
  let dispatchHeaders: Record<number, string> = {};
  let financeMonthColumns: { header: string; label: string }[] = [];
  let detectedProdSeries = 0;

  for (const dept of activeDepartments) {
    if (dept.activeVersion?.parsedWorkbook) {
      sourceSnapshot[dept.code] = dept.activeVersion.id;
      const rawWb = dept.activeVersion.parsedWorkbook;

      const sheets: FortuneSheet[] = Array.isArray(rawWb)
        ? (rawWb as unknown as FortuneSheet[])
        : (((rawWb as any)?.sheets as unknown as FortuneSheet[]) || []);

      if (sheets.length > 0) {
        const { rows, detectedSeries, headers } = sheetToRecordsWithStyles(sheets[0]);
        datasetMap[dept.code as RoleCode] = rows;
        if (dept.code === RoleCode.PRODUCTION) {
          productionHeaders = headers;
          if (detectedSeries > 0) {
            detectedProdSeries = detectedSeries;
          }
        }
        if (dept.code === RoleCode.DISPATCH) {
          dispatchHeaders = headers;
        }
        if (dept.code === RoleCode.FINANCE) {
          financeMonthColumns = buildFinanceMonthColumns(headers);
        }
      }
    }
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

  for (const row of planningRows) {
    const pNo = cleanStr(findCellValue(row.data, 'Project No') || findCellValue(row.data, 'Project No.') || findCellValue(row.data, 'Project No. (from design column A)'));
    const pShort = cleanStr(findCellValue(row.data, 'Short Name') || findCellValue(row.data, 'Project Shortname') || findCellValue(row.data, 'Project Shortname (from bd column C)'));
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

    const rawProduced =
      row.rawCells?.[16] ??
      findCellValue(row.data, '__COLUMN_Q__') ??
      findCellValue(row.data, 'Total Produced') ??
      findCellValue(row.data, 'Total Produced Quantity') ??
      findCellValue(row.data, 'Produced Quantity') ??
      findCellValue(row.data, 'Column Q') ??
      findCellValue(row.data, 'Produced (m2)');

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

  const previousRun = await prisma.mr11Run.findFirst({
    where: {
      status: 'READY',
      recordCount: { gt: 0 },
    },
    orderBy: { generatedAt: 'desc' },
  });

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

    const bdFontColor = normalizeColor(bdRowItem.fontColor);
    const bdFillColor = normalizeFillColor(bdRowItem.fillColor);
    const outRow: Record<string, any> = {};
    const cellColors: Record<string, string> = {};

    // 1. Populate defined BD columns directly from BD
    for (const mapping of MR11_ORDERED_COLUMNS) {
      if (mapping.sourceDept === RoleCode.BD) {
        let value = mapping.exact
          ? bdData[mapping.sourceColumn] ?? null
          : findCellValue(bdData, mapping.sourceColumn);
        for (const alias of mapping.aliases || []) {
          if (value !== null && value !== undefined && value !== '') break;
          value = findCellValue(bdData, alias);
        }
        outRow[mapping.target] = value;
      }
    }
    const lmePricing = resolveLmePricing(bdData);
    outRow['LME Adjusted (USD)'] = lmePricing.lmeAdjusted;
    outRow['Final Selling Price (USD)'] = lmePricing.finalSellingPrice;

    // Best-matching row from a department: project id must match, then stream, font and fill colour add weight
    const findBestDeptRow = (dept: RoleCode): Record<string, any> | null => {
      const deptDataset = datasetMap[dept] || [];
      const possibleKeyNames = MR11_SOURCE_KEY_MAP[dept] || [];

      let bestCandidate: Record<string, any> | null = null;
      let highestScore = -1;

      for (const candidate of deptDataset) {
        const cData = candidate.data;
        let idMatched = false;
        for (const keyName of possibleKeyNames) {
          const raw = cleanStr(findCellValue(cData, keyName));
          if (raw && (raw === projectNo || raw === shortName || (shortName && raw.includes(shortName)))) {
            idMatched = true;
            break;
          }
        }
        if (!idMatched) continue;

        let score = 1;
        let cStream = '1';
        for (const sh of STREAM_HEADER_CANDIDATES) {
          const v = findCellValue(cData, sh);
          if (v !== null && v !== undefined && v !== '') {
            cStream = normalizeStream(v);
            break;
          }
        }
        if (cStream === bdStream) score += 4;

        const cFont = normalizeColor(candidate.fontColor);
        if (cFont === bdFontColor) score += 8;

        const cFill = normalizeFillColor(candidate.fillColor);
        if (bdFillColor && cFill && cFill === bdFillColor) score += 10;

        if (score > highestScore) {
          highestScore = score;
          bestCandidate = cData;
        }
      }
      return bestCandidate;
    };

    // 2. Generic Department Fallbacks
    for (const mapping of MR11_ORDERED_COLUMNS) {
      if (
        mapping.sourceDept !== RoleCode.BD &&
        mapping.sourceDept !== RoleCode.DESIGN &&
        mapping.sourceDept !== RoleCode.SHELLPLAN &&
        mapping.sourceDept !== RoleCode.PLANNING &&
        mapping.sourceDept !== RoleCode.PRODUCTION &&
        mapping.sourceDept !== RoleCode.DISPATCH
      ) {
        const bestCandidate = findBestDeptRow(mapping.sourceDept);
        outRow[mapping.target] = bestCandidate ? findCellValue(bestCandidate, mapping.sourceColumn) : null;
      }
    }

    // ------------------------------------------------------------------------
    // DISPATCH MAPPINGS: 5-POINT COMPOSITE KEY MATCHING
    // ------------------------------------------------------------------------
    const matchedDispatchRows = dispatchRows.filter((dRow) => {
      const dShort = cleanStr(
        findCellValue(dRow.data, 'Short Name') ||
        findCellValue(dRow.data, 'Project Shortname') ||
        findCellValue(dRow.data, 'Project Shortname (from bd column C)') ||
        findCellValue(dRow.data, 'Project Short Code') ||
        findCellValue(dRow.data, 'Short Code') ||
        dRow.rawCells?.[1] ||
        dRow.rawCells?.[2]
      );

      const dName = cleanStr(
        findCellValue(dRow.data, 'Customer & Project Name') ||
        findCellValue(dRow.data, 'Project Name') ||
        findCellValue(dRow.data, 'Project Name (from bd column A)') ||
        dRow.rawCells?.[0] ||
        dRow.rawCells?.[1]
      );

      const dNo = cleanStr(
        findCellValue(dRow.data, 'Project No') ||
        findCellValue(dRow.data, 'Project No.') ||
        dRow.rawCells?.[0]
      );

      const shortMatched =
        (shortName && dShort && (dShort === shortName || dShort.includes(shortName) || shortName.includes(dShort))) ||
        (projectNo && dNo && (dNo === projectNo || dNo.includes(projectNo) || projectNo.includes(dNo)));

      if (!shortMatched) return false;

      if (projectName && dName && !(dName === projectName || dName.includes(projectName) || projectName.includes(dName))) {
        return false;
      }

      let dStream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(dRow.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          dStream = normalizeStream(v);
          break;
        }
      }
      if (dStream !== bdStream) return false;

      const dFontColor = normalizeColor(dRow.fontColor);
      if (dFontColor !== bdFontColor) return false;

      const dFillColor = normalizeFillColor(dRow.fillColor);
      if (bdFillColor !== dFillColor) return false;

      return true;
    });

    let totalFormworkSailed = 0;
    let hasSailedValue = false;
    for (const dRow of matchedDispatchRows) {
      const rawSailed =
        findCellValue(dRow.data, 'Formwork Quantity Sailed (m2)') ??
        findCellValue(dRow.data, 'Formwork Quantity Sailed m2') ??
        findCellValue(dRow.data, 'Formwork Quantity Sailed') ??
        findCellValue(dRow.data, 'Quantity Sailed (m2)') ??
        findCellValue(dRow.data, 'Quantity Sailed') ??
        findCellValue(dRow.data, 'Total Sailed (m2)') ??
        findCellValue(dRow.data, 'Total Sailed');

      const num = parseNumeric(rawSailed);
      if (!isNaN(num) && num > 0) {
        totalFormworkSailed += num;
        hasSailedValue = true;
      }
    }

    const finalFormworkSailed = hasSailedValue ? totalFormworkSailed : null;
    outRow['Formwork Quantity Sailed (m2)'] = finalFormworkSailed;
    outRow['Formwork Quantity Sailed m2'] = finalFormworkSailed;
    outRow['Formwork Quantity Sailed'] = finalFormworkSailed;

    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (
          cleanH === 'formwork quantity sailed (m2)' ||
          cleanH === 'formwork quantity sailed m2' ||
          cleanH === 'formwork quantity sailed' ||
          cleanH === 'quantity sailed (m2)' ||
          (cleanH.includes('formwork') && cleanH.includes('sailed'))
        ) {
          outRow[h] = finalFormworkSailed;
        }
      });
    }

    let matchedDispatchRowForK: ExtractedRow | null = null;
    let directColumnKValue = 0;

    for (const dRow of matchedDispatchRows) {
      const val = parseNumeric(
        dRow.rawCells?.[10] ??
        findCellValue(dRow.data, '__COLUMN_K__') ??
        findCellValue(dRow.data, 'Column K') ??
        findCellValue(dRow.data, 'Total Dispatch') ??
        findCellValue(dRow.data, 'Total Dispatched') ??
        findCellValue(dRow.data, 'Total Dispatched Quantity') ??
        findCellValue(dRow.data, 'Dispatched Quantity') ??
        findCellValue(dRow.data, 'Total Dispatch (m2)') ??
        findCellValue(dRow.data, 'Total Dispatched (m2)')
      );
      if (val > directColumnKValue) {
        directColumnKValue = val;
        matchedDispatchRowForK = dRow;
      }
    }

    if (!matchedDispatchRowForK && matchedDispatchRows.length > 0) {
      matchedDispatchRowForK = matchedDispatchRows[matchedDispatchRows.length - 1];
    }

    const finalTotalDispatch = directColumnKValue > 0 ? directColumnKValue : null;
    outRow['Total Dispatch'] = finalTotalDispatch;
    outRow['Total Dispatched'] = finalTotalDispatch;
    outRow['Total Dispatched Quantity'] = finalTotalDispatch;
    outRow['Total Dispatch (m2)'] = finalTotalDispatch;
    outRow['Total Dispatched (m2)'] = finalTotalDispatch;
    outRow['Total Dispatched Quantity m2'] = finalTotalDispatch;

    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (
          cleanH === 'total dispatch' ||
          cleanH === 'total dispatched' ||
          cleanH === 'total dispatched quantity' ||
          cleanH === 'total dispatch (m2)' ||
          cleanH === 'total dispatched (m2)' ||
          cleanH.includes('total dispatch') ||
          cleanH.includes('total dispatched')
        ) {
          outRow[h] = finalTotalDispatch;
        }
      });
    }

    const dispatchCompositeKey = `${shortName || projectNo}__${projectName}__${bdStream}__${bdFontColor}__${bdFillColor}`;
    const previousEntry = prevDispatchHistory[dispatchCompositeKey];
    let resolvedDispatchedDate: string | null = null;

    if (directColumnKValue > 0) {
      if (!previousEntry) {
        resolvedDispatchedDate = todayStr;
        newDispatchTracker[dispatchCompositeKey] = { quantity: directColumnKValue, date: todayStr };
      } else if (previousEntry.quantity !== directColumnKValue) {
        resolvedDispatchedDate = todayStr;
        newDispatchTracker[dispatchCompositeKey] = { quantity: directColumnKValue, date: todayStr };
      } else {
        resolvedDispatchedDate = previousEntry.date || todayStr;
        newDispatchTracker[dispatchCompositeKey] = { quantity: directColumnKValue, date: resolvedDispatchedDate };
      }
    } else {
      resolvedDispatchedDate = null;
    }

    outRow['Dispatched Date'] = resolvedDispatchedDate;
    outRow['Dispatch Date'] = resolvedDispatchedDate;
    outRow['Actual Dispatched Date'] = resolvedDispatchedDate;
    outRow['Actual Dispatch Date'] = resolvedDispatchedDate;
    outRow['Date Dispatched'] = resolvedDispatchedDate;

    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (
          cleanH === 'dispatched date' ||
          cleanH === 'dispatch date' ||
          cleanH === 'actual dispatched date' ||
          cleanH === 'actual dispatch date' ||
          cleanH === 'date dispatched' ||
          (cleanH.includes('dispatch') && cleanH.includes('date'))
        ) {
          outRow[h] = resolvedDispatchedDate;
        }
      });
    }

    let latestDateW: Date | null = null;
    let latestDateWStr: string | null = null;
    let latestDatePV: Date | null = null;
    let latestDatePVStr: string | null = null;

    for (const dRow of matchedDispatchRows) {
      const candidateWValues: any[] = [
        dRow.rawCells?.[22],
        findCellValue(dRow.data, '__COLUMN_W__'),
        dispatchHeaders[22] ? dRow.data[dispatchHeaders[22]] : undefined,
        findCellValue(dRow.data, 'Column W'),
        findCellValue(dRow.data, 'ATD'),
        findCellValue(dRow.data, 'ATD Date'),
        findCellValue(dRow.data, 'Actual Time of Departure'),
      ];

      for (const valW of candidateWValues) {
        if (valW !== undefined && valW !== null && String(valW).trim() !== '') {
          const d = parseFlexibleDate(valW);
          if (d) {
            if (!latestDateW || d.getTime() > latestDateW.getTime()) {
              latestDateW = d;
              latestDateWStr = formatDateString(d);
            }
          } else {
            const s = String(valW).trim();
            if (s && s !== '-' && !latestDateWStr) {
              latestDateWStr = s;
            }
          }
        }
      }

      for (let c = 15; c <= 21; c++) {
        const candidatePVValues: any[] = [
          dRow.rawCells?.[c],
          dispatchHeaders[c] ? dRow.data[dispatchHeaders[c]] : undefined,
        ];

        for (const valPV of candidatePVValues) {
          if (valPV !== undefined && valPV !== null && String(valPV).trim() !== '') {
            const d = parseFlexibleDate(valPV);
            if (d) {
              if (!latestDatePV || d.getTime() > latestDatePV.getTime()) {
                latestDatePV = d;
                latestDatePVStr = formatDateString(d);
              }
            } else {
              const s = String(valPV).trim();
              if (s && s !== '-' && !latestDatePVStr) {
                latestDatePVStr = s;
              }
            }
          }
        }
      }
    }

    let finalAtdDate: string | null = null;
    let atdColor: string = '#FFFFFF';

    if (latestDateWStr) {
      finalAtdDate = latestDateWStr;
      atdColor = '#FFFFFF';
    } else if (latestDatePVStr) {
      finalAtdDate = latestDatePVStr;
      atdColor = '#FFFF00';
    }

    outRow['ATD'] = finalAtdDate;
    outRow['ATD Date'] = finalAtdDate;
    outRow['Actual Time of Departure'] = finalAtdDate;
    outRow['_atdColor'] = atdColor;

    if (Array.isArray(ORDERED_HEADER_LIST)) {
      ORDERED_HEADER_LIST.forEach((h) => {
        const cleanH = h.toLowerCase().trim();
        if (
          cleanH === 'atd' ||
          cleanH === 'atd date' ||
          cleanH === 'actual time of departure' ||
          cleanH === 'actual departure date' ||
          cleanH.includes('atd')
        ) {
          outRow[h] = finalAtdDate;
          cellColors[h] = atdColor;
        }
      });
    }

    cellColors['ATD'] = atdColor;
    cellColors['ATD Date'] = atdColor;
    cellColors['Actual Time of Departure'] = atdColor;
    outRow['_cellColors'] = cellColors;

    // Monthly breakdown (from Finance ACTUAL / F'CAST month columns)
    const MONTH_COLUMNS_26 = MONTH_LABELS.map((m) => `${m}-26`);
    const MONTH_COLUMNS_27 = MONTH_LABELS.map((m) => `${m}-27`);

    const financeRow = findBestDeptRow(RoleCode.FINANCE);
    const monthValues: Record<string, number> = {};
    if (financeRow) {
      for (const { header, label } of financeMonthColumns) {
        const v = parseNumeric(financeRow[header]);
        if (v > 0) monthValues[label] = (monthValues[label] || 0) + v;
      }
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
    // DESIGN MAPPINGS (Matched strictly by Stream)
    // ------------------------------------------------------------------------
    const streamMatchedDesign = designRows.filter((dRow) => {
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
        (projectNo && dProjNo && (dProjNo === projectNo || dProjNo.includes(projectNo) || projectNo.includes(dProjNo))) ||
        (projectName && dProjName && (dProjName === projectName || dProjName.includes(projectName) || projectName.includes(dProjName))) ||
        (shortName && dProjName && dProjName.includes(shortName));

      if (!idMatches) return false;

      if (dStream && dStream !== bdStream) {
        return false;
      }

      return true;
    });

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

    const designDates = streamMatchedDesign
      .map((d) =>
        findCellValue(d.data, 'Actual Formwork Order Completion Date') ||
        findCellValue(d.data, 'Actual Completion Date') ||
        findCellValue(d.data, 'estimated design completion date (should be date or tbc) ') ||
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
    outRow['Actual Formwork Order Completion Date'] = latestDesignDate;
    outRow['latest design date'] = latestDesignDate;

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
    // SHELLPLAN MAPPINGS (Matched strictly by Stream)
    // ------------------------------------------------------------------------
    const streamMatchedShellplan = shellplanRows.filter((spRow) => {
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
        (projectNo && spProjNo && (spProjNo === projectNo || spProjNo.includes(projectNo) || projectNo.includes(spProjNo))) ||
        (projectName && spProjName && (spProjName === projectName || spProjName.includes(projectName) || projectName.includes(spProjName))) ||
        (shortName && spProjName && spProjName.includes(shortName));

      if (!idMatches) return false;

      if (spStream && spStream !== bdStream) {
        return false;
      }

      return true;
    });

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

    // ------------------------------------------------------------------------
    // PLANNING MAPPINGS (Color & Fill Aware)
    // ------------------------------------------------------------------------
    const matchedPlanningSeries = allHistoricalPlanningSeries.filter((s: any) => {
      const pClean = cleanStr(s.projectNo);
      const sClean = cleanStr(s.projectShortname);
      const matchesId = pClean === projectNo || sClean === shortName || (shortName && sClean.includes(shortName));
      const matchesStream = s.stream === bdStream || s.stream === '1' || bdStream === '1';
      const sFont = normalizeColor(s.fontColor);
      return matchesId && matchesStream && sFont === bdFontColor;
    });

    if (matchedPlanningSeries.length > 0) {
      const sumProcessed = matchedPlanningSeries.reduce((acc: number, curr: any) => acc + (curr.totalProcessed || 0), 0);
      outRow['Total Processed'] = sumProcessed;
      outRow['Total Processed (m2)'] = sumProcessed;
    }

    const tracker = allQuantityTrackers.find(
      (t: any) =>
        (cleanStr(t.projectNo) === projectNo || (shortName && cleanStr(t.projectShortname) === shortName)) &&
        (t.stream === bdStream || t.stream === '1' || bdStream === '1') &&
        normalizeColor(t.fontColor) === bdFontColor
    );

    let matchedPlanningRow: ExtractedRow | null = null;
    let highestPlanScore = -1;

    for (const p of planningRows) {
      const pNo = cleanStr(findCellValue(p.data, 'Project No') || findCellValue(p.data, 'Project No.') || findCellValue(p.data, 'Project No. (from design column A)'));
      const pShort = cleanStr(findCellValue(p.data, 'Short Name') || findCellValue(p.data, 'Project Shortname') || findCellValue(p.data, 'Project Shortname (from bd column C)'));
      const idMatches = (projectNo && pNo === projectNo) || (shortName && pShort === shortName);
      if (!idMatches) continue;

      let score = 1;
      let pStream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(p.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          pStream = normalizeStream(v);
          break;
        }
      }
      if (pStream === bdStream) score += 4;

      const pColor = normalizeColor(p.fontColor);
      const pFill = normalizeFillColor(p.fillColor);
      if (pColor === bdFontColor) score += 8;
      if (bdFillColor && pFill && pFill === bdFillColor) score += 10;

      if (score > highestPlanScore) {
        highestPlanScore = score;
        matchedPlanningRow = p;
      }
    }

    const activeClosingDate = matchedPlanningRow
      ? findCellValue(matchedPlanningRow.data, 'Closing Date ') ||
        findCellValue(matchedPlanningRow.data, 'Closing Date') ||
        findCellValue(matchedPlanningRow.data, 'Processed Date')
      : null;

    const latestSeriesClosingDate = matchedPlanningSeries.length > 0
      ? matchedPlanningSeries[matchedPlanningSeries.length - 1].closingDate
      : null;

    const resolvedProcessedDate =
      activeClosingDate ||
      latestSeriesClosingDate ||
      (tracker ? tracker.lastChangedDate : null) ||
      todayStr;

    outRow['Processed Date'] = resolvedProcessedDate;
    outRow['Closing Date'] = resolvedProcessedDate;

    // ------------------------------------------------------------------------
    // PRODUCTION MAPPINGS (Color & Fill Aware)
    // ------------------------------------------------------------------------
    let matchedProdRow: ExtractedRow | null = null;
    let highestProdScore = -1;

    for (const pRow of productionRows) {
      const pShort = cleanStr(
        findCellValue(pRow.data, 'Short Name') ||
        findCellValue(pRow.data, 'Project Shortname') ||
        findCellValue(pRow.data, 'Project Shortname (from planning column B)') ||
        pRow.rawCells?.[1] ||
        pRow.rawCells?.[0] ||
        pRow.rawCells?.[2]
      );
      const pNo = cleanStr(
        findCellValue(pRow.data, 'Project No') ||
        findCellValue(pRow.data, 'Project No.') ||
        pRow.rawCells?.[0]
      );

      const idMatches =
        (shortName && pShort === shortName) ||
        (projectNo && pNo === projectNo) ||
        (shortName && pShort.includes(shortName)) ||
        (projectNo && pShort.includes(projectNo)) ||
        (projectName && pShort.includes(projectName));

      if (!idMatches) continue;

      let score = 1;
      let stream = '1';
      for (const sh of STREAM_HEADER_CANDIDATES) {
        const v = findCellValue(pRow.data, sh);
        if (v !== null && v !== undefined && v !== '') {
          stream = normalizeStream(v);
          break;
        }
      }
      if (stream === bdStream) score += 4;

      const pColor = normalizeColor(pRow.fontColor);
      const pFill = normalizeFillColor(pRow.fillColor);

      if (pColor === bdFontColor) score += 8;
      if (bdFillColor && pFill && pFill === bdFillColor) score += 10;

      if (score > highestProdScore) {
        highestProdScore = score;
        matchedProdRow = pRow;
      }
    }

    const directColumnQValue = matchedProdRow
      ? parseNumeric(
          matchedProdRow.rawCells?.[16] ??
          findCellValue(matchedProdRow.data, '__COLUMN_Q__') ??
          findCellValue(matchedProdRow.data, 'Total Produced') ??
          findCellValue(matchedProdRow.data, 'Total Produced Quantity') ??
          findCellValue(matchedProdRow.data, 'Produced Quantity') ??
          findCellValue(matchedProdRow.data, 'Column Q') ??
          findCellValue(matchedProdRow.data, 'Produced (m2)')
        )
      : 0;

    const finalColumnAQ = directColumnQValue > 0 ? directColumnQValue : null;
    outRow['Total Produced'] = finalColumnAQ;
    outRow['Total Produced Quantity'] = finalColumnAQ;
    outRow['produced qty'] = finalColumnAQ;

    let latestFilledDate: string | null = null;
    if (matchedProdRow) {
      const COL_R_INDEX = 17;
      const COL_AV_INDEX = 47;

      for (let c = COL_AV_INDEX; c >= COL_R_INDEX; c--) {
        const cellVal = matchedProdRow.rawCells?.[c];
        const headerName = productionHeaders[c];
        const valFromHeader = headerName ? matchedProdRow.data[headerName] : undefined;
        const targetVal = cellVal !== undefined ? cellVal : valFromHeader;

        if (isCellFilled(targetVal)) {
          if (headerName) {
            const formatted = formatDateString(headerName);
            if (formatted) {
              latestFilledDate = formatted;
              break;
            }
          }

          const cellAsDate = formatDateString(targetVal);
          if (cellAsDate) {
            latestFilledDate = cellAsDate;
            break;
          }

          if (headerName) {
            latestFilledDate = headerName;
            break;
          }
        }
      }

      if (!latestFilledDate) {
        const fallbackDate = findCellValue(matchedProdRow.data, 'Day/Date') || findCellValue(matchedProdRow.data, 'Date');
        latestFilledDate = formatDateString(fallbackDate);
      }
    }

    outRow['Produced Date'] = latestFilledDate;

    outRow['_fontColor'] = bdFontColor;
    outRow['_fillColor'] = bdFillColor;

    return outRow;
  });

  // --------------------------------------------------------------------------
  // 5. SORTING: PROJECT -> STREAM -> FONT COLOR (BLACK FIRST) -> ROW COLOR
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

    const colorA = normalizeColor(a['_fontColor']);
    const colorB = normalizeColor(b['_fontColor']);

    const isBlackA = colorA === '#000000';
    const isBlackB = colorB === '#000000';

    if (isBlackA && !isBlackB) return -1;
    if (!isBlackA && isBlackB) return 1;
    if (colorA !== colorB) return colorA.localeCompare(colorB);

    const fillA = normalizeFillColor(a['_fillColor']);
    const fillB = normalizeFillColor(b['_fillColor']);
    return fillA.localeCompare(fillB);
  });

  // --------------------------------------------------------------------------
  // 6. ATTACH STREAM MERGE METADATA (ONLY MERGES FOR SHELLPLAN & DESIGN)
  // --------------------------------------------------------------------------
  for (let i = 0; i < derivedMr11Rows.length; ) {
    const curProj = getProjectIdentifier(derivedMr11Rows[i]);
    const curStream = normalizeStream(derivedMr11Rows[i]['Stream']);
    let span = 1;

    // Expand span across all rows sharing the exact same Project & Stream
    while (
      i + span < derivedMr11Rows.length &&
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
      },
      recordCount: derivedMr11Rows.length,
      records: derivedMr11Rows as any,
    },
  });

  // Save to the shared database (works with either Mr11Run table layout)
  if (persist) {
    try {
      await saveMr11RunToDb({ id: run.id, sourceSnapshot, records: derivedMr11Rows });
    } catch (mr11DbErr: any) {
      console.error('[MR11 ENGINE] Could not save MR11 to the database:', mr11DbErr?.message);
    }
  }

  return run.id;
}