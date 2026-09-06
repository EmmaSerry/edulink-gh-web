/**
 * Settings -> Staff. Creating a staff member is two steps under the
 * hood (see edulink_gh_phase0o_staff_and_classes.sql for why it's split
 * this way): first a real Supabase Auth account via
 * auth.signUpWithoutSession() (needs the anon key only, never disturbs
 * the admin's own session), then a user_profiles row linking that new
 * account to this school via the create_staff_profile() RPC. Both
 * happen from create() below so the rest of the app only ever sees one
 * call.
 */
import { auth, rest } from "@/lib/supabaseClient";
import type { UserProfileRow, UserRole } from "@/types/database";

export type StaffRole = Extract<UserRole, "teacher" | "bursar" | "school_admin">;

export interface CreateStaffInput {
  email: string;
  fullName: string;
  role: StaffRole;
  phone: string | null;
}

export interface CreateStaffResult {
  profile: UserProfileRow;
  tempPassword: string;
}

export interface UpdateStaffInput {
  fullName: string;
  role: StaffRole;
  phone: string | null;
}

/** A random, easy-to-read-aloud temporary password - handed to the
 *  admin once on screen so they can share it with the new staff member
 *  (e.g. by SMS or in person). Avoids visually ambiguous characters
 *  (0/O, 1/l/I) since it may need to be read off a phone screen. */
function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

class CloudStaffServiceImpl {
  async list(): Promise<UserProfileRow[]> {
    return rest.rpc<UserProfileRow[]>("list_school_staff", {});
  }

  /** Blocks the staff member from every pupil-facing table (see
   *  edulink_gh_phase0p_staff_archiving.sql) - does not disable their
   *  actual sign-in credential, which needs Supabase's admin API and is
   *  deliberately out of scope for a browser-side app. */
  async archive(userId: string): Promise<UserProfileRow> {
    return rest.rpc<UserProfileRow>("archive_staff", { p_user_id: userId });
  }

  async reactivate(userId: string): Promise<UserProfileRow> {
    return rest.rpc<UserProfileRow>("reactivate_staff", { p_user_id: userId });
  }

  async create(input: CreateStaffInput): Promise<CreateStaffResult> {
    const tempPassword = generateTempPassword();
    let id: string;
    try {
      id = (await auth.signUpWithoutSession(input.email, tempPassword)).id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (/already registered/i.test(message)) {
        throw new Error(
          `${input.email} already has a sign-in account, most likely left over from an earlier attempt that ` +
            "didn't finish. In Supabase, go to Authentication -> Users, delete that account, then try again here."
        );
      }
      throw err;
    }
    const profile = await rest.rpc<UserProfileRow>("create_staff_profile", {
      p_user_id: id,
      p_full_name: input.fullName,
      p_role: input.role,
      p_phone: input.phone,
    });
    return { profile, tempPassword };
  }

  /** Name/role/phone only - email isn't editable here, see
   *  edulink_gh_phase0q_staff_edit.sql for why. */
  async update(userId: string, input: UpdateStaffInput): Promise<UserProfileRow> {
    return rest.rpc<UserProfileRow>("update_staff_profile", {
      p_user_id: userId,
      p_full_name: input.fullName,
      p_role: input.role,
      p_phone: input.phone,
    });
  }
}

export const CloudStaffService = new CloudStaffServiceImpl();
