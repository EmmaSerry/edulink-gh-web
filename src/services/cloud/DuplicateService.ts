/**
 * Duplicate warnings. Each call asks the database (see
 * STEP-B_duplicate_checks.sql) for likely matches within the caller's
 * class / school / district. A failed check never blocks the user: it
 * returns an empty list and the normal action goes ahead.
 */
import { rest } from "@/lib/supabaseClient";

export interface LearnerMatch {
  student_id: string | null;
  full_name: string;
  date_of_birth: string | null;
  status: string;
  class_name: string | null;
  school_name: string;
  scope: "class" | "school" | "district";
  match_kind: "exact" | "similar" | "same_name";
}

export interface UserMatch {
  user_id: string;
  full_name: string;
  role: string;
  school_name: string | null;
  is_active: boolean;
  scope: "school" | "district";
  reason: string;
}

export interface SchoolMatch {
  school_name: string;
  circuit: string | null;
  approval_status: string;
  match_kind: "same" | "similar";
}

export const DuplicateService = {
  async learners(input: {
    schoolId: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dateOfBirth: string;
    classId?: string | null;
    excludeStudentId?: string | null;
  }): Promise<LearnerMatch[]> {
    try {
      return await rest.rpc<LearnerMatch[]>("find_duplicate_learners", {
        p_school_id: input.schoolId,
        p_first_name: input.firstName,
        p_last_name: input.lastName,
        p_date_of_birth: input.dateOfBirth,
        p_middle_name: input.middleName || null,
        p_class_id: input.classId ?? null,
        p_exclude_student_id: input.excludeStudentId ?? null,
      });
    } catch {
      return [];
    }
  },

  async users(input: { fullName: string; phone?: string | null; email?: string | null; excludeUserId?: string | null }): Promise<UserMatch[]> {
    try {
      return await rest.rpc<UserMatch[]>("find_duplicate_users", {
        p_full_name: input.fullName,
        p_phone: input.phone ?? null,
        p_email: input.email ?? null,
        p_exclude_user_id: input.excludeUserId ?? null,
      });
    } catch {
      return [];
    }
  },

  async schools(input: { name: string; districtId?: string | null; districtName?: string | null }): Promise<SchoolMatch[]> {
    try {
      return await rest.rpc<SchoolMatch[]>("find_similar_schools", {
        p_name: input.name,
        p_district_id: input.districtId ?? null,
        p_district_name: input.districtName ?? null,
      });
    } catch {
      return [];
    }
  },
};

export function describeLearnerMatch(m: LearnerMatch): { title: string; detail: string } {
  const kind =
    m.match_kind === "exact"
      ? "Same name and date of birth"
      : m.match_kind === "similar"
        ? "Same date of birth and a similar name"
        : "Same name, different date of birth";
  const where =
    m.scope === "district"
      ? `at ${m.school_name}`
      : m.scope === "class"
        ? `in this class (${m.class_name ?? "same class"})`
        : `in this school${m.class_name ? ` (${m.class_name})` : ""}`;
  const status = m.status && m.status !== "ACTIVE" ? ` · ${m.status.toLowerCase().replace("_", " ")}` : "";
  const dob = m.date_of_birth ? ` · born ${m.date_of_birth}` : "";
  return { title: `${m.full_name}`, detail: `${kind} ${where}${dob}${status}` };
}

/** Plain "OK / Cancel" prompt listing the matches. true = carry on anyway. */
export function confirmDuplicates(heading: string, lines: string[]): boolean {
  if (typeof window === "undefined") return true;
  return window.confirm(`${heading}\n\n${lines.map((l) => `• ${l}`).join("\n")}\n\nPress OK to continue anyway, or Cancel to go back and check.`);
}

export class DuplicateCancelled extends Error {
  constructor(message = "Cancelled - nothing was saved.") {
    super(message);
    this.name = "DuplicateCancelled";
  }
}
