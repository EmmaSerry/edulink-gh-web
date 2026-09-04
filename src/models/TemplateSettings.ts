import type { Orientation, PaperSize } from "@models/AppSettings";

/**
 * Module 12 - Report Customization. Kept as its own singleton table
 * (rather than folded into `AppSettings.SystemSettings.report`, which
 * already existed from Phase 1) because it is a distinct concern: these
 * fields specifically control how a *report document* looks and are
 * consumed only by the Phase 4 rendering/PDF/print pipeline, whereas
 * `SystemSettings.report` remains the general app-wide default a school
 * sets once. On first use (Dexie v5 upgrade) this table is seeded FROM
 * the existing `SystemSettings.report` values so nothing is lost or
 * reset - see `db.ts` version(5) upgrade.
 */
export interface TemplateSettings {
  id?: number;
  paperSize: PaperSize;
  orientation: Orientation;
  marginMm: number;
  fontFamily: string;
  fontSizePt: number;
  /** Hex colours used for report headings/table borders - distinct from
   *  the app's own Bootstrap theme colours (`src/styles/theme.css`). */
  primaryColorHex: string;
  secondaryColorHex: string;
  showWatermark: boolean;
  watermarkOpacity: number;
  signatureTitleClassTeacher: string;
  signatureTitleHeadTeacher: string;
  /** Module 9 - batch PDF export: one combined multi-page PDF, or a
   *  separate PDF file per student. */
  batchPdfMode: "single" | "individual";
  updatedAt: string;
}

export const DEFAULT_TEMPLATE_SETTINGS: Omit<TemplateSettings, "id"> = {
  paperSize: "A4",
  orientation: "Portrait",
  marginMm: 15,
  fontFamily: "Segoe UI",
  fontSizePt: 11,
  primaryColorHex: "#1f3864",
  secondaryColorHex: "#2f6fb0",
  showWatermark: false,
  watermarkOpacity: 0.08,
  signatureTitleClassTeacher: "Class Teacher",
  signatureTitleHeadTeacher: "Headteacher",
  batchPdfMode: "individual",
  updatedAt: new Date(0).toISOString(),
};
