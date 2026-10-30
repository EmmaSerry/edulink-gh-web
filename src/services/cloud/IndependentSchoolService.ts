/**
 * Super Admin tools for schools whose district is not on EduLink GH yet
 * ("independent" schools) - see STEP-1_independent_schools.sql. Both
 * functions refuse anyone who is not the Super Admin.
 */
import { rest } from "@/lib/supabaseClient";

export interface IndependentSchoolRow {
  school_id: string;
  school_name: string;
  school_code: string | null;
  approval_status: string;
  district_name_manual: string | null;
  circuit: string | null;
  region: string | null;
  is_private: boolean;
  created_at: string;
  admin_name: string | null;
  admin_phone: string | null;
  learner_count: number;
}

class IndependentSchoolServiceImpl {
  list(): Promise<IndependentSchoolRow[]> {
    return rest.rpc<IndependentSchoolRow[]>("list_independent_schools", {});
  }

  linkToDistrict(schoolId: string, districtId: string): Promise<{ schoolName: string; districtName: string }> {
    return rest.rpc<{ schoolName: string; districtName: string }>("link_school_to_district", {
      p_school_id: schoolId,
      p_district_id: districtId,
    });
  }
}

export const IndependentSchoolService = new IndependentSchoolServiceImpl();
