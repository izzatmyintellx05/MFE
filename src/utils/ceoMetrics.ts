// Aggregations behind the CEO dashboard, computed from MR11 records.
// Each MR11 record is one series row; a project spans several rows (one or more per stream).

export type Region = 'MALAYSIA' | 'INDIA' | 'ROW';
export type RegionFilter = 'ALL' | Region;

export const REGIONS: Region[] = ['MALAYSIA', 'INDIA', 'ROW'];

export const REGION_LABELS: Record<Region, string> = {
  MALAYSIA: 'Malaysia',
  INDIA: 'India',
  ROW: 'Rest of World',
};

// Used for a month that is not yet completed and has no forecast value
export const DEFAULT_FORECAST_M2 = 100000;

export type Stage = 'design' | 'processed' | 'produced' | 'dispatched' | 'sailed';

export const STAGES: Stage[] = ['design', 'processed', 'produced', 'dispatched', 'sailed'];

export const STAGE_LABELS: Record<Stage, string> = {
  design: 'Total Design',
  processed: 'Total Processed',
  produced: 'Total Produced',
  dispatched: 'Total Dispatched',
  sailed: 'Actual Sailed',
};

// MR11 quantity and date column for each pipeline stage
const STAGE_COLUMNS: Record<Stage, { qty: string; date: string }> = {
  design: { qty: 'Total Quantity Ordered m2', date: 'Actual Formwork Order Completion Date' },
  processed: { qty: 'Total Processed', date: 'Processed Date' },
  produced: { qty: 'Total Produced', date: 'Produced Date' },
  dispatched: { qty: 'Total Dispatch', date: 'Dispatched Date' },
  // Quantity actually shipped, dated by the actual time of departure
  sailed: { qty: 'Formwork Quantity Sailed (m2)', date: 'ATD' },
};

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface MonthColumn {
  key: string; // MR11 header, e.g. "Jan-26"
  year: number;
  month: number; // 0-11
}

export interface MonthPoint extends MonthColumn {
  value: number;
  kind: 'actual' | 'forecast';
  isDefault: boolean; // forecast had no value, DEFAULT_FORECAST_M2 used
}

export type StageTotals = Record<Stage, number>;

export function toNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

export function regionOf(row: any): Region {
  // The Countries column decides; the project name prefix ("INDIA - ...") is the fallback
  const country = String(row?.['Countries'] ?? '').trim().toLowerCase();
  const text = country || String(row?.['Customer & Project Name'] ?? '').toLowerCase();
  if (text.includes('malaysia')) return 'MALAYSIA';
  if (text.includes('india')) return 'INDIA';
  return 'ROW';
}

export function projectKey(row: any): string {
  return String(
    row?.['Customer & Project Name'] || row?.['Project No'] || row?.['Short Name'] || 'Unnamed Project'
  ).trim();
}

// Short chart label: "INDIA - Alekhya ... - Adarsh Parkland" -> "Alekhya ... - Adarsh Parkland"
export function projectLabel(row: any): string {
  const short = String(row?.['Short Name'] || '').trim();
  if (short) return short;
  const name = projectKey(row).replace(/^[A-Z][A-Z\s]+-\s*/, '');
  return name.length > 40 ? `${name.slice(0, 38)}…` : name;
}

// Month columns present in the MR11 headers ("Jan-26" ... "Dec-27"), in header order
export function monthColumns(headers: string[]): MonthColumn[] {
  const result: MonthColumn[] = [];
  for (const h of headers) {
    const m = String(h).match(/^([A-Z][a-z]{2})-(\d{2})$/);
    const month = m ? MONTH_ABBR.indexOf(m[1]) : -1;
    if (m && month >= 0) result.push({ key: h, year: 2000 + parseInt(m[2], 10), month });
  }
  return result;
}

// MR11 month key ("Oct-26") for a date cell, or null when it is not a date (e.g. "Normal")
export function monthKeyOfDate(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  let year: number;
  let month: number;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    year = value.getFullYear();
    month = value.getMonth();
  } else {
    const s = String(value).trim();
    const ymd = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (ymd) {
      year = parseInt(ymd[1], 10);
      month = parseInt(ymd[2], 10) - 1;
    } else if (dmy) {
      year = parseInt(dmy[3], 10);
      month = parseInt(dmy[2], 10) - 1;
    } else {
      return null;
    }
  }
  if (month < 0 || month > 11) return null;
  return `${MONTH_ABBR[month]}-${String(year).slice(-2)}`;
}

