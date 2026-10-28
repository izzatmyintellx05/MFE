// An MR11 row marked complete (by its _rowKey): it shows in the Completed table instead of MR11
export interface CompletedProject {
  id: string;
  projectNo: string | null;
  shortName: string | null;
  projectName: string | null;
  completedBy: string | null;
  completedAt: string;
}
