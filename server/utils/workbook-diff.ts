/**
 * Compares two uploads of a department workbook (parsed sheets from excel-normalizer) and
 * lists only what changed: cells whose value changed, rows added or removed, and sheets or
 * columns added or removed. Formatting is not compared, only values.
 *
 * Rows are matched by content rather than by row number, so inserting a row near the top
 * reports one added row instead of every row below it as changed. Columns are matched by
 * their header text when both files have a header row, for the same reason.
 */

export interface CellChange {
  column: string;
  header: string | null;
  before: string;
  after: string;
}

export interface RowValue {
  column: string;
  header: string | null;
  value: string;
}

export type RowChange =
  | { type: 'modified'; row: number; previousRow: number; label: string; cells: CellChange[] }
  | { type: 'added'; row: number; label: string; values: RowValue[] }
  | { type: 'removed'; previousRow: number; label: string; values: RowValue[] };

export interface SheetChange {
  sheet: string;
  status: 'added' | 'removed' | 'changed';
  columnsAdded: string[];
  columnsRemoved: string[];
  rows: RowChange[];
}

export interface WorkbookDiffSummary {
  cellsChanged: number;
  rowsAdded: number;
  rowsRemoved: number;
  rowsModified: number;
  sheetsAdded: number;
  sheetsRemoved: number;
}

export interface WorkbookDiff {
  summary: WorkbookDiffSummary;
  sheets: SheetChange[];
  // More changes than are kept; the summary still counts all of them
  truncated: boolean;
}

// Kept per upload, so one reshuffled workbook cannot make the log huge
const MAX_ROW_CHANGES = 3000;
// Values shown for an added or removed row
const MAX_ROW_VALUES = 40;
const MAX_TEXT = 300;

interface SheetRow {
  rowNo: number; // 1-based, as Excel shows it
  cells: Map<number, string>; // column index -> value text
}

interface SheetGrid {
  name: string;
  rows: SheetRow[];
  headerRowNo: number | null;
  headers: Map<number, string>;
}

