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
import { getAllClassReportSummaries, type ClassReportSummary } from "@services/ReportAnalyticsService";
import type { ReportTemplateCode } from "@models/ReportTemplate";

const SAMPLE_LEVELS: Array<{ code: ReportTemplateCode; label: string; icon: string }> = [
  { code: "KG", label: "KG", icon: "bi-flower1" },
  { code: "LOWER_PRIMARY", label: "Lower Primary", icon: "bi-book" },
  { code: "UPPER_PRIMARY", label: "Upper Primary", icon: "bi-journal-bookmark" },
  { code: "JHS", label: "JHS", icon: "bi-mortarboard" },
];

const STATUS_LABELS: Record<ClassReportSummary["assessmentStatus"], { label: string; badge: string }> = {
  NOT_STARTED: { label: "Not started", badge: "text-bg-secondary" },
  DRAFT: { label: "Draft", badge: "text-bg-warning" },
  COMPLETED: { label: "Completed", badge: "text-bg-info" },
  VERIFIED: { label: "Verified", badge: "text-bg-primary" },
  FINALIZED: { label: "Finalized", badge: "text-bg-success" },
};

/** Module 1 - Report Generation Dashboard, the entry point at
 *  /report-cards. Mirrors the Assessment Dashboard's year/term/level
 *  picker pattern (Phase 3) for a consistent UX, then lists every active
 *  class's report-generation progress with a "Manage" action into the
 *  per-class generation/preview/export/print workspace
 *  (`ClassReportManager`, Module 9). */
export function ReportCardsDashboard() {
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

  const [academicYearId, setAcademicYearId] = useState(0);
  const [termId, setTermId] = useState(0);
  const [levelFilter, setLevelFilter] = useState(0);

  const effectiveYearId = academicYearId || currentYear?.id || 0;
  const effectiveTermId = termId || activeTerm?.id || 0;
  const termsForYear = useMemo(() => (terms ?? []).filter((t) => t.academicYearId === effectiveYearId), [terms, effectiveYearId]);

  const summaries = useLiveQuery(
    () => (effectiveTermId ? getAllClassReportSummaries(effectiveTermId) : Promise.resolve(undefined)),
    [effectiveTermId],
  );

  const classById = useMemo(() => new Map((classes ?? []).map((c) => [c.id!, c])), [classes]);
  const levelById = useMemo(() => new Map((levels ?? []).map((l) => [l.id!, l])), [levels]);

  const visible = useMemo(() => {
    if (!summaries) return undefined;
    return summaries
      .filter((s) => !levelFilter || s.levelId === levelFilter)
      .sort((a, b) => {
        const la = levelById.get(a.levelId)?.sortOrder ?? 0;
        const lb = levelById.get(b.levelId)?.sortOrder ?? 0;
        if (la !== lb) return la - lb;
        return (classById.get(a.classId)?.name ?? "").localeCompare(classById.get(b.classId)?.name ?? "");
      });
  }, [summaries, levelFilter, levelById, classById]);

  // A fresh install legitimately has no term set up yet, so
  // `effectiveTermId` is 0 and `summaries` deliberately never resolves
  // to real data (see the short-circuit above) - that is a valid
  // "nothing to show" result, not an unresolved one. Only wait on
  // `visible` when a term is actually selected, otherwise this spins
  // forever instead of reaching the "No term selected" state below.
  const loading = !academicYears || !terms || !levels || !classes || (effectiveTermId !== 0 && visible === undefined);

  return (
    <div>
      <Breadcrumb items={[{ label: "Report Cards" }]} />
      <PageHeader
        title="Report Cards"
        description="Generate, preview, export and print terminal report cards - the correct template is chosen automatically for each student's level."
        phaseBadge="Phase 4"
      />

      <Card className="mb-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <h2 className="h6 mb-1">Preview a sample report card</h2>
            <p className="text-muted small mb-0">
              See what a report card looks like - using your school's real branding and subject/grading setup with a
              made-up learner - before any real students or scores are entered.
            </p>
          </div>
          <div className="d-flex flex-wrap gap-2">
            {SAMPLE_LEVELS.map((lvl) => (
              <button
                key={lvl.code}
                type="button"
                className="btn btn-outline-primary btn-sm"
                onClick={() => navigate(`/report-cards/preview?mode=sample&templateCode=${lvl.code}`)}
              >
                <i className={`bi ${lvl.icon} me-1`} />
                {lvl.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

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
        <LoadingSpinner label="Loading report status…" />
      ) : !effectiveTermId ? (
        <EmptyState icon="bi-calendar-x" title="No term selected" message="Set up an academic year and term first." />
      ) : (visible?.length ?? 0) === 0 ? (
        <EmptyState icon="bi-file-earmark-x" title="No classes to report on" message="No active classes match the selected level." />
      ) : (
        <>
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <Card className="text-center h-100">
                <div className="h4 mb-0">{visible!.reduce((s, c) => s + c.totalStudents, 0)}</div>
                <div className="text-muted small">Students</div>
              </Card>
            </div>
            <div className="col-6 col-md-3">
              <Card className="text-center h-100">
                <div className="h4 mb-0 text-success">{visible!.reduce((s, c) => s + c.generatedCount, 0)}</div>
                <div className="text-muted small">Reports Generated</div>
              </Card>
            </div>
            <div className="col-6 col-md-3">
              <Card className="text-center h-100">
                <div className="h4 mb-0 text-warning">{visible!.reduce((s, c) => s + c.pendingCount, 0)}</div>
                <div className="text-muted small">Reports Pending</div>
              </Card>
            </div>
            <div className="col-6 col-md-3">
              <Card className="text-center h-100">
                <div className="h4 mb-0 text-primary">{visible!.filter((c) => c.assessmentStatus === "FINALIZED").length}</div>
                <div className="text-muted small">Finalized Assessments</div>
              </Card>
            </div>
          </div>

          <Card padded={false}>
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Level</th>
                  <th>Students</th>
                  <th>Generated</th>
                  <th>Pending</th>
                  <th>Assessment Status</th>
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible!.map((s) => {
                  const status = STATUS_LABELS[s.assessmentStatus];
                  return (
                    <tr key={s.classId}>
                      <td className="fw-semibold">{classById.get(s.classId)?.name ?? `#${s.classId}`}</td>
                      <td>{levelById.get(s.levelId)?.name ?? "-"}</td>
                      <td>{s.totalStudents}</td>
                      <td>{s.generatedCount}</td>
                      <td>
                        {s.pendingCount > 0 ? (
                          <span className="badge text-bg-warning">{s.pendingCount} pending</span>
                        ) : (
                          <span className="badge text-bg-success">All generated</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${status.badge}`}>{status.label}</span>
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          disabled={s.totalStudents === 0}
                          onClick={() => navigate(`/report-cards/${s.classId}?termId=${effectiveTermId}`)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </Card>
        </>
      )}
    </div>
  );
}
