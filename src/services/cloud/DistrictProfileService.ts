import { rest } from "@/lib/supabaseClient";

export interface DistrictProfile {
  id: string;
  name: string;
  region: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  address: string | null;
  director_name: string | null;
  logo_data_url: string | null;
}

class DistrictProfileServiceImpl {
  /** null when the signed-in account has no district of its own (Super Admin). */
  get(): Promise<DistrictProfile | null> {
    return rest.rpc<DistrictProfile | null>("get_district_profile", {});
  }

  async save(
    districtId: string,
    v: { name: string; region: string; phone: string; email: string; address: string; director: string }
  ): Promise<void> {
    void districtId;
    await rest.rpc<void>("update_district_profile", {
      p_name: v.name,
      p_region: v.region,
      p_contact_phone: v.phone,
      p_contact_email: v.email,
      p_address: v.address,
      p_director_name: v.director,
    });
  }
}

export const DistrictProfileService = new DistrictProfileServiceImpl();
