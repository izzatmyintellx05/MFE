import crypto from 'crypto';
import { WorkbookDiff } from '../../utils/workbook-diff';
import { saveChangeLogToDb, fetchChangeLogsFromDb, isDatabaseConfigured } from '../../db/supabase';

/**
 * What changed between one upload and the one before it, for a department's Log tab
 * (scope = its code) or the MR11 Log tab (scope = 'MR11'). Kept in the shared database,
 * with this instance's memory as the store when there is none.
 */
export interface ChangeLogEntry {
  id: string;
  scope: string;
  fileVersionId: string | null;
  previousVersionId: string | null;
  originalFilename: string | null;
  previousFilename: string | null;
  // What caused the entry, e.g. "BD upload" for MR11
  source: string | null;
  uploadedById: string | null;
  uploadedByName: string | null;
  // The first upload: there is nothing earlier to compare with
  isFirst: boolean;
  summary: WorkbookDiff['summary'];
  changes: WorkbookDiff['sheets'];
  truncated: boolean;
  createdAt: Date;
}

const MEMORY_LIMIT = 200;
const memoryLog: ChangeLogEntry[] = [];

export const MR11_SCOPE = 'MR11';

export async function recordChange(
  scope: string,
  diff: WorkbookDiff | null,
  details: Partial<Omit<ChangeLogEntry, 'id' | 'scope' | 'summary' | 'changes' | 'truncated' | 'createdAt'>>
): Promise<ChangeLogEntry> {
  const entry: ChangeLogEntry = {
    id: crypto.randomUUID(),
    scope,
    fileVersionId: details.fileVersionId ?? null,
    previousVersionId: details.previousVersionId ?? null,
    originalFilename: details.originalFilename ?? null,
    previousFilename: details.previousFilename ?? null,
    source: details.source ?? null,
    uploadedById: details.uploadedById ?? null,
    uploadedByName: details.uploadedByName ?? null,
    isFirst: Boolean(details.isFirst) || !diff,
    summary: diff?.summary ?? { cellsChanged: 0, rowsAdded: 0, rowsRemoved: 0, rowsModified: 0, sheetsAdded: 0, sheetsRemoved: 0 },
    changes: diff?.sheets ?? [],
    truncated: diff?.truncated ?? false,
    createdAt: new Date(),
  };

  memoryLog.unshift(entry);
  if (memoryLog.length > MEMORY_LIMIT) memoryLog.length = MEMORY_LIMIT;

  // A log that could not be saved must not undo the upload itself
  try {
    await saveChangeLogToDb(entry);
  } catch (err: any) {
    console.warn(`[CHANGE LOG] Could not save the ${scope} change log:`, err?.message || err);
  }
  return entry;
}

const withoutChanges = ({ changes, ...rest }: ChangeLogEntry) => rest;

/** Summaries, newest first: the database's when it has one, otherwise this instance's. */
export async function listChanges(scope: string, limit = 100) {
  if (isDatabaseConfigured()) {
    const rows = await fetchChangeLogsFromDb(scope, { limit });
    if (rows) return rows;
  }
  return memoryLog.filter((e) => e.scope === scope).slice(0, limit).map(withoutChanges);
}

/** One entry with its changes, or null. */
export async function getChange(scope: string, id: string) {
  if (isDatabaseConfigured()) {
    const rows = await fetchChangeLogsFromDb(scope, { id, withChanges: true });
    if (rows?.length) return rows[0];
  }
  return memoryLog.find((e) => e.scope === scope && e.id === id) ?? null;
}
