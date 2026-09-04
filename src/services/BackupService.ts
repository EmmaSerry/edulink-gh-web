import * as XLSX from "xlsx";
import { db } from "@database/db";
import { APP_INFO } from "@config/appConfig";
import { SystemLogService } from "./SystemLogService";
import { downloadBlob } from "@utils/downloadBlob";
import { sanitizeRowsForSpreadsheet } from "@utils/spreadsheetSafety";
import type { BackupHistoryEntry, BackupFormat, BackupScope } from "@models/BackupHistory";

/**
 * Module 2 (Phase 5) - Backup & Restore. Everything here works entirely
 * offline (SheetJS + native Blob download/File reading - no network
 * calls of any kind).
 *
 * MODULE GROUPING - a "module" is a named group of Dexie tables a school
 * can back up/restore independently (Full Backup = every group).
 * Meta/log tables (systemLogs, exportHistory, importLogs, backupHistory
 * itself, diagnosticsSnapshots, performanceMetrics) are deliberately
 * excluded from backup content - they describe what happened on THIS
 * installation, restoring them onto another/later installation would
 * misrepresent its own history rather than preserve it.
 *
 * RESTORE SAFETY - "automatic rollback if restore fails" is provided by
 * IndexedDB's own transaction atomicity: every table clear+reinsert for
 * a restore happens inside one `db.transaction("rw", ...)`. If any
 * write throws partway through, Dexie/IndexedDB discards the entire
 * transaction as if nothing had been touched - there is no need for (and
 * no safe way to improve on) a hand-rolled snapshot/undo on top of that
 * native guarantee.
 *
 * ID PRESERVATION - restored rows keep their original numeric primary
 * keys (Dexie honours an explicit `id` on `bulkAdd` for `++id` tables
 * once the table has been cleared first), so cross-table references
 * (e.g. an Enrollment's `studentId`) continue to resolve correctly even
 * when only some modules are restored.
 */
export interface BackupModuleDef {
  key: string;
  label: string;
  tables: string[];
}

export const BACKUP_MODULES: BackupModuleDef[] = [
  { key: "school", label: "School Profile", tables: ["schools"] },
  { key: "academicStructure", label: "Academic Years, Terms, Levels & Classes", tables: ["academicYears", "terms", "levels", "gradeBands", "classes"] },
  { key: "subjects", label: "Subjects", tables: ["subjects"] },
  { key: "learningAreasSkills", label: "Learning Areas & Skills (KG)", tables: ["learningAreas", "skills"] },
  { key: "remarksBank", label: "Remarks Bank", tables: ["remarksBank"] },
  { key: "settings", label: "Settings & Report Templates", tables: ["settings", "templateSettings", "reportTemplates"] },
  { key: "students", label: "Students", tables: ["students", "guardians", "enrollments", "promotionHistory", "studentPhotos"] },
  { key: "assessments", label: "Assessments", tables: ["assessmentSessions", "scoreRecords", "skillAssessmentRecords", "auditLogs"] },
  { key: "reports", label: "Reports", tables: ["reportRecords", "generatedReports", "reportVersions", "printLogs", "exportLogs"] },
  { key: "archives", label: "Archives", tables: ["archives"] },
  // Phase 6 (Module 10 - import/export/backup validation) found that
  // `systemLogs`, `exportHistory`, `importLogs`, `diagnosticsSnapshots`
  // and `performanceMetrics` were never assigned to any backup module -
  // even a "Full Backup" (every module selected) silently never captured
  // them. `docs/PHASE5_PRODUCTION.md` states this was deliberate ("they
  // describe what happened on *this* installation, and restoring them
  // onto another/later installation would misrepresent its own history
  // rather than preserve it") - but on the independent re-verification
  // this phase's brief specifically calls for, that reasoning does not
  // hold up and is applied inconsistently even within Phase 5's own
  // design: `auditLogs` is exactly the same kind of "what happened on
  // this installation" log data, and it WAS already included (in the
  // "assessments" module) without the same concern being raised. The
  // realistic use of Restore is disaster recovery onto the SAME
  // installation (a corrupted browser profile, moving to a new device) -
  // in that case a school administrator restoring their data very much
  // wants their real import/export/system-activity history back, not a
  // history with unexplained gaps. The "merging two installations'
  // histories" scenario this exclusion was guarding against is already
  // an inherent property of Restore for every other table too (it
  // already replaces whatever students/scores/etc. exist on the target
  // installation), so singling out logs for special treatment doesn't
  // hold up. Reversed here, deliberately and documented, per this
  // phase's explicit instruction not to assume prior-phase behaviour is
  // correct just because it was already implemented.
  //
  // `backupHistory` remains excluded - it is the catalogue of backups
  // *of* this database, and restoring a backup's own backup-history log
  // back into a live database would create a confusing "history of
  // history" chain. This is a narrower, still-valid concern (this table
  // is uniquely self-referential in a way none of the other five are),
  // and mirrors how most backup tools treat their own catalogue.
  {
    key: "systemData",
    label: "System Logs & Diagnostics",
    tables: ["systemLogs", "exportHistory", "importLogs", "diagnosticsSnapshots", "performanceMetrics"],
  },
];

