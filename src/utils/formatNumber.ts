// Numbers across the app use comma thousands separators (1,600 / 12,714.29). Columns that hold
// identifiers rather than amounts (project numbers, stream, PO, NCA, revisions ...) keep their
// digits as they are.

export const ID_COLUMN = /project\s*no|^po$|^nca$|nca\s*no|stream|series|revision|^rev\b|code|year|phone|^tel|^no\.?$|^#$/i;

/** "1600" -> "1,600"; with places, a fixed number of decimals ("3.1" -> "3.100") */
export function formatNumber(n: number, places?: number): string {
  return n.toLocaleString(
    'en-US',
    places !== undefined ? { minimumFractionDigits: places, maximumFractionDigits: places } : { maximumFractionDigits: 3 }
  );
}

/** A cell value as shown: numbers (or numeric text) get separators unless the column is an identifier */
export function formatCellNumber(value: any, header: string, places?: number): string {
  const text = String(value).trim();
  const isNumber = typeof value === 'number' || /^-?\d+(\.\d+)?$/.test(text);
  if (!isNumber || ID_COLUMN.test(String(header ?? '').trim())) return String(value);
  const n = Number(text);
  return Number.isFinite(n) ? formatNumber(n, places) : String(value);
}
