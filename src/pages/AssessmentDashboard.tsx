import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";
import { AcademicYearService } from "@services/AcademicYearService";
import { TermService } from "@services/TermService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { getAllClassSummaries, type ClassAssessmentSummary } from "@services/AssessmentProgressService";
import type { AssessmentSessionStatus } from "@models/AssessmentSession";

/** Module 1 - Assessment Dashboard: the entry point at /assessments.
 *  Lets a teacher/head teacher pick an academic year + term, see every
 *  class's assessment mode (auto-detected, never chosen manually),
 *  completion status and lifecycle stage, then jump into that class's
 *  workspace. This page only READS session state - opening a class for
 *  the first time is what creates its AssessmentSession (see
 *  AssessmentSessionService.getOrCreate, called from the workspace). */
export function AssessmentDashboard() {
  const navigate = useNavigate();
  const academicYears = useLiveQuery(() => AcademicYearService.getAll(), []);
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);

  const currentYear = useMemo(() => academicYears?.find((y) => y.isCurrent), [academicYears]);
  const activeTerm = useMemo(
    () => terms?.find((t) => t.isActive && (!currentYear || t.academicYearId === currentYear.id)),
    [terms, currentYear],
  );

  const [academicYearId, setAcademicYearId] = useState<number>(0);
  const [termId, setTermId] = useState<number>(0);
  const [levelFilter, setLevelFilter] = useState<number>(0);

  const effectiveYearId = academicYearId || currentYear?.id || 0;
  const effectiveTermId = termId || activeTerm?.id || 0;

  const termsForYear = useMemo(
    () => (terms ?? []).filter((t) => t.academicYearId === effectiveYearId),
    [terms, effectiveYearId],
  );

  const summaries = useLiveQuery(
    () => (effectiveTermId ? getAllClassSummaries(effectiveTermId) : Promise.resolve(undefined)),
    [effectiveTermId],
  );

  const classById = useMemo(() => new Map((classes ?? []).map((c) => [c.id!, c])), [classes]);
  const levelById = useMemo(() => new Map((levels ?? []).map((l) => [l.id!, l])), [levels]);

  const visibleSummaries = useMemo(() => {
    if (!summaries) return undefined;
    return summaries
      .filter((s) => !levelFilter || s.levelId === levelFilter)
      .sort((a, b) => {
        const la = levelById.get(a.levelId)?.sortOrder ?? 0;
        const lb = levelById.get(b.levelId)?.sortOrder ?? 0;
        if (la !== lb) return la - lb;
        const ca = classById.get(a.classId)?.name ?? "";
        const cb = classById.get(b.classId)?.name ?? "";
        return ca.localeCompare(cb);
      });
  }, [summaries, levelFilter, levelById, classById]);

  const totals = useMemo(() => {
    if (!visibleSummaries) return null;
    return {
      classes: visibleSummaries.length,
      finalized: visibleSummaries.filter((s) => s.status === "FINALIZED").length,
      verified: visibleSummaries.filter((s) => s.status === "VERIFIED").length,
      draft: visibleSummaries.filter((s) => s.status === "DRAFT" || s.status === "COMPLETED").length,
      notStarted: visibleSummaries.filter((s) => s.status === "NOT_STARTED").length,
    };
  }, [visibleSummaries]);

  // A fresh installation legitimately has no academic year/term set up
  // yet, so `effectiveTermId` is 0 and the summaries query deliberately
  // short-circuits to `Promise.resolve(undefined)` (see above) rather
  // than ever running - that is a valid, resolved "nothing to show"
  // result, not an unresolved one. Counting `visibleSummaries ===
  // undefined` as "still loading" in that case meant this page spun
  // forever on first run instead of ever reaching the "No term
  // selected" empty state below - only treat it as loading when a term
  // actually is selected and its summary hasn't come back yet.
  const loading =
    !academicYears || !terms || !levels || !classes || (effectiveTermId !== 0 && visibleSummaries === undefined);

  return (
    <div>
      <Breadcrumb items={[{ label: "Assessments" }]} />
      <PageHeader
        title="Assessments"
        description="Score entry for scored levels, skill ratings for KG - the mode is auto-detected per class, never chosen manually."
        phaseBadge="Phase 3"
      />

      <Card className="mb-4">
        <div className="row g-3">
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold">Academic Year</label>
            <select
              className="form-select"
              value={effectiveYearId}
              onChange={(e) => {
                setAcademicYearId(Number(e.target.value));
                setTermId(0);
              }}
            >
              {(academicYears ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.label}
                  {y.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold">Term</label>
            <select className="form-select" value={effectiveTermId} onChange={(e) => setTermId(Number(e.target.value))}>
              {termsForYear.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.termName}
                  {t.isActive ? " (active)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12 col-md-4">
            <label className="form-label small fw-semibold">Level</label>
            <select className="form-select" value={levelFilter} onChange={(e) => setLevelFilter(Number(e.target.value))}>
              <option value={0}>All levels</option>
              {(levels ?? [])
                .filter((l) => l.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner label="Loading assessment status…" />
      ) : !effectiveTermId ? (
        <EmptyState
          icon="bi-calendar-x"
          title="No term selected"
          message="Set up an academic year and term under Academic Years / Terms first, then come back here to begin assessments."
        />
      ) : (visibleSummaries?.length ?? 0) === 0 ? (
        <EmptyState
          icon="bi-clipboard-x"
          title="No classes to assess"
          message="No active classes match the selected level. Add classes under Levels & Classes."
        />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <SummaryTile label="Classes" value={totals!.classes} icon="bi-collection" />
            <SummaryTile label="Not started" value={totals!.notStarted} icon="bi-dash-circle" tone="secondary" />
            <SummaryTile label="Draft / in progress" value={totals!.draft} icon="bi-pencil-square" tone="warning" />
            <SummaryTile label="Verified" value={totals!.verified} icon="bi-check2-circle" tone="info" />
            <SummaryTile label="Finalized" value={totals!.finalized} icon="bi-lock-fill" tone="success" />
          </div>

          <Card padded={false}>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Level</th>
                    <th>Mode</th>
                    <th>Students</th>
                    <th>Completion</th>
                    <th>Status</th>
                    <th>Last saved</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSummaries!.map((s) => (
                    <ClassRow
                      key={s.classId}
                      summary={s}
                      className={classById.get(s.classId)?.name ?? `#${s.classId}`}
                      levelName={levelById.get(s.levelId)?.name ?? "—"}
                      onOpen={() => navigate(`/assessments/${s.classId}?termId=${effectiveTermId}`)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
  tone = "primary",
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "primary" | "secondary" | "warning" | "info" | "success";
}) {
  return (
    <div className="col-6 col-md">
      <Card className="text-center h-100">
        <i className={`bi ${icon} text-${tone}`} style={{ fontSize: "1.5rem" }} />
        <div className="h4 mb-0 mt-2">{value}</div>
        <div className="text-muted small">{label}</div>
      </Card>
    </div>
  );
}

const STATUS_LABELS: Record<AssessmentSessionStatus | "NOT_STARTED", { label: string; badge: string }> = {
  NOT_STARTED: { label: "Not started", badge: "text-bg-secondary" },
  DRAFT: { label: "Draft", badge: "text-bg-warning" },
  COMPLETED: { label: "Completed", badge: "text-bg-info" },
  VERIFIED: { label: "Verified", badge: "text-bg-primary" },
  FINALIZED: { label: "Finalized", badge: "text-bg-success" },
};

function ClassRow({
  summary,
  className,
  levelName,
  onOpen,
}: {
  summary: ClassAssessmentSummary;
  className: string;
  levelName: string;
  onOpen: () => void;
}) {
  const pct = summary.totalStudents ? Math.round((summary.fullyAssessedStudents / summary.totalStudents) * 100) : 0;
  const status = STATUS_LABELS[summary.status];

  return (
    <tr>
      <td className="fw-semibold">{className}</td>
      <td>{levelName}</td>
      <td>
        <span className="badge text-bg-light border">
          {summary.assessmentMode === "skill-checklist" ? "KG skill ratings" : "Scored"}
        </span>
      </td>
      <td>{summary.totalStudents}</td>
      <td style={{ minWidth: 160 }}>
        {summary.totalStudents === 0 ? (
          <span className="text-muted small">No students enrolled</span>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <div className="progress flex-grow-1" style={{ height: 6 }}>
              <div
                className={`progress-bar ${pct === 100 ? "bg-success" : "bg-primary"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="small text-muted">{pct}%</span>
          </div>
        )}
        {summary.missingStudentNames.length > 0 && summary.missingStudentNames.length <= 3 && (
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
            Missing: {summary.missingStudentNames.join(", ")}
          </div>
        )}
        {summary.missingStudentNames.length > 3 && (
          <div className="text-muted" style={{ fontSize: "0.75rem" }}>
            Missing {summary.missingStudentNames.length} students
          </div>
        )}
      </td>
      <td>
        <span className={`badge rounded-pill ${status.badge}`}>{status.label}</span>
      </td>
      <td className="text-muted small">
        {summary.lastSavedAt ? new Date(summary.lastSavedAt).toLocaleString() : "—"}
      </td>
      <td className="text-end">
        <button type="button" className="btn btn-sm btn-primary" onClick={onOpen} disabled={summary.totalStudents === 0}>
          {summary.status === "NOT_STARTED" ? "Start" : "Open"}
        </button>
      </td>
    </tr>
  );
}
