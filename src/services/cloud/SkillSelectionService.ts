/**
 * "Which official skills show on the report card this term" (per the
 * KG redesign's item 10) - a teacher's per-class, per-term toggle over
 * the fixed official skill list, never a change to the list itself.
 * See report_skill_selection / set_report_skill_selection() in
 * edulink_gh_phase1c_kg_report_redesign.sql. Absence of a row for a
 * skill means "included" (the default), same as the RPC's own
 * reasoning - a class no one has touched shows every official skill,
 * exactly like before this feature existed.
 */
import { rest } from "@/lib/supabaseClient";
import type { ReportSkillSelectionRow } from "@/types/database";

class CloudSkillSelectionServiceImpl {
  async listForClassTerm(classId: string, termId: string): Promise<ReportSkillSelectionRow[]> {
    return rest.select<ReportSkillSelectionRow>("report_skill_selection", {
      filters: { class_id: `eq.${classId}`, term_id: `eq.${termId}` },
    });
  }

  async setIncluded(classId: string, termId: string, skillId: string, isIncluded: boolean): Promise<void> {
    await rest.rpc<void>("set_report_skill_selection", {
      p_class_id: classId,
      p_term_id: termId,
      p_skill_id: skillId,
      p_is_included: isIncluded,
    });
  }
}

export const CloudSkillSelectionService = new CloudSkillSelectionServiceImpl();
