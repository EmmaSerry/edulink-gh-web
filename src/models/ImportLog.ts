/** One row per bulk-import run (Module 7), so administrators can review
 *  what happened even after the fact. */
export interface ImportError {
  row: number;
  message: string;
}

export interface ImportLogEntry {
  id?: number;
  fileName: string;
  importedAt: string;
  totalRows: number;
  successCount: number;
  errorCount: number;
  duplicateCount: number;
  errors: ImportError[];
}
