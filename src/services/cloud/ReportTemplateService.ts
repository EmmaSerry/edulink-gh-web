/**
 * Cloud (Supabase-backed) replacement for src/services/ReportTemplateService.ts.
 *
 * resolveTemplateCodeForLevel() uses PostgREST's array-contains filter
 * (`cs.{...}`) to ask the database directly "which active template
 * lists this level" rather than fetching every template and filtering
 * in the browser - the same answer, less data moved.
 *
 * assignLevelToTemplate() calls the assign_level_to_template()
 * function so a level moving from one template to another is one
 * atomic operation, not two separate updates that could leave a level
 * belonging to zero or two templates if the second update failed.
 */

import { rest } from "@/lib/supabaseClient";
import type { ReportTemplateRow, ReportTemplateCode } from "@/types/database";

class CloudReportTemplateServiceImpl {
  async getByCode(schoolId: string, code: ReportTemplateCode): Promise<ReportTemplateRow | null> {
    const rows = await rest.select<ReportTemplateRow>("report_templates", {
      filters: { school_id: `eq.${schoolId}`, code: `eq.${code}` },
      limit: 1,
    });
    return rows[0] ?? null;
  }

  async resolveTemplateCodeForLevel(levelId: string): Promise<ReportTemplateCode | undefined> {
    const rows = await rest.select<ReportTemplateRow>("report_templates", {
      filters: { is_active: "eq.true", applies_to_level_ids: `cs.{${levelId}}` },
      limit: 1,
    });
    return rows[0]?.code;
  }

  async assignLevelToTemplate(
    schoolId: string,
    levelId: string,
    templateCode: ReportTemplateCode
  ): Promise<void> {
    await rest.rpc<void>("assign_level_to_template", {
      p_school_id: schoolId,
      p_level_id: levelId,
      p_template_code: templateCode,
    });
  }
}

export const CloudReportTemplateService = new CloudReportTemplateServiceImpl();
