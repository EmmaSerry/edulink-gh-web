/**
 * Mock Examination Analysis - thin client over the mock_* database functions.
 * All security is enforced in the database (see STEP-1_edulink_gh_mock_exams_core.sql);
 * nothing here reads or writes terminal-report tables.
 */
import { rest } from "@/lib/supabaseClient";
import type { GradingConfig, GradeBand, MockCandidate, MockMark, MockSubject, CoreKey } from "@/mock/mockEngine";

export type MockStatus = "draft" | "open" | "entry_closed" | "finalised";

export interface MockListItem {
  id: string;
  schoolId: string;
  schoolName: string;
  name: string;
  status: MockStatus;
  academicYearId: string | null;
  academicYearLabel: string;
  startDate: string | null;
  endDate: string | null;
  seriesKey: string | null;
  candidates: number;
  subjects: number;
  marksRecorded: number;
  completeAggregates: number;
}

export interface SavedScheme {
  id: string;
  name: string;
  maxMark: number;
  lowerIsBetter: boolean;
  scaleType: "nine_grade" | "custom";
  allowDecimals: boolean;
  bands: GradeBand[];
  isDefault: boolean;
}

export interface EligibleCandidate {
  studentId: string;
  studentRef: string | null;
  fullName: string;
  gender: string | null;
  classId: string;
  className: string;
  isJhs3: boolean;
}

export interface CatalogueSubject {
  id: string;
  name: string;
  code: string | null;
}

export interface MockDetails {
  id: string;
  schoolId: string;
  schoolName: string;
  schoolCode: string | null;
  name: string;
  description: string | null;
  notes: string | null;
  seriesKey: string | null;
  academicYearId: string | null;
  academicYearLabel: string;
  startDate: string | null;
  endDate: string | null;
  status: MockStatus;
  grading: GradingConfig;
  targetAggregate: number | null;
  finalisedAt: string | null;
}

export interface StoredResult {
  candidateId: string;
  status: "complete" | "incomplete" | "no_results" | "absent";
  aggregate: number | null;
  contributing: Array<{ code: string; name: string; grade: number; isCore: boolean }>;
  missingCore: string[];
  electiveCount: number;
}

export interface MockFull {
  mock: MockDetails;
  role: string;
  canWrite: boolean;
  subjects: MockSubject[];
  candidates: MockCandidate[];
  marks: MockMark[];
  results: StoredResult[];
  assignments: Array<{ subjectId: string; teacherId: string }>;
}

export interface MarkEntry {
  candidateId: string;
  subjectId: string;
  mark?: number | null;
  absent?: boolean;
  clear?: boolean;
}

export interface CreateMockPayload {
  name: string;
  description?: string;
  notes?: string;
  seriesKey?: string;
  academicYearId: string;
  startDate?: string;
  endDate?: string;
  schemeId: string;
  targetAggregate?: number | null;
  subjects: Array<{
    code: string;
    name: string;
    subjectId?: string | null;
    isCore: boolean;
    coreKey?: CoreKey | null;
    maxMark: number;
    targetPct?: number | null;
  }>;
  candidates: Array<{ studentId: string; excluded?: boolean; reason?: string }>;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity: string | null;
  candidateId: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  recalculated: boolean;
  by: string | null;
  at: string;
}

class MockExamServiceImpl {
  list(academicYearId?: string | null) {
    return rest.rpc<MockListItem[]>("mock_list", { p_academic_year_id: academicYearId ?? null });
  }
  getFull(mockId: string) {
    return rest.rpc<MockFull>("mock_get_full", { p_mock_id: mockId });
  }
  listSchemes() {
    return rest.rpc<SavedScheme[]>("mock_list_schemes", {});
  }
  saveScheme(s: Omit<SavedScheme, "id"> & { id?: string | null }) {
    return rest.rpc<string>("mock_save_scheme", {
      p_id: s.id ?? null,
      p_name: s.name,
      p_max_mark: s.maxMark,
      p_lower_is_better: s.lowerIsBetter,
      p_scale_type: s.scaleType,
      p_allow_decimals: s.allowDecimals,
      p_bands: s.bands,
      p_is_default: s.isDefault,
    });
  }
  deleteScheme(id: string) {
    return rest.rpc<void>("mock_delete_scheme", { p_id: id });
  }
  eligibleCandidates(includeAll: boolean) {
    return rest.rpc<EligibleCandidate[]>("mock_eligible_candidates", { p_include_all: includeAll });
  }
  catalogueSubjects() {
    return rest.rpc<CatalogueSubject[]>("mock_catalogue_subjects", {});
  }
  create(payload: CreateMockPayload) {
    return rest.rpc<string>("mock_create", { p_payload: payload });
  }
  saveMarks(mockId: string, entries: MarkEntry[], reason?: string) {
    return rest.rpc<{ saved: number }>("mock_save_marks", { p_mock_id: mockId, p_entries: entries, p_reason: reason ?? null });
  }
  setStatus(mockId: string, status: MockStatus, reason?: string, acknowledge = false) {
    return rest.rpc<{ status: MockStatus }>("mock_set_status", {
      p_mock_id: mockId,
      p_status: status,
      p_reason: reason ?? null,
      p_acknowledge: acknowledge,
    });
  }
  setCandidateStatus(candidateId: string, status: "registered" | "excluded" | "absent_all", reason?: string) {
    return rest.rpc<void>("mock_set_candidate_status", { p_candidate_id: candidateId, p_status: status, p_reason: reason ?? null });
  }
  updateDetails(mockId: string, targetAggregate: number | null, notes: string, subjectTargets: Array<{ subjectId: string; targetPct: number | null }>) {
    return rest.rpc<void>("mock_update_details", {
      p_mock_id: mockId,
      p_target_aggregate: targetAggregate,
      p_notes: notes,
      p_subject_targets: subjectTargets,
    });
  }
  remove(mockId: string) {
    return rest.rpc<void>("mock_delete", { p_mock_id: mockId });
  }
  audit(mockId: string) {
    return rest.rpc<AuditEntry[]>("mock_audit_list", { p_mock_id: mockId, p_limit: 300 });
  }
  exceptions(mockId: string) {
    return rest.rpc<Array<{ kind: string; detail: Record<string, unknown>; reason: string; by: string | null; at: string }>>(
      "mock_exceptions_list",
      { p_mock_id: mockId }
    );
  }
}

export const MockExamService = new MockExamServiceImpl();

export const STATUS_LABEL: Record<MockStatus, string> = {
  draft: "Draft",
  open: "Open for entry",
  entry_closed: "Entry closed",
  finalised: "Finalised",
};