export function sheetsOf(parsedWorkbook: any): any[] {
  if (Array.isArray(parsedWorkbook)) return parsedWorkbook;
  if (Array.isArray(parsedWorkbook?.sheets)) return parsedWorkbook.sheets;
  return [];
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function cellText(v: any): string {
  if (!v) return '';
  const shown = v.m !== undefined && v.m !== null ? String(v.m).trim() : '';
  if (shown !== '') return shown;
  if (v.v === undefined || v.v === null) return '';
  return String(v.v).trim();
}

function clip(s: string): string {
  return s.length > MAX_TEXT ? `${s.slice(0, MAX_TEXT)}…` : s;
}

function toGrid(sheet: any): SheetGrid {
  const byRow = new Map<number, Map<number, string>>();
  for (const cell of sheet?.celldata || []) {
    const text = cellText(cell?.v);
    if (text === '') continue;
    let row = byRow.get(cell.r);
    if (!row) byRow.set(cell.r, (row = new Map()));
    row.set(cell.c, text);
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([r, cells]) => ({ rowNo: r + 1, cells }));

  // Header row: among the first rows, the one with the most text (non-number) cells
  let header: SheetRow | null = null;
  let best = 2;
  for (const row of rows.slice(0, 20)) {
    const textCells = [...row.cells.values()].filter((t) => isNaN(Number(t.replace(/,/g, '')))).length;
    if (textCells > best) {
      best = textCells;
      header = row;
    }
  }
  return {
    name: String(sheet?.name ?? ''),
    rows,
    headerRowNo: header?.rowNo ?? null,
    headers: header ? new Map(header.cells) : new Map(),
  };
}

/** Old column index -> new column index; columns with the same header text are the same column. */
function matchColumns(prev: SheetGrid, next: SheetGrid): Map<number, number> {
  const allCols = (g: SheetGrid) => {
    const cols = new Set<number>();
    for (const row of g.rows) for (const c of row.cells.keys()) cols.add(c);
    return [...cols].sort((a, b) => a - b);
  };
  const prevCols = allCols(prev);
  const nextCols = allCols(next);
  const mapping = new Map<number, number>();

  const labelsUsable = (g: SheetGrid) => {
    const labels = [...g.headers.values()].map((h) => h.toLowerCase());
    return g.headers.size >= 3 && new Set(labels).size >= labels.length * 0.8;
  };
  if (!labelsUsable(prev) || !labelsUsable(next)) {
    // No usable header: columns are compared by position
    const nextSet = new Set(nextCols);
    for (const c of prevCols) if (nextSet.has(c)) mapping.set(c, c);
    return mapping;
  }

  // Align header labels in order, so repeated labels pair up left to right
  const key = (g: SheetGrid, c: number) => (g.headers.get(c) ?? `#${c}`).toLowerCase().replace(/\s+/g, ' ');
  const pairs = alignSequences(
    prevCols.map((c) => key(prev, c)),
    nextCols.map((c) => key(next, c))
  );
  for (const [i, j] of pairs) mapping.set(prevCols[i], nextCols[j]);

  // Unlabelled columns between matched ones keep their offset from the nearest matched column
  const usedNext = new Set(mapping.values());
  const nextSet = new Set(nextCols);
  for (const c of prevCols) {
    if (mapping.has(c) || prev.headers.has(c)) continue;
    let anchor = -1;
    for (const m of mapping.keys()) if (m < c && m > anchor) anchor = m;
    const target = anchor >= 0 ? mapping.get(anchor)! + (c - anchor) : c;
    if (nextSet.has(target) && !usedNext.has(target) && !next.headers.has(target)) {
      mapping.set(c, target);
      usedNext.add(target);
    }
  }

  // A column left over on both sides at the same position is the same column renamed
  for (const c of prevCols) {
    if (!mapping.has(c) && nextSet.has(c) && !usedNext.has(c)) {
      mapping.set(c, c);
      usedNext.add(c);
    }
  }
  return mapping;
}

/**
 * Pairs of equal items (index in a, index in b) in order: patience alignment on items that
 * occur once on each side, with a longest-common-subsequence fill between them.
 */
function alignSequences(a: string[], b: string[]): [number, number][] {
  const out: [number, number][] = [];
  const recurse = (aLo: number, aHi: number, bLo: number, bHi: number) => {
    // Common start and end
    while (aLo < aHi && bLo < bHi && a[aLo] === b[bLo]) out.push([aLo++, bLo++]);
    const tail: [number, number][] = [];
    while (aLo < aHi && bLo < bHi && a[aHi - 1] === b[bHi - 1]) tail.unshift([--aHi, --bHi]);

    if (aLo < aHi && bLo < bHi) {
      const count = (arr: string[], lo: number, hi: number) => {
        const m = new Map<string, number[]>();
        for (let i = lo; i < hi; i++) {
          const list = m.get(arr[i]);
          if (list) list.push(i);
          else m.set(arr[i], [i]);
        }
        return m;
      };
      const ca = count(a, aLo, aHi);
      const cb = count(b, bLo, bHi);
      const anchors: [number, number][] = [];
      for (let i = aLo; i < aHi; i++) {
        const ia = ca.get(a[i])!;
        const ib = cb.get(a[i]);
        if (ia.length === 1 && ib?.length === 1) anchors.push([i, ib[0]]);
      }

      if (anchors.length > 0) {
        // Longest run of anchors increasing on both sides
        const lis = longestIncreasing(anchors);
        let pa = aLo;
        let pb = bLo;
        for (const [i, j] of lis) {
          recurse(pa, i, pb, j);
          out.push([i, j]);
          pa = i + 1;
          pb = j + 1;
        }
        recurse(pa, aHi, pb, bHi);
      } else if ((aHi - aLo) * (bHi - bLo) <= 4_000_000) {
        lcsFill(a, b, aLo, aHi, bLo, bHi, out);
      }
      // Otherwise the whole stretch is left unmatched (reported as changed rows)
    }
    out.push(...tail);
  };
  recurse(0, a.length, 0, b.length);
  return out.sort((x, y) => x[0] - y[0]);
}

function longestIncreasing(pairs: [number, number][]): [number, number][] {
  // pairs are increasing in [0]; find the longest subsequence increasing in [1]
  const tails: number[] = [];
  const prev: number[] = new Array(pairs.length).fill(-1);
  for (let k = 0; k < pairs.length; k++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pairs[tails[mid]][1] < pairs[k][1]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[k] = tails[lo - 1];
    tails[lo] = k;
  }
  const result: [number, number][] = [];
  for (let k = tails.length ? tails[tails.length - 1] : -1; k >= 0; k = prev[k]) result.unshift(pairs[k]);
  return result;
}

function lcsFill(a: string[], b: string[], aLo: number, aHi: number, bLo: number, bHi: number, out: [number, number][]) {
  const n = aHi - aLo;
  const m = bHi - bLo;
  const table = new Uint32Array((n + 1) * (m + 1));
  const at = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[at(i, j)] =
        a[aLo + i] === b[bLo + j] ? table[at(i + 1, j + 1)] + 1 : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[aLo + i] === b[bLo + j]) {
      out.push([aLo + i, bLo + j]);
      i++;
      j++;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) i++;
    else j++;
  }
}