export const ALL_MODULE_KEYS = BACKUP_MODULES.map((m) => m.key);

interface BackupFilePayload {
  meta: {
    app: string;
    version: string;
    dbVersion: number;
    createdAt: string;
    scope: BackupScope;
    modules: string[];
  };
  data: Record<string, unknown[]>;
}

export interface RestorePreview {
  meta: BackupFilePayload["meta"];
  tableCounts: Record<string, number>;
  existingCounts: Record<string, number>;
  conflictWarnings: string[];
}

export interface RestoreResult {
  success: boolean;
  tablesRestored: string[];
  recordCounts: Record<string, number>;
  error?: string;
}

function tablesForModules(moduleKeys: string[]): string[] {
  return BACKUP_MODULES.filter((m) => moduleKeys.includes(m.key)).flatMap((m) => m.tables);
}

class BackupServiceImpl {
  /** Builds the in-memory payload for the selected modules - shared by
   *  every export format. */
  private async buildPayload(moduleKeys: string[]): Promise<{ payload: BackupFilePayload; recordCounts: Record<string, number> }> {
    const tables = tablesForModules(moduleKeys);
    const data: Record<string, unknown[]> = {};
    const recordCounts: Record<string, number> = {};

    for (const tableName of tables) {
      const rows = await db.table(tableName).toArray();
      data[tableName] = rows;
      recordCounts[tableName] = rows.length;
    }

    const payload: BackupFilePayload = {
      meta: {
        app: APP_INFO.name,
        version: APP_INFO.version,
        dbVersion: db.verno,
        createdAt: new Date().toISOString(),
        scope: moduleKeys.length === ALL_MODULE_KEYS.length ? "full" : "partial",
        modules: moduleKeys,
      },
      data,
    };
    return { payload, recordCounts };
  }

