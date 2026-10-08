// Filters for the MR11 table: each field lists the values found in the rows, and a row is shown
// when, for every field with values ticked, its own value is one of them.

export interface FilterField {
  key: string;
  label: string;
  /** Value of the row for this filter (defaults to the column of the same name) */
  derive?: (row: Record<string, any>) => string;
}

export const BLANK = '(blank)';

// Where a row is in dispatch, from its ETD/ATD column
function dispatchStage(row: Record<string, any>): string {
  const text = String(row['ETD/ATD'] ?? '').trim();
  if (text === '-') return 'Not applicable (-)';
  const hasEtd = /^ETD:/m.test(text);
  const hasAtd = /^ATD:/m.test(text);
  if (/^Dispatched:/m.test(text)) return 'Dispatched (local)';
  if (hasAtd && hasEtd) return 'Partly sailed (ETD + ATD)';
  if (hasAtd) return 'Sailed (ATD)';
  if (hasEtd) return 'Awaiting departure (ETD)';
  return 'No dispatch yet';
}

export const FILTER_FIELDS: FilterField[] = [
  { key: 'Short Name', label: 'Project' },
  { key: 'Countries', label: 'Country' },
  { key: 'PIC', label: 'PIC' },
  { key: 'Status', label: 'Status' },
  { key: 'Products type', label: 'Product type' },
  { key: 'Formwork type', label: 'Formwork type' },
  { key: 'Stream', label: 'Stream' },
  { key: 'Shell Plan Status - Pending Consultant Drawings', label: 'Shell Plan status' },
  { key: 'Formwork Design Status', label: 'Design status' },
  { key: 'Advance Received / Payment Status', label: 'Payment status' },
  { key: 'LME', label: 'LME type' },
  { key: 'Dispatch stage', label: 'Dispatch stage', derive: dispatchStage },
];

export function filterValue(field: FilterField, row: Record<string, any>): string {
  const raw = field.derive ? field.derive(row) : row[field.key];
  const text = String(raw ?? '').trim();
  return text || BLANK;
}

/** Each value of a field with how many rows have it, most common first */
export function valueCounts(field: FilterField, rows: Record<string, any>[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = filterValue(field, row);
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => (a.value === BLANK ? 1 : b.value === BLANK ? -1 : a.value.localeCompare(b.value, undefined, { numeric: true })));
}

export function applyFilters(rows: Record<string, any>[], selected: Record<string, string[]>): Record<string, any>[] {
  const active = FILTER_FIELDS.filter((f) => (selected[f.key] || []).length > 0);
  if (active.length === 0) return rows;
  return rows.filter((row) => active.every((f) => selected[f.key].includes(filterValue(f, row))));
}

export function activeFilterCount(selected: Record<string, string[]>): number {
  return Object.values(selected).filter((v) => v.length > 0).length;
}

/**
 * Shell Plan / Design cells are merged down a block of rows (_streamSpan on its first row).
 * When search or filters hide some rows of a block, the merge is redone over the rows still shown.
 */
export function remergeStreamBlocks(all: Record<string, any>[], shown: Record<string, any>[]): Record<string, any>[] {
  if (shown.length === all.length) return shown;
  const blockOf = new Map<Record<string, any>, number>();
  let block = -1;
  for (const row of all) {
    if (row._isStreamLead !== false) block++;
    blockOf.set(row, block);
  }
  const result: Record<string, any>[] = [];
  for (let i = 0; i < shown.length; ) {
    const b = blockOf.get(shown[i]);
    let span = 1;
    while (i + span < shown.length && blockOf.get(shown[i + span]) === b) span++;
    result.push({ ...shown[i], _isStreamLead: true, _streamSpan: span });
    for (let j = 1; j < span; j++) result.push({ ...shown[i + j], _isStreamLead: false, _streamSpan: 0 });
    i += span;
  }
  return result;
}