// A month is completed (actual) once the calendar month has ended
export function isMonthCompleted(col: MonthColumn, today: Date): boolean {
  return col.year < today.getFullYear() || (col.year === today.getFullYear() && col.month < today.getMonth());
}

export function filterByRegion(rows: any[], region: RegionFilter): any[] {
  if (region === 'ALL') return rows;
  return rows.filter((r) => regionOf(r) === region);
}

// One row per project. Monthly m2 values come from the Finance row matched to the
// project, so they repeat on every series row of that project and must be counted once.
export function firstRowPerProject(rows: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];
  for (const r of rows) {
    const key = projectKey(r);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(r);
    }
  }
  return result;
}

function stageQuantity(row: any, stage: Stage): number {
  // Design quantity is merged across a stream's series rows; only the stream lead carries it
  if (stage === 'design' && row?._isStreamLead === false) return 0;
  return toNumber(row?.[STAGE_COLUMNS[stage].qty]);
}

// Design -> Processed -> Produced -> Dispatched totals. With a month, a quantity is
// counted only when that stage's date falls in the month.
export function stageTotals(rows: any[], monthKey: string | null): StageTotals {
  const totals: StageTotals = { design: 0, processed: 0, produced: 0, dispatched: 0, sailed: 0 };
  for (const row of rows) {
    for (const stage of STAGES) {
      if (monthKey && monthKeyOfDate(row?.[STAGE_COLUMNS[stage].date]) !== monthKey) continue;
      totals[stage] += stageQuantity(row, stage);
    }
  }
  return totals;
}

// Sum of a month column across projects (each project counted once)
export function monthValue(rows: any[], monthKey: string): number {
  return firstRowPerProject(rows).reduce((acc, r) => acc + toNumber(r?.[monthKey]), 0);
}

export function monthlySeries(rows: any[], months: MonthColumn[], today: Date): MonthPoint[] {
  return months.map((col) => {
    const raw = monthValue(rows, col.key);
    const kind = isMonthCompleted(col, today) ? 'actual' : 'forecast';
    const isDefault = kind === 'forecast' && raw <= 0;
    return { ...col, value: isDefault ? DEFAULT_FORECAST_M2 : raw, kind, isDefault };
  });
}

// Average Final Selling Price (USD per m²), weighted by each project's m² in the month
// (or across all months); projects without m² count equally when nothing is weighted.
export function averageSellingPrice(rows: any[], months: MonthColumn[], monthKey: string | null): number | null {
  let weighted = 0;
  let weight = 0;
  const plain: number[] = [];
  for (const r of firstRowPerProject(rows)) {
    const price = toNumber(r?.['Final Selling Price (USD)']);
    if (price <= 0) continue;
    const m2 = monthKey ? toNumber(r?.[monthKey]) : months.reduce((a, m) => a + toNumber(r?.[m.key]), 0);
    plain.push(price);
    if (m2 > 0) {
      weighted += price * m2;
      weight += m2;
    }
  }
  if (weight > 0) return weighted / weight;
  return plain.length ? plain.reduce((a, b) => a + b, 0) / plain.length : null;
}

export interface ProjectBreakdown {
  key: string;
  label: string;
  region: Region;
  month: number; // the selected month's m2 from the monthly columns
  stages: StageTotals;
}

export function projectBreakdown(rows: any[], monthKey: string | null): ProjectBreakdown[] {
  const groups = new Map<string, any[]>();
  for (const r of rows) {
    const key = projectKey(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  return Array.from(groups.entries()).map(([key, projectRows]) => ({
    key,
    label: projectLabel(projectRows[0]),
    region: regionOf(projectRows[0]),
    month: monthKey ? toNumber(projectRows[0]?.[monthKey]) : 0,
    stages: stageTotals(projectRows, monthKey),
  }));
}
