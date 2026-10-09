// Numbers across the app use comma thousands separators (1,600 / 12,714.286). Columns that hold
// identifiers rather than amounts (project numbers, stream, PO, NCA, revisions ...) keep their
// digits as they are.

export const ID_COLUMN = /project\s*no|^po$|^nca$|nca\s*no|stream|series|revision|^rev\b|code|year|phone|^tel|^no\.?$|^#$/i;

/**
 * "1600" -> "1,600"; a value with decimals shows 3 of them ("3.1" -> "3.100"); with places,
 * that fixed number of decimals
 */
export function formatNumber(n: number, places?: number): string {
  const decimals = places ?? (Number.isInteger(n) ? 0 : 3);
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** A cell value as shown: numbers (or numeric text) get separators unless the column is an identifier */
export function formatCellNumber(value: any, header: string, places?: number): string {
  const text = String(value).trim();
  const isNumber = typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(text);
  if (!isNumber || ID_COLUMN.test(String(header ?? '').trim())) return String(value);
  const n = Number(text);
  return Number.isFinite(n) ? formatNumber(n, places) : String(value);
}
