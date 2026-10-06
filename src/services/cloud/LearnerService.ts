/**
 * Learner lists (with school / class / level / gender filters) and the
 * statistics page - see edulink_gh_phase1o_learners_and_statistics.sql.
 * The database decides which schools the signed-in person may see.
 */
import { rest } from "@/lib/supabaseClient";

export type LevelGroup = "KG" | "LOWER_PRIMARY" | "UPPER_PRIMARY" | "JHS";

export const LEVEL_GROUP_LABEL: Record<string, string> = {
  KG: "KG",
  LOWER_PRIMARY: "Lower Primary",
  UPPER_PRIMARY: "Upper Primary",
  JHS: "JHS",
  UNPLACED: "Not placed",
};

export interface LearnerFilters {
  schoolId?: string;
  gender?: "M" | "F";
  className?: string;
  levelGroup?: LevelGroup;
  status?: string; // "" = every status
  search?: string;
}

export interface LearnerRow {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  gender: "M" | "F";
  date_of_birth: string;
  age: number | null;
  status: string;
  photo_url: string | null;
  school_id: string;
  school_name: string;
  class_name: string | null;
  level_name: string | null;
  level_group: string | null;
  total_count: number;
}

export interface LearnerFilterOptions {
  schools: { id: string; name: string }[];
  classNames: string[];
}

export interface StatsFilters {
  schoolId?: string;
  gender?: "M" | "F";
  className?: string;
  levelGroup?: LevelGroup;
  minAge?: number;
  maxAge?: number;
}

export interface GenderCount {
  male: number;
  female: number;
  total: number;
}

export interface LearnerStatistics {
  total: number;
  male: number;
  female: number;
  byLevelGroup: ({ group: string } & GenderCount)[];
  byClass: ({ label: string } & GenderCount)[];
  byAge: ({ age: number } & GenderCount)[];
  bySchool: ({ id: string; name: string } & GenderCount)[];
}

class LearnerServiceImpl {
  filterOptions(): Promise<LearnerFilterOptions> {
    return rest.rpc<LearnerFilterOptions>("get_learner_filter_options", {});
  }

  list(f: LearnerFilters, limit: number, offset: number): Promise<LearnerRow[]> {
    return rest.rpc<LearnerRow[]>("list_learners", {
      p_school_id: f.schoolId ?? null,
      p_gender: f.gender ?? null,
      p_class_name: f.className ?? null,
      p_level_group: f.levelGroup ?? null,
      p_status: f.status === "" ? null : (f.status ?? "ACTIVE"),
      p_search: f.search?.trim() ? f.search.trim() : null,
      p_limit: limit,
      p_offset: offset,
    });
  }

  statistics(f: StatsFilters): Promise<LearnerStatistics> {
    return rest.rpc<LearnerStatistics>("get_learner_statistics", {
      p_school_id: f.schoolId ?? null,
      p_gender: f.gender ?? null,
      p_class_name: f.className ?? null,
      p_level_group: f.levelGroup ?? null,
      p_min_age: f.minAge ?? null,
      p_max_age: f.maxAge ?? null,
      p_status: "ACTIVE",
    });
  }
}

export const LearnerService = new LearnerServiceImpl();
