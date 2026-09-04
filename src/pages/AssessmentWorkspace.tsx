import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";
import { useToast } from "@contexts/ToastContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { db } from "@database/db";
import { EnrollmentService } from "@services/EnrollmentService";
import { AssessmentSessionService } from "@services/AssessmentSessionService";
import { isEditable, type AssessmentSessionStatus } from "@models/AssessmentSession";
import { getClassAssessmentSummary } from "@services/AssessmentProgressService";
import { ScoreEntryGrid } from "./assessments/ScoreEntryGrid";
import { KGSkillGrid } from "./assessments/KGSkillGrid";
import { TeacherRemarksPanel } from "./assessments/TeacherRemarksPanel";
import { LifecyclePanel, LifecycleStatusBadge, STATUS_META } from "@components/LifecyclePanel";

/**
 * The Phase 3 assessment workspace at /assessments/:classId?termId=.
 * Auto-detects scored vs skill-checklist mode from the class's Level
 * (Module 2 requirement: "teachers should never have to manually
 * choose") and hosts the matching entry grid, plus the lifecycle
 * controls shared by both modes (Module 11).
 *
 * Opening this page is what CREATES the class's AssessmentSession the
 * first time (via getOrCreate) - the Dashboard itself only reads.
 */
export function AssessmentWorkspace() {
  const { classId: classIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const currentUser = useCurrentUser();
  const [nameDraft, setNameDraft] = useState("");

  const classId = Number(classIdParam);
  const termId = Number(searchParams.get("termId"));

  const cls = useLiveQuery(() => (classId ? db.classes.get(classId) : undefined), [classId]);
  const term = useLiveQuery(() => (termId ? db.terms.get(termId) : undefined), [termId]);
  const level = useLiveQuery(() => (cls?.levelId ? db.levels.get(cls.levelId) : undefined), [cls?.levelId]);
  const roster = useLiveQuery(
    () => (classId && termId ? EnrollmentService.getRoster(termId, classId) : undefined),
    [classId, termId],
  );

  const [sessionId, setSessionId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (classId && termId) {
      AssessmentSessionService.getOrCreate(classId, termId).then((session) => {
        if (!cancelled) setSessionId(session.id!);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [classId, termId]);

  const session = useLiveQuery(() => (sessionId ? db.assessmentSessions.get(sessionId) : undefined), [sessionId]);

  const loading = !cls || !term || !level || !roster || !session;

  // Previously defaulted to collapsed, hidden behind a toggle button
  // with no visual cue anything was inside - a real accessibility
  // complaint from a working ICT coordinator, not a hypothetical one.
  // Expanded by default now; the toggle still lets it be tucked away
  // once a teacher doesn't need it anymore this session.
  const [showLifecycle, setShowLifecycle] = useState(true);
  const [activeTab, setActiveTab] = useState<"entry" | "remarks">("entry");

  async function handleStatusChange(newStatus: AssessmentSessionStatus, reopenReason?: string) {
    if (!session?.id) return;

    // Module 9/11 - a class cannot move past Draft until every student
    // has been fully assessed (every subject scored, or for KG every
    // skill rated). Reopening back to Draft is always allowed since it
    // only ever loosens the gate, never tightens it.
    const movesForward = newStatus !== "DRAFT";
    if (movesForward) {
      const summary = await getClassAssessmentSummary(classId, termId);
      if (summary.totalStudents > 0 && summary.fullyAssessedStudents < summary.totalStudents) {
        showToast(
          `${summary.totalStudents - summary.fullyAssessedStudents} student(s) are not fully assessed yet - complete every ${
            summary.assessmentMode === "skill-checklist" ? "skill rating" : "subject score"
          } before moving this class forward.`,
          "error",
        );
        return;
      }
    }

    try {
      await AssessmentSessionService.changeStatus(session.id, newStatus, currentUser.name, { reopenReason });
      showToast(`Assessment marked as ${STATUS_META[newStatus].label}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change status.", "error");
    }
  }

  if (!classId || !termId) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Assessments", path: "/assessments" }, { label: "Class" }]} />
        <EmptyState
          icon="bi-exclamation-triangle"
          title="Missing class or term"
          message="Open this page from the Assessment Dashboard so a class and term are selected."
        />
      </div>
    );
  }

  if (!currentUser.isSet) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Assessments", path: "/assessments" }, { label: "Class" }]} />
        <PageHeader title="Who is assessing this class?" phaseBadge="Phase 3" />
        <div style={{ maxWidth: 480 }}>
        <Card>
          <p className="text-muted">
            ACTRS keeps a full audit trail of every score and status change (Module 12). Enter your name once so it
            can attribute your entries - this is not a login, just an audit label.
          </p>
          <div className="d-flex gap-2">
            <input
              className="form-control"
              placeholder="e.g. Mr. Mensah"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameDraft.trim()) currentUser.setName(nameDraft.trim());
              }}
              autoFocus
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!nameDraft.trim()}
              onClick={() => currentUser.setName(nameDraft.trim())}
            >
              Continue
            </button>
          </div>
        </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Assessments", path: "/assessments" },
          { label: cls?.name ?? "Class" },
        ]}
      />
      <PageHeader
        title={cls ? `${cls.name} - ${term?.termName ?? ""}` : "Assessment"}
        description={
          level
            ? level.assessmentMode === "skill-checklist"
              ? "KG skill ratings (Gold / Silver / Bronze / X / O) - no scores, totals or rankings, per the NaCCA Kindergarten Assessment Tool."
              : "SBA + Exam entry with automatic totals, grade bands and class rankings."
            : undefined
        }
        phaseBadge="Phase 3"
        actions={
          session ? (
            <div className="d-flex align-items-center gap-2">
              <LifecycleStatusBadge status={session.status} />
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowLifecycle((v) => !v)}>
                <i className={`bi ${showLifecycle ? "bi-chevron-up" : "bi-shield-check"} me-1`} />
                {showLifecycle ? "Hide Lifecycle" : "Lifecycle"}
              </button>
            </div>
          ) : undefined
        }
      />

      {showLifecycle && session && (
        <Card className="mb-4">
          <LifecyclePanel session={session} onChange={handleStatusChange} />
        </Card>
      )}

      {loading ? (
        <LoadingSpinner label="Loading class roster…" />
      ) : (roster?.length ?? 0) === 0 ? (
        <EmptyState
          icon="bi-people"
          title="No students enrolled"
          message="This class has no students enrolled for the selected term yet. Assign students under Students - Class Enrollment first."
        />
      ) : (
        <>
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === "entry" ? "active" : ""}`} onClick={() => setActiveTab("entry")}>
                <i className="bi bi-grid-3x3 me-1" />
                {level!.assessmentMode === "skill-checklist" ? "Skill Ratings" : "Score Entry"}
              </button>
            </li>
            <li className="nav-item">
              <button type="button" className={`nav-link ${activeTab === "remarks" ? "active" : ""}`} onClick={() => setActiveTab("remarks")}>
                <i className="bi bi-chat-left-text me-1" />
                Teacher Remarks
              </button>
            </li>
          </ul>

          {activeTab === "entry" ? (
            level!.assessmentMode === "skill-checklist" ? (
              <KGSkillGrid
                classId={classId}
                termId={termId}
                levelId={cls!.levelId}
                sessionId={session!.id!}
                roster={roster!}
                readOnly={!isEditable(session!.status)}
                performedBy={currentUser.name}
                onSaved={() => AssessmentSessionService.touchLastSaved(session!.id!)}
              />
            ) : (
              <ScoreEntryGrid
                classId={classId}
                termId={termId}
                levelId={cls!.levelId}
                sessionId={session!.id!}
                roster={roster!}
                readOnly={!isEditable(session!.status)}
                performedBy={currentUser.name}
                onSaved={() => AssessmentSessionService.touchLastSaved(session!.id!)}
              />
            )
          ) : (
            <TeacherRemarksPanel
              termId={termId}
              levelId={cls!.levelId}
              sessionId={session!.id!}
              roster={roster!}
              readOnly={!isEditable(session!.status)}
              performedBy={currentUser.name}
              assessmentMode={level!.assessmentMode}
              onSaved={() => AssessmentSessionService.touchLastSaved(session!.id!)}
            />
          )}
        </>
      )}
    </div>
  );
}
