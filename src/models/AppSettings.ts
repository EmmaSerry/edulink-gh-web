/** Generic key/value row - used for anything that doesn't warrant its
 *  own table. The structured system settings below are stored as one
 *  row with key = "system". */
export interface AppSettings {
  id?: number;
  key: string;
  value: unknown;
  updatedAt: string;
}

export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type PaperSize = "A4" | "Letter";
export type Orientation = "Portrait" | "Landscape";
export type ExportFormat = "JSON" | "XLSX";

export interface SystemSettings {
  general: {
    applicationName: string;
    version: string;
    defaultLanguage: string;
    dateFormat: DateFormat;
  };
  report: {
    paperSize: PaperSize;
    orientation: Orientation;
    marginMm: number;
    fontFamily: string;
    fontSizePt: number;
  };
  assessment: {
    enableRanking: boolean;
    autoCalculateTotals: boolean;
    autoGeneratePositions: boolean;
  };
  backup: {
    backupReminderEnabled: boolean;
    autoBackupFrequencyDays: number;
    exportFormat: ExportFormat;
  };
  studentId: {
    /** e.g. "ACTRS" */
    prefix: string;
    includeYear: boolean;
    /** Zero-padded width of the sequence number, e.g. 6 -> "000001". */
    sequenceDigits: number;
    /** Global monotonic counter - never resets, never reused, persists
     *  across academic years so IDs stay unique system-wide forever. */
    nextSequence: number;
  };
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  general: {
    applicationName: "Amenfi Central Terminal Report System",
    version: "0.3.0-phase2",
    defaultLanguage: "English",
    dateFormat: "DD/MM/YYYY",
  },
  report: {
    paperSize: "A4",
    orientation: "Portrait",
    marginMm: 15,
    fontFamily: "Segoe UI",
    fontSizePt: 11,
  },
  assessment: {
    enableRanking: true,
    autoCalculateTotals: true,
    autoGeneratePositions: true,
  },
  backup: {
    backupReminderEnabled: true,
    autoBackupFrequencyDays: 7,
    exportFormat: "JSON",
  },
  studentId: {
    prefix: "ACTRS",
    includeYear: true,
    sequenceDigits: 6,
    nextSequence: 1,
  },
};
