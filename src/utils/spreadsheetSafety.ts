/**
 * Phase 6 (Module 9 - security & data integrity review): every xlsx/csv
 * export in the app (`ExportService`, `CenterExportService`,
 * `BackupService`) builds rows from free-text data a user typed in at
 * some point - guardian names, remarks, previous-school names, phone
 * numbers, and so on - and hands them straight to SheetJS's
 * `json_to_sheet`. If any such value happens to start with `=`, `+`, `-`
 * or `@`, Microsoft Excel (and some other spreadsheet software) may treat
 * it as a formula the moment the exported file is opened - the classic
 * "CSV/spreadsheet formula injection" class of vulnerability. This is a
 * real risk here specifically because Ghanaian phone numbers are often
 * written in international format with a leading `+`, and any free-text
 * field (remarks, names) could in principle start with any character.
 *
 * The standard, OWASP-recommended mitigation is to prefix such values
 * with a leading apostrophe before they reach the spreadsheet library,
 * which forces the cell to be treated as literal text rather than
 * evaluated as a formula when opened. Every export/backup call site now
 * runs its rows through `sanitizeRowsForSpreadsheet` immediately before
 * calling `XLSX.utils.json_to_sheet`.
 */
const DANGEROUS_LEADING_CHARS = ["=", "+", "-", "@"];

export function sanitizeCellValue(value: unknown): unknown {
  if (typeof value !== "string" || value.length === 0) return value;
  if (DANGEROUS_LEADING_CHARS.includes(value[0])) {
    return `'${value}`;
  }
  return value;
}

// `T extends object` (rather than `T extends Record<string, unknown>`)
// deliberately, since a plain `interface` with named properties and no
// explicit index signature (e.g. ExportService's `ExportRow`) is not
// assignable to `Record<string, unknown>` for generic-constraint
// purposes in TypeScript, even though it's perfectly safe to iterate its
// own keys - this was caught by a real `tsc` run this project's sandbox
// could not perform itself; `T extends object` accepts every row shape
// this function is actually called with (ExportRow, and the plain
// Record<string, unknown> rows used elsewhere) without requiring one.
export function sanitizeRowsForSpreadsheet<T extends object>(rows: T[]): T[] {
  return rows.map((row) => {
    const safe = { ...row };
    for (const key of Object.keys(safe) as Array<keyof T>) {
      safe[key] = sanitizeCellValue(safe[key]) as T[keyof T];
    }
    return safe;
  });
}
