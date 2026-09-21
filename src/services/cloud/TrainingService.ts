/**
 * Live/training mode - see edulink_gh_phase1j_training_mode.sql for the
 * full design and every RPC this calls.
 */
import { rest } from "@/lib/supabaseClient";

export interface TrainingEnvironmentInfo {
  districtId: string;
  schoolId: string;
}

export interface TrainingResetResult {
  studentsRemoved: number;
  schoolId: string;
}

export interface TrainingProfile {
  id: string;
  full_name: string;
  role: string;
  school_id: string | null;
  district_id: string | null;
}

class CloudTrainingServiceImpl {
  /** Creates the training district/school if they don't already exist.
   *  Safe to call again later - just returns the existing IDs. */
  async setup(): Promise<TrainingEnvironmentInfo> {
    return rest.rpc<TrainingEnvironmentInfo>("setup_training_environment", {});
  }

  /** Removes every pupil (and everything that hangs off one) from the
   *  training school. Leaves classes/levels/terms/staff accounts alone. */
  async reset(): Promise<TrainingResetResult> {
    return rest.rpc<TrainingResetResult>("reset_training_data", {});
  }

  /** Attaches a training-scoped profile to an auth user you've already
   *  created in Supabase. p_role "district_admin" links into the
   *  training district; every other role links into the training
   *  school. */
  async createAccount(userId: string, fullName: string, role: string, phone?: string): Promise<TrainingProfile> {
    return rest.rpc<TrainingProfile>("create_training_account", {
      p_user_id: userId,
      p_full_name: fullName,
      p_role: role,
      p_phone: phone ?? null,
    });
  }

  /** Whether the given school is the training school - used to look up
   *  the training school's own id/name for the admin screen. */
  async findTrainingSchool(): Promise<{ id: string; name: string } | null> {
    const rows = await rest.select<{ id: string; name: string }>("schools", {
      select: "id,name",
      filters: { is_training: "eq.true" },
      limit: 1,
    });
    return rows[0] ?? null;
  }
}

export const CloudTrainingService = new CloudTrainingServiceImpl();
