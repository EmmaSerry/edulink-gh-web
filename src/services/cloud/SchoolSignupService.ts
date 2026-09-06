/**
 * Self-service school registration - see
 * edulink_gh_phase0w_school_self_signup.sql. listDistricts()/
 * listCircuits() are callable before signing in (that's the whole
 * point - populating the form's dropdowns); register() must run AFTER
 * auth.signUpAndSignIn() has put a fresh session in place, since the
 * underlying RPC identifies which account it's setting up via
 * auth.uid(), not a parameter the browser could tamper with.
 */
import { rest } from "@/lib/supabaseClient";
import type { DistrictOption, CircuitOption } from "@/types/database";

export interface SchoolSignupInput {
  schoolName: string;
  districtId: string;
  circuit: string;
  region: string;
  isPrivate: boolean;
  fullName: string;
  phone: string;
}

class CloudSchoolSignupServiceImpl {
  async listDistricts(): Promise<DistrictOption[]> {
    return rest.rpc<DistrictOption[]>("list_districts_for_signup", {});
  }

  async listCircuits(districtId: string): Promise<CircuitOption[]> {
    return rest.rpc<CircuitOption[]>("list_circuits_for_signup", { p_district_id: districtId });
  }

  async register(input: SchoolSignupInput): Promise<{ schoolId: string }> {
    return rest.rpc<{ schoolId: string }>("register_school_self_service", {
      p_school_name: input.schoolName,
      p_district_id: input.districtId,
      p_circuit: input.circuit || null,
      p_region: input.region || null,
      p_is_private: input.isPrivate,
      p_full_name: input.fullName,
      p_phone: input.phone || null,
    });
  }
}

export const CloudSchoolSignupService = new CloudSchoolSignupServiceImpl();
