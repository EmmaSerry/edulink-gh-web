/**
 * Account directory + password reset for district/platform admins - see
 * edulink_gh_phase0v_user_directory.sql (the read side) and the
 * admin-reset-password Edge Function (the reset side, which needs the
 * service_role key and so cannot be a plain RPC - see that function's
 * own comments for why).
 */
import { rest, edgeFunctions } from "@/lib/supabaseClient";
import type { UserDirectoryRow } from "@/types/database";

class CloudUserDirectoryServiceImpl {
  async list(): Promise<UserDirectoryRow[]> {
    return rest.rpc<UserDirectoryRow[]>("list_users_for_admin", {});
  }

  /** Returns the new temporary password - shown once, same convention
   *  as creating a staff account. Nothing about it is ever stored. */
  async resetPassword(targetUserId: string): Promise<string> {
    const result = await edgeFunctions.invoke<{ tempPassword: string }>("admin-reset-password", { targetUserId });
    return result.tempPassword;
  }
}

export const CloudUserDirectoryService = new CloudUserDirectoryServiceImpl();