  /** Exports a full or partial backup. JSON is the fully lossless,
   *  restorable format; xlsx/csv are best-effort human-readable exports
   *  (nested objects are JSON-stringified per cell) intended for
   *  viewing/sharing outside ACTRS, not for restoring back in - see the
   *  file-level doc comment. */
  async exportBackup(moduleKeys: string[], format: BackupFormat, performedBy: string): Promise<BackupHistoryEntry> {
    const { payload, recordCounts } = await this.buildPayload(moduleKeys);
    const stamp = new Date().toISOString().slice(0, 10);
    const scopeLabel = payload.meta.scope === "full" ? "full" : "partial";
    const fileName = `actrs-backup-${scopeLabel}-${stamp}.${format}`;

    if (format === "json") {
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }), fileName);
    } else {
      const workbook = XLSX.utils.book_new();
      for (const [tableName, rows] of Object.entries(payload.data)) {
        const flatRows = (rows as Record<string, unknown>[]).map((row) => {
          const flat: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(row)) {
            flat[k] = v !== null && typeof v === "object" ? JSON.stringify(v) : v;
          }
          return flat;
        });
        // Phase 6 (Module 9): this xlsx/csv branch is for human inspection
        // only - Restore always reads the JSON format (see `restore()`
        // below, which does `JSON.parse` and never touches XLSX), so
        // sanitizing these cells cannot affect restore fidelity.
        const safeFlatRows = sanitizeRowsForSpreadsheet(flatRows);
        const sheet = XLSX.utils.json_to_sheet(safeFlatRows.length > 0 ? safeFlatRows : [{ "(no rows)": "" }]);
        // Sheet names are capped at 31 characters by the xlsx format.
        XLSX.utils.book_append_sheet(workbook, sheet, tableName.slice(0, 31));
      }
      if (format === "csv") {
        // CSV has no multi-sheet concept - concatenate each table as a
        // labelled section in one file (documented pragmatic tradeoff,
        // consistent with Phase 4's no-zip-library approach).
        let csv = "";
        for (const sheetName of workbook.SheetNames) {
          csv += `# ${sheetName}\n`;
          csv += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
          csv += "\n\n";
        }
        downloadBlob(new Blob([csv], { type: "text/csv" }), fileName);
      } else {
        const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        downloadBlob(new Blob([arrayBuffer], { type: "application/octet-stream" }), fileName);
      }
    }

    const entry: Omit<BackupHistoryEntry, "id"> = {
      type: "export",
      fileName,
      recordCounts,
      performedAt: new Date().toISOString(),
      scope: payload.meta.scope,
      modules: moduleKeys,
      format,
      performedBy,
    };
    const id = await db.backupHistory.add(entry as BackupHistoryEntry);

    await SystemLogService.record({
      module: "BACKUP",
      action: `${scopeLabel === "full" ? "Full" : "Partial"} backup created`,
      performedBy,
      details: `${fileName} - ${Object.values(recordCounts).reduce((a, b) => a + b, 0)} total records across ${moduleKeys.length} module(s).`,
    });

    return { ...entry, id } as BackupHistoryEntry;
  }

  /** Parses a .json backup file without writing anything - used for the
   *  restore preview screen (Module 2 - "Backup preview" / "Conflict
   *  detection"). Only JSON backups can be restored; see file doc
   *  comment for why xlsx/csv are export-only. */
  async previewRestore(file: File): Promise<RestorePreview> {
    if (!file.name.toLowerCase().endsWith(".json")) {
      throw new Error("Only a .json backup file created by ACTRS can be restored. xlsx/csv exports are for viewing outside ACTRS only.");
    }
    const text = await file.text();
    let parsed: BackupFilePayload;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("This file is not valid JSON - it may be corrupted.");
    }
    if (!parsed?.meta?.modules || !parsed.data) {
      throw new Error("This file does not look like an ACTRS backup (missing meta/data).");
    }

    const tableCounts: Record<string, number> = {};
    const conflictWarnings: string[] = [];
    const existingCounts: Record<string, number> = {};

    for (const [tableName, rows] of Object.entries(parsed.data)) {
      if (!Array.isArray(rows)) {
        conflictWarnings.push(`"${tableName}" in the backup file is not a list of records - it will be skipped.`);
        continue;
      }
      tableCounts[tableName] = rows.length;
      try {
        existingCounts[tableName] = await db.table(tableName).count();
      } catch {
        conflictWarnings.push(`"${tableName}" does not exist in this version of ACTRS and will be skipped.`);
      }
    }

    for (const [tableName, existing] of Object.entries(existingCounts)) {
      if (existing > 0) {
        conflictWarnings.push(
          `"${tableName}" already has ${existing} record(s) in this installation - restoring will REPLACE them with the ${tableCounts[tableName] ?? 0} record(s) from the backup.`,
        );
      }
    }

    return { meta: parsed.meta, tableCounts, existingCounts, conflictWarnings };
  }

  /** Restores the selected tables from a previously-previewed backup
   *  file. Every table named is fully replaced (cleared, then the
   *  backup's rows re-inserted with their original ids) inside a single
   *  Dexie read-write transaction, so a failure partway through leaves
   *  the database completely untouched (see file doc comment). */
  async restore(file: File, selectedTables: string[], performedBy: string): Promise<RestoreResult> {
    const text = await file.text();
    const parsed: BackupFilePayload = JSON.parse(text);
    const tablesToRestore = selectedTables.filter((t) => Array.isArray(parsed.data[t]));
    const recordCounts: Record<string, number> = {};

    try {
      const dexieTables = tablesToRestore.map((t) => db.table(t));
      await db.transaction("rw", dexieTables, async () => {
        for (const tableName of tablesToRestore) {
          const table = db.table(tableName);
          await table.clear();
          const rows = parsed.data[tableName] as Record<string, unknown>[];
          if (rows.length > 0) await table.bulkAdd(rows as never[]);
          recordCounts[tableName] = rows.length;
        }
      });

      await db.backupHistory.add({
        type: "restore",
        fileName: file.name,
        recordCounts,
        performedAt: new Date().toISOString(),
        scope: tablesToRestore.length === tablesForModules(ALL_MODULE_KEYS).length ? "full" : "partial",
        format: "json",
        outcome: "success",
        performedBy,
      } as BackupHistoryEntry);

      await SystemLogService.record({
        module: "RESTORE",
        action: "Backup restored",
        performedBy,
        details: `Restored ${tablesToRestore.length} table(s) from ${file.name} (${Object.values(recordCounts).reduce((a, b) => a + b, 0)} total records).`,
      });

      return { success: true, tablesRestored: tablesToRestore, recordCounts };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error during restore.";

      await db.backupHistory.add({
        type: "restore",
        fileName: file.name,
        recordCounts: {},
        performedAt: new Date().toISOString(),
        scope: "partial",
        format: "json",
        outcome: "rolled_back",
        issues: [message],
        performedBy,
      } as BackupHistoryEntry);

      await SystemLogService.record({
        module: "RESTORE",
        action: "Backup restore failed - rolled back",
        performedBy,
        details: `${file.name}: ${message}`,
      });

      return { success: false, tablesRestored: [], recordCounts: {}, error: message };
    }
  }

  async getHistory(): Promise<BackupHistoryEntry[]> {
    const rows = await db.backupHistory.toArray();
    return rows.sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  }
}

export const BackupService = new BackupServiceImpl();