function headerOf(grid: SheetGrid, col: number): string | null {
  return grid.headers.get(col) ?? null;
}

// A short name for a row: its first few values, e.g. "P-1023 · Tower A · Slab"
function rowLabel(row: SheetRow): string {
  const values = [...row.cells.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
  return clip(values.slice(0, 3).join(' · '));
}

function rowValues(grid: SheetGrid, row: SheetRow): RowValue[] {
  return [...row.cells.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(0, MAX_ROW_VALUES)
    .map(([c, v]) => ({ column: columnLetter(c), header: headerOf(grid, c), value: clip(v) }));
}

function diffSheet(prev: SheetGrid, next: SheetGrid): SheetChange {
  const colMap = matchColumns(prev, next);
  const mappedPrevCols = [...colMap.keys()].sort((a, b) => a - b);
  const mappedNextCols = new Set(colMap.values());

  const prevAllCols = new Set<number>();
  for (const r of prev.rows) for (const c of r.cells.keys()) prevAllCols.add(c);
  const nextAllCols = new Set<number>();
  for (const r of next.rows) for (const c of r.cells.keys()) nextAllCols.add(c);
  const colName = (g: SheetGrid, c: number) => (g.headers.get(c) ? `${columnLetter(c)} (${g.headers.get(c)})` : columnLetter(c));
  const columnsRemoved = [...prevAllCols].filter((c) => !colMap.has(c)).sort((a, b) => a - b).map((c) => colName(prev, c));
  const columnsAdded = [...nextAllCols].filter((c) => !mappedNextCols.has(c)).sort((a, b) => a - b).map((c) => colName(next, c));

  // Rows are compared over the columns both files have
  const signature = (row: SheetRow, side: 'prev' | 'next') =>
    mappedPrevCols.map((c) => row.cells.get(side === 'prev' ? c : colMap.get(c)!) ?? '').join('\u0001');
  const prevSigs = prev.rows.map((r) => signature(r, 'prev'));
  const nextSigs = next.rows.map((r) => signature(r, 'next'));
  const matched = alignSequences(prevSigs, nextSigs);

  const rows: RowChange[] = [];
  const cellChanges = (p: SheetRow, n: SheetRow): CellChange[] => {
    const changes: CellChange[] = [];
    for (const c of mappedPrevCols) {
      const nc = colMap.get(c)!;
      const before = p.cells.get(c) ?? '';
      const after = n.cells.get(nc) ?? '';
      if (before !== after) {
        changes.push({ column: columnLetter(nc), header: headerOf(next, nc) ?? headerOf(prev, c), before: clip(before), after: clip(after) });
      }
    }
    return changes;
  };
  const similarity = (p: SheetRow, n: SheetRow) => {
    let same = 0;
    let filled = 0;
    for (const c of mappedPrevCols) {
      const before = p.cells.get(c) ?? '';
      const after = n.cells.get(colMap.get(c)!) ?? '';
      if (before === '' && after === '') continue;
      filled++;
      if (before === after) same++;
    }
    return filled === 0 ? 0 : same / filled;
  };

  // Each stretch between matched rows: pair removed and added rows that are the same row edited
  const handleGap = (pFrom: number, pTo: number, nFrom: number, nTo: number) => {
    const removed = prev.rows.slice(pFrom, pTo);
    const added = next.rows.slice(nFrom, nTo);
    const pairedWith = new Map<number, number>(); // index in removed -> index in added
    const usedAdded = new Set<number>();

    // Same first value (e.g. a project number) on one row each side
    const firstValue = (r: SheetRow) => r.cells.get(Math.min(...r.cells.keys())) ?? '';
    const addedByKey = new Map<string, number[]>();
    added.forEach((r, j) => {
      const k = firstValue(r);
      addedByKey.set(k, [...(addedByKey.get(k) || []), j]);
    });
    const removedKeyCount = new Map<string, number>();
    for (const r of removed) removedKeyCount.set(firstValue(r), (removedKeyCount.get(firstValue(r)) || 0) + 1);
    removed.forEach((r, i) => {
      const k = firstValue(r);
      const candidates = addedByKey.get(k);
      if (k && candidates?.length === 1 && removedKeyCount.get(k) === 1 && similarity(r, added[candidates[0]]) >= 0.3) {
        pairedWith.set(i, candidates[0]);
        usedAdded.add(candidates[0]);
      }
    });

    // Otherwise the most similar nearby row, keeping the order of rows
    let lastJ = -1;
    removed.forEach((r, i) => {
      if (pairedWith.has(i)) {
        lastJ = Math.max(lastJ, pairedWith.get(i)!);
        return;
      }
      let bestJ = -1;
      let bestScore = 0.5;
      for (let j = lastJ + 1; j < added.length && j <= lastJ + 50; j++) {
        if (usedAdded.has(j)) continue;
        const score = similarity(r, added[j]);
        if (score > bestScore) {
          bestScore = score;
          bestJ = j;
        }
      }
      if (bestJ >= 0) {
        pairedWith.set(i, bestJ);
        usedAdded.add(bestJ);
        lastJ = bestJ;
      }
    });

    // Still unpaired at the same row number: that row was rewritten in place
    const addedByRowNo = new Map(added.map((r, j) => [r.rowNo, j]));
    removed.forEach((r, i) => {
      const j = addedByRowNo.get(r.rowNo);
      if (!pairedWith.has(i) && j !== undefined && !usedAdded.has(j)) {
        pairedWith.set(i, j);
        usedAdded.add(j);
      }
    });

    const addedToRemoved = new Map([...pairedWith.entries()].map(([i, j]) => [j, i]));
    // Listed in the new file's row order; removed rows go where they used to be
    let i = 0;
    for (let j = 0; j < added.length; j++) {
      const partner = addedToRemoved.get(j);
      if (partner === undefined) {
        rows.push({ type: 'added', row: added[j].rowNo, label: rowLabel(added[j]), values: rowValues(next, added[j]) });
        continue;
      }
      for (; i < partner; i++) {
        if (!pairedWith.has(i)) {
          rows.push({ type: 'removed', previousRow: removed[i].rowNo, label: rowLabel(removed[i]), values: rowValues(prev, removed[i]) });
        }
      }
      i = Math.max(i, partner + 1);
      const cells = cellChanges(removed[partner], added[j]);
      if (cells.length > 0) {
        rows.push({ type: 'modified', row: added[j].rowNo, previousRow: removed[partner].rowNo, label: rowLabel(added[j]), cells });
      }
    }
    for (; i < removed.length; i++) {
      if (!pairedWith.has(i)) {
        rows.push({ type: 'removed', previousRow: removed[i].rowNo, label: rowLabel(removed[i]), values: rowValues(prev, removed[i]) });
      }
    }
  };

  let pi = 0;
  let ni = 0;
  for (const [i, j] of matched) {
    handleGap(pi, i, ni, j);
    pi = i + 1;
    ni = j + 1;
  }
  handleGap(pi, prev.rows.length, ni, next.rows.length);

  return { sheet: next.name, status: 'changed', columnsAdded, columnsRemoved, rows };
}

export function diffWorkbooks(previousWorkbook: any, nextWorkbook: any): WorkbookDiff {
  const prevSheets = sheetsOf(previousWorkbook);
  const nextSheets = sheetsOf(nextWorkbook);
  const summary: WorkbookDiffSummary = { cellsChanged: 0, rowsAdded: 0, rowsRemoved: 0, rowsModified: 0, sheetsAdded: 0, sheetsRemoved: 0 };
  const sheets: SheetChange[] = [];
  const prevByName = new Map(prevSheets.map((s: any) => [String(s?.name ?? ''), s]));
  const nextNames = new Set(nextSheets.map((s: any) => String(s?.name ?? '')));

  for (const sheet of nextSheets) {
    const name = String(sheet?.name ?? '');
    const prev = prevByName.get(name);
    if (!prev) {
      const grid = toGrid(sheet);
      summary.sheetsAdded++;
      summary.rowsAdded += grid.rows.length;
      sheets.push({ sheet: name, status: 'added', columnsAdded: [], columnsRemoved: [], rows: [] });
      continue;
    }
    const change = diffSheet(toGrid(prev), toGrid(sheet));
    for (const r of change.rows) {
      if (r.type === 'modified') {
        summary.rowsModified++;
        summary.cellsChanged += r.cells.length;
      } else if (r.type === 'added') summary.rowsAdded++;
      else summary.rowsRemoved++;
    }
    if (change.rows.length || change.columnsAdded.length || change.columnsRemoved.length) sheets.push(change);
  }
  for (const sheet of prevSheets) {
    const name = String(sheet?.name ?? '');
    if (nextNames.has(name)) continue;
    summary.sheetsRemoved++;
    summary.rowsRemoved += toGrid(sheet).rows.length;
    sheets.push({ sheet: name, status: 'removed', columnsAdded: [], columnsRemoved: [], rows: [] });
  }

  // Keep the log entry a sensible size
  let budget = MAX_ROW_CHANGES;
  let truncated = false;
  for (const s of sheets) {
    if (s.rows.length > budget) {
      s.rows = s.rows.slice(0, budget);
      truncated = true;
    }
    budget -= s.rows.length;
  }
  return { summary, sheets, truncated };
}

export function hasChanges(diff: WorkbookDiff): boolean {
  return diff.sheets.length > 0;
}

function recordText(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Number(v.toFixed(4))) : '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v).trim();
}

// MR11 columns recalculated from today's LME price and exchange rates when MR11 is shown,
// so a change there is not a change in anyone's upload
const MR11_LIVE_COLUMNS = new Set(['Selling Price (USD)', 'LME Adjusted (USD)', 'Final Selling Price (USD)']);

/**
 * Compares two MR11 runs row by row. Rows are matched by their _rowKey (the same project row
 * across uploads), and only the given columns are compared.
 */
export function diffMr11Records(previousRecords: any[], nextRecords: any[], columns: string[]): WorkbookDiff {
  const compared = columns.filter((c) => !c.startsWith('_') && !MR11_LIVE_COLUMNS.has(c));
  const keyed = (records: any[]) => {
    const seen = new Map<string, number>();
    return records.map((r, i) => {
      const base = String(r?._rowKey ?? `row-${i}`);
      const n = (seen.get(base) || 0) + 1;
      seen.set(base, n);
      return { key: n > 1 ? `${base}#${n}` : base, record: r ?? {}, rowNo: i + 1 };
    });
  };
  const prev = keyed(previousRecords || []);
  const next = keyed(nextRecords || []);
  const prevByKey = new Map(prev.map((p) => [p.key, p]));
  const nextKeys = new Set(next.map((n) => n.key));

  const label = (r: any) =>
    clip([r['Project No'], r['Short Name'], r['Stream'] ? `Stream ${r['Stream']}` : null].filter((v) => recordText(v) !== '').map(recordText).join(' · ')) ||
    clip(recordText(r['Customer & Project Name']));
  const values = (r: any): RowValue[] =>
    compared
      .filter((c) => recordText(r[c]) !== '')
      .slice(0, MAX_ROW_VALUES)
      .map((c) => ({ column: '', header: c, value: clip(recordText(r[c])) }));

  const summary: WorkbookDiffSummary = { cellsChanged: 0, rowsAdded: 0, rowsRemoved: 0, rowsModified: 0, sheetsAdded: 0, sheetsRemoved: 0 };
  const rows: RowChange[] = [];
  for (const n of next) {
    const p = prevByKey.get(n.key);
    if (!p) {
      rows.push({ type: 'added', row: n.rowNo, label: label(n.record), values: values(n.record) });
      summary.rowsAdded++;
      continue;
    }
    const cells: CellChange[] = [];
    for (const c of compared) {
      const before = recordText(p.record[c]);
      const after = recordText(n.record[c]);
      if (before !== after) cells.push({ column: '', header: c, before: clip(before), after: clip(after) });
    }
    if (cells.length > 0) {
      rows.push({ type: 'modified', row: n.rowNo, previousRow: p.rowNo, label: label(n.record), cells });
      summary.rowsModified++;
      summary.cellsChanged += cells.length;
    }
  }
  for (const p of prev) {
    if (nextKeys.has(p.key)) continue;
    rows.push({ type: 'removed', previousRow: p.rowNo, label: label(p.record), values: values(p.record) });
    summary.rowsRemoved++;
  }

  const truncated = rows.length > MAX_ROW_CHANGES;
  const sheets: SheetChange[] = rows.length
    ? [{ sheet: 'MR11', status: 'changed', columnsAdded: [], columnsRemoved: [], rows: rows.slice(0, MAX_ROW_CHANGES) }]
    : [];
  return { summary, sheets, truncated };
}
