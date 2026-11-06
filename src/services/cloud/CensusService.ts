/**
 * District school census - see STEP_district_census.sql. The database limits
 * every call to the Super Admin and the district admin of the census district.
 */
import { rest } from "@/lib/supabaseClient";
import type { CensusLogRow, CensusRow } from "@components/census/censusModel";

type Editable = Omit<CensusRow, "id" | "district_id" | "updated_at">;

export interface CensusLinkInfo {
  token: string;
  active: boolean;
}
export interface CensusSubmission {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  review_note: string | null;
  data: Record<string, unknown> & { n?: Record<string, number> };
}
export interface FeeRate {
  district_id: string;
  circuit_rate: number;
}
export interface FeeAccount {
  id: string;
  name: string;
  school_ids: string[];
  exclusive: boolean;
}
export interface FeePayment {
  id: string;
  account_key: string;
  amount: number;
  paid_on: string;
  note: string | null;
}
export interface PublicInfo {
  ok: boolean;
  district?: string;
  circuits?: string[];
}

class CensusServiceImpl {
  async list(): Promise<CensusRow[]> {
    return rest.select<CensusRow>("district_census_schools", { select: "*", order: "name.asc", limit: 2000 });
  }

  async update(id: string, values: Editable): Promise<CensusRow> {
    const rows = await rest.update<CensusRow>("district_census_schools", { id: `eq.${id}` }, values);
    return rows[0];
  }

  async create(districtId: string, values: Editable): Promise<CensusRow> {
    const rows = await rest.insert<CensusRow>("district_census_schools", { district_id: districtId, ...values });
    return rows[0];
  }

  async remove(id: string): Promise<void> {
    await rest.rpc<void>("delete_census_school", { p_id: id });
  }

  /** Admin: the private link schools use (action: get | renew | on | off). */
  async link(action: "get" | "renew" | "on" | "off" = "get"): Promise<CensusLinkInfo> {
    return rest.rpc<CensusLinkInfo>("census_link_manage", { p_action: action });
  }

  async submissions(): Promise<CensusSubmission[]> {
    return rest.select<CensusSubmission>("district_census_submissions", {
      select: "id,name,status,submitted_at,review_note,data",
      order: "submitted_at.desc",
      limit: 300,
    });
  }

  async review(id: string, action: "approve" | "reject", note?: string): Promise<void> {
    await rest.rpc<unknown>("census_review_submission", { p_id: id, p_action: action, p_note: note ?? null });
  }

  /** Public (no sign-in): used by the school form. */
  async publicInfo(token: string): Promise<PublicInfo> {
    return rest.rpc<PublicInfo>("census_public_info", { p_token: token });
  }

  async publicSubmit(token: string, data: Record<string, unknown>): Promise<string> {
    return rest.rpc<string>("census_public_submit", { p_token: token, p_data: data });
  }

  /** Super Admin only: sports fee accounts. */
  async feeRate(): Promise<FeeRate | null> {
    const r = await rest.select<FeeRate>("district_census_fee_rates", { select: "district_id,circuit_rate", limit: 1 });
    return r[0] ?? null;
  }
  async setFeeRate(districtId: string, rate: number): Promise<void> {
    await rest.rpc<unknown>("census_fee_rate_set", { p_district: districtId, p_rate: rate });
  }
  async feeAccounts(): Promise<FeeAccount[]> {
    return rest.select<FeeAccount>("district_census_accounts", { select: "id,name,school_ids,exclusive", order: "created_at.asc", limit: 200 });
  }
  async saveFeeAccount(id: string | null, districtId: string, name: string, schoolIds: string[], exclusive: boolean): Promise<void> {
    await rest.rpc<unknown>("census_account_save", { p_id: id, p_district: districtId, p_name: name, p_school_ids: schoolIds, p_exclusive: exclusive });
  }
  async deleteFeeAccount(id: string): Promise<void> {
    await rest.rpc<unknown>("census_account_delete", { p_id: id });
  }
  async feePayments(): Promise<FeePayment[]> {
    return rest.select<FeePayment>("district_census_payments", { select: "id,account_key,amount,paid_on,note", order: "paid_on.asc", limit: 5000 });
  }
  async addFeePayment(districtId: string, key: string, amount: number, paidOn: string, note: string): Promise<void> {
    await rest.rpc<unknown>("census_payment_add", { p_district: districtId, p_key: key, p_amount: amount, p_paid_on: paidOn, p_note: note || null });
  }
  async deleteFeePayment(id: string): Promise<void> {
    await rest.rpc<unknown>("census_payment_delete", { p_id: id });
  }

  async history(schoolId: string): Promise<CensusLogRow[]> {
    return rest.select<CensusLogRow>("district_census_log", {
      select: "id,changed_by_name,changed_at,action,changes",
      filters: { school_id: `eq.${schoolId}` },
      order: "changed_at.desc",
      limit: 30,
    });
  }
}

export const CensusService = new CensusServiceImpl();
