/**
 * Single shared implementation of "trigger a browser file download from
 * an in-memory Blob" - a temporary object URL + a synthetic anchor
 * click, cleaned up immediately after. Consolidated here (Phase 6
 * architecture review, Module 1) after finding this exact logic
 * duplicated verbatim across BackupService, CenterExportService,
 * ExportService and PdfService - every one of those now calls this
 * instead.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
