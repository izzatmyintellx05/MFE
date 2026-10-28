// A project marked complete moves, with all its streams, from the MR11 table to the Completed
// table. Projects are keyed by Project No, or Short Name when a row has none.
export function projectKeyOf(row: Record<string, any>): string {
  const no = String(row['Project No'] ?? row['Project No.'] ?? '').trim().toUpperCase();
  if (no) return `NO:${no}`;
  const short = String(row['Short Name'] ?? row['Project Shortname'] ?? '').trim().toUpperCase();
  return short ? `SHORT:${short}` : '';
}

export interface CompletedProject {
  id: string;
  projectNo: string | null;
  shortName: string | null;
  projectName: string | null;
  completedBy: string | null;
  completedAt: string;
}
