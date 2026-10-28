import {
  isDatabaseConfigured,
  fetchCompletedProjectsFromDb,
  saveCompletedProjectToDb,
  deleteCompletedProjectFromDb,
} from '../../db/supabase';

/**
 * MR11 rows marked complete. They are kept apart from the MR11 runs (shared by every user and
 * every instance), so marking one needs no rebuild and lasts through new uploads; the MR11
 * page shows them in the Completed table instead of the main one. MR11 itself, its export and
 * the CEO dashboard still include them.
 */
export interface CompletedProject {
  /** The row's _rowKey */
  id: string;
  projectNo: string | null;
  shortName: string | null;
  projectName: string | null;
  completedById: string | null;
  completedBy: string | null;
  completedAt: Date | string;
}

// Used when no database is configured (local runs without one)
const memoryCompleted = new Map<string, CompletedProject>();

export async function listCompletedProjects(): Promise<CompletedProject[]> {
  if (isDatabaseConfigured()) {
    const rows = await fetchCompletedProjectsFromDb();
    if (rows) return rows;
  }
  return [...memoryCompleted.values()];
}

export async function markProjectComplete(entry: CompletedProject): Promise<CompletedProject[]> {
  if (!(await saveCompletedProjectToDb(entry))) memoryCompleted.set(entry.id, entry);
  return listCompletedProjects();
}

export async function markProjectIncomplete(id: string): Promise<CompletedProject[]> {
  if (!(await deleteCompletedProjectFromDb(id))) memoryCompleted.delete(id);
  return listCompletedProjects();
}
