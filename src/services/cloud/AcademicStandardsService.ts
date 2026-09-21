/**
 * Academic standards summary - see edulink_gh_phase0u_academic_standards.sql
 * and edulink_gh_phase1i_dashboard_and_standards_fixes.sql. Three RPCs,
 * all security definer with their own access checks, so there's nothing
 * extra to guard here.
 */
import { rest } from "@/lib/supabaseClient";
import type { SchoolAcademicStandards, DistrictAcademicStandards } from "@/types/database";

/** Same shape as the school-wide summary, plus the class's own name -
 *  used on a teacher's dashboard instead of the school-wide RPC, see
 *  get_class_academic_standards() in
 *  edulink_gh_phase1i_dashboard_and_standards_fixes.sql. */
export type ClassAcademicStandards = SchoolAcademicStandards & { className: string | null };

class CloudAcademicStandardsServiceImpl {
  async getForSchool(schoolId?: string, termId?: string): Promise<SchoolAcademicStandards> {
    return rest.rpc<SchoolAcademicStandards>("get_school_academic_standards", {
      p_school_id: schoolId ?? null,
      p_term_id: termId ?? null,
    });
  }

  async getForDistrict(termId?: string): Promise<DistrictAcademicStandards> {
    return rest.rpc<DistrictAcademicStandards>("get_district_academic_standards", {
      p_term_id: termId ?? null,
    });
  }

  /** Scoped to one class - what a teacher's dashboard uses so they only
   *  ever see standards for the class they actually teach, never the
   *  whole school. */
  async getForClass(classId: string, termId?: string): Promise<ClassAcademicStandards> {
    return rest.rpc<ClassAcademicStandards>("get_class_academic_standards", {
      p_class_id: classId,
      p_term_id: termId ?? null,
    });
  }
}

export const CloudAcademicStandardsService = new CloudAcademicStandardsServiceImpl();
