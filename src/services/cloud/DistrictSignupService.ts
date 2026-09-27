/**
 * Self-service district registration - see
 * edulink_gh_district_signup.sql. Same auth.uid()-identifies-the-
 * account pattern as CloudSchoolSignupService.register(): register()
 * must run AFTER auth.signUpAndSignIn() has put a fresh session in
 * place.
 */
import { rest } from "@/lib/supabaseClient";

export interface DistrictSignupInput {
  districtName: string;
  region: string;
  fullName: string;
  phone: string;
}

class CloudDistrictSignupServiceImpl {
  async register(input: DistrictSignupInput): Promise<{ districtId: string }> {
    return rest.rpc<{ districtId: string }>("register_district_self_service", {
      p_district_name: input.districtName,
      p_region: input.region || null,
      p_full_name: input.fullName,
      p_phone: input.phone || null,
    });
  }
}

export const CloudDistrictSignupService = new CloudDistrictSignupServiceImpl();
