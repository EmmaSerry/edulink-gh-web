/**
 * Academic standards summary - see edulink_gh_phase0u_academic_standards.sql.
 * Two RPCs, both security definer with their own access checks, so
 * there's nothing extra to guard here.
 */
import { rest } from "@/lib/supabaseClient";
import type { SchoolAcademicStandards, DistrictAcademicStandards } from "@/types/database";

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
}

export const CloudAcademicStandardsService = new CloudAcademicStandardsServiceImpl();
