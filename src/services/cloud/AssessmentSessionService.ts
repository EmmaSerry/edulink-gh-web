/**
 * Cloud (Supabase-backed) replacement for
 * src/services/AssessmentSessionService.ts.
 *
 * The Draft -> Completed -> Verified -> Finalized lifecycle rules (plus
 * the admin reopen-to-Draft path) now live in change_assessment_status()
 * on the server (see edulink_gh_phase0d_assessment.sql), not only in
 * this file - so the rule holds even if some future screen forgets to
 * check nextStatusOptions() before offering a button. This file keeps a
 * client-side copy of the same table purely so the UI can show/hide the
 * right buttons without a round trip; the server has the final say.
 */

import { rest } from "@/lib/supabaseClient";
import type { AssessmentSessionRow, AssessmentSessionStatus } from "@/types/database";

export class InvalidTransitionError extends Error {}

const ALLOWED_FORWARD: Record<AssessmentSessionStatus, AssessmentSessionStatus[]> = {
  DRAFT: ["COMPLETED"],
  COMPLETED: ["VERIFIED", "DRAFT"],
  VERIFIED: ["FINALIZED", "DRAFT"],
  FINALIZED: ["DRAFT"],
};

const SESSION_STATUS_ORDER: AssessmentSessionStatus[] = ["DRAFT", "COMPLETED", "VERIFIED", "FINALIZED"];

class CloudAssessmentSessionServiceImpl {
  /** Opens (creating as DRAFT if needed) the assessment session for a
   *  class + term. */
  async getOrCreate(classId: string, termId: string): Promise<AssessmentSessionRow> {
    return rest.rpc<AssessmentSessionRow>("get_or_create_assessment_session", {
      p_class_id: classId,
      p_term_id: termId,
    });
  }

  /** Moves a session forward, or - for an administrator - back to DRAFT
   *  to reopen it. Validates the transition client-side first (a fast,
   *  friendly error) and again on the server (the one that actually
   *  matters, since this file can't be trusted to be the only caller). */
  async changeStatus(
    sessionId: string,
    currentStatus: AssessmentSessionStatus,
    newStatus: AssessmentSessionStatus,
    options?: { reopenReason?: string }
  ): Promise<AssessmentSessionRow> {
    if (!ALLOWED_FORWARD[currentStatus].includes(newStatus)) {
      throw new InvalidTransitionError(
        `Cannot move an assessment from ${currentStatus} to ${newStatus}.`
      );
    }
    return rest.rpc<AssessmentSessionRow>("change_assessment_status", {
      p_session_id: sessionId,
      p_new_status: newStatus,
      p_reopen_reason: options?.reopenReason ?? null,
    });
  }

  nextStatusOptions(status: AssessmentSessionStatus): AssessmentSessionStatus[] {
    return ALLOWED_FORWARD[status];
  }

  statusStep(status: AssessmentSessionStatus): number {
    return SESSION_STATUS_ORDER.indexOf(status);
  }
}

export const CloudAssessmentSessionService = new CloudAssessmentSessionServiceImpl();
