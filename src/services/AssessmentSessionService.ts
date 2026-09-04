import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import { ArchiveService } from "./ArchiveService";
import type { AssessmentSession, AssessmentSessionStatus } from "@models/AssessmentSession";
import { SESSION_STATUS_ORDER } from "@models/AssessmentSession";
import { AuditLogService } from "./AuditLogService";

export class InvalidTransitionError extends Error {}

/** Which statuses a session may move to from its current status
 *  (Module 11 - linear lifecycle, plus admin reopen back to DRAFT).
 *  FINALIZED must also be allowed to reopen to DRAFT - both the Help
 *  page ("An administrator can reopen a finalized assessment") and
 *  LifecyclePanel's own "Reopening requires administrator action"
 *  message document this as a real feature, but this map previously
 *  gave FINALIZED an empty transition list, so there was in fact no
 *  way to reopen one anywhere in the app once reached - a genuine gap
 *  between what the app told users was possible and what the code
 *  actually allowed. changeStatus() below already fully implements
 *  the reopen flow (reason capture, audit log entry, and blocking a
 *  reopen if the term has since been archived) - it only needed to be
 *  reachable from FINALIZED too. */
const ALLOWED_FORWARD: Record<AssessmentSessionStatus, AssessmentSessionStatus[]> = {
  DRAFT: ["COMPLETED"],
  COMPLETED: ["VERIFIED", "DRAFT"],
  VERIFIED: ["FINALIZED", "DRAFT"],
  FINALIZED: ["DRAFT"],
};

class AssessmentSessionServiceImpl extends BaseRepository<AssessmentSession> {
  constructor() {
    super(db.assessmentSessions);
  }

  /** Finds the session for a class+term, creating a fresh DRAFT one the
   *  first time a teacher opens that class/term for assessment. */
  async getOrCreate(classId: number, termId: number): Promise<AssessmentSession> {
    const existing = await db.assessmentSessions
      .where("[classId+termId]")
      .equals([classId, termId])
      .first();
    if (existing) return existing;

    const cls = await db.classes.get(classId);
    const level = cls ? await db.levels.get(cls.levelId) : undefined;
    const now = new Date().toISOString();

    const id = await db.assessmentSessions.add({
      classId,
      termId,
      levelId: cls?.levelId ?? 0,
      assessmentMode: level?.assessmentMode ?? "scored",
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
    });
    return (await db.assessmentSessions.get(id))!;
  }

  async touchLastSaved(sessionId: number): Promise<void> {
    await db.assessmentSessions.update(sessionId, { lastSavedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  /** Moves a session forward (or, for an administrator, back to DRAFT to
   *  reopen) through the Draft -> Completed -> Verified -> Finalized
   *  lifecycle, validating the transition and writing an audit entry. */
  async changeStatus(
    sessionId: number,
    newStatus: AssessmentSessionStatus,
    performedBy: string,
    options?: { reopenReason?: string },
  ): Promise<void> {
    const session = await db.assessmentSessions.get(sessionId);
    if (!session) throw new Error("Assessment session not found");

    const allowed = ALLOWED_FORWARD[session.status];
    if (!allowed.includes(newStatus)) {
      throw new InvalidTransitionError(
        `Cannot move an assessment from ${session.status} to ${newStatus}.`,
      );
    }

    const now = new Date().toISOString();
    const isReopen = newStatus === "DRAFT" && session.status !== "DRAFT";
    const isFinalize = newStatus === "FINALIZED";

    // Phase 5 (Module 1) - a finalized assessment belonging to a closed/
    // archived term can no longer be reopened for editing.
    if (isReopen) {
      await ArchiveService.assertTermEditable(session.termId);
    }

    await db.assessmentSessions.update(sessionId, {
      status: newStatus,
      updatedAt: now,
      ...(isFinalize ? { finalizedAt: now, finalizedBy: performedBy } : {}),
      ...(isReopen ? { reopenedAt: now, reopenedBy: performedBy, reopenReason: options?.reopenReason } : {}),
    });

    await AuditLogService.record(
      sessionId,
      isFinalize ? "FINALIZED" : isReopen ? "REOPENED" : "STATUS_CHANGE",
      performedBy,
      isReopen
        ? `Reopened from ${session.status} back to Draft${options?.reopenReason ? ` - ${options.reopenReason}` : ""}`
        : `Status changed from ${session.status} to ${newStatus}`,
    );
  }

  nextStatusOptions(status: AssessmentSessionStatus): AssessmentSessionStatus[] {
    return ALLOWED_FORWARD[status];
  }

  statusStep(status: AssessmentSessionStatus): number {
    return SESSION_STATUS_ORDER.indexOf(status);
  }
}

export const AssessmentSessionService = new AssessmentSessionServiceImpl();
