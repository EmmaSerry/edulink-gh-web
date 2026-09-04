/**
 * Cloud (Supabase-backed) replacement for src/services/TemplateSettingsService.ts.
 *
 * The offline version is a Dexie singleton (one row, no school
 * concept). The cloud version is one row PER school (see
 * edulink_gh_phase0i_report_rendering.sql, unique on school_id), but
 * get()/save() still map to/from the exact same `TemplateSettings`
 * shape the rendering pipeline (ReportPage, ReportHeader,
 * SignatureBlock, PdfService, every report template) already expects -
 * so those components render a cloud-generated report without any
 * changes at all.
 *
 * Same defensive fallback as the original: get() returns
 * DEFAULT_TEMPLATE_SETTINGS if a school has never saved its own
 * settings yet, rather than failing.
 */

import { rest } from "@/lib/supabaseClient";
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from "@models/TemplateSettings";
import type { TemplateSettingsRow } from "@/types/database";

function fromRow(row: TemplateSettingsRow): TemplateSettings {
  return {
    paperSize: row.paper_size,
    orientation: row.orientation,
    marginMm: row.margin_mm,
    fontFamily: row.font_family,
    fontSizePt: row.font_size_pt,
    primaryColorHex: row.primary_color_hex,
    secondaryColorHex: row.secondary_color_hex,
    showWatermark: row.show_watermark,
    watermarkOpacity: row.watermark_opacity,
    signatureTitleClassTeacher: row.signature_title_class_teacher,
    signatureTitleHeadTeacher: row.signature_title_head_teacher,
    batchPdfMode: row.batch_pdf_mode,
    updatedAt: row.updated_at,
  };
}

class CloudTemplateSettingsServiceImpl {
  async get(schoolId: string): Promise<TemplateSettings> {
    const rows = await rest.select<TemplateSettingsRow>("template_settings", {
      filters: { school_id: `eq.${schoolId}` },
      limit: 1,
    });
    return rows[0] ? fromRow(rows[0]) : { ...DEFAULT_TEMPLATE_SETTINGS };
  }

  async save(schoolId: string, values: Omit<TemplateSettings, "updatedAt">): Promise<TemplateSettings> {
    const patch = {
      paper_size: values.paperSize,
      orientation: values.orientation,
      margin_mm: values.marginMm,
      font_family: values.fontFamily,
      font_size_pt: values.fontSizePt,
      primary_color_hex: values.primaryColorHex,
      secondary_color_hex: values.secondaryColorHex,
      show_watermark: values.showWatermark,
      watermark_opacity: values.watermarkOpacity,
      signature_title_class_teacher: values.signatureTitleClassTeacher,
      signature_title_head_teacher: values.signatureTitleHeadTeacher,
      batch_pdf_mode: values.batchPdfMode,
      updated_at: new Date().toISOString(),
    };

    const existing = await rest.select<TemplateSettingsRow>("template_settings", {
      select: "id",
      filters: { school_id: `eq.${schoolId}` },
      limit: 1,
    });

    const [row] =
      existing.length > 0
        ? await rest.update<TemplateSettingsRow>("template_settings", { school_id: `eq.${schoolId}` }, patch)
        : await rest.insert<TemplateSettingsRow>("template_settings", { school_id: schoolId, ...patch });

    return fromRow(row);
  }
}

export const CloudTemplateSettingsService = new CloudTemplateSettingsServiceImpl();
