import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { DeveloperCredit } from "@components/DeveloperCredit";
import { MiniBarChart } from "@components/MiniBarChart";
import { MiniDonut } from "@components/MiniDonut";
import { MiniLineChart } from "@components/MiniLineChart";
import { useDatabaseSummary } from "@hooks/useDatabaseSummary";
import { useAppInfo } from "@hooks/useAppInfo";
import { useStudentDirectory } from "@hooks/useStudentDirectory";
import { AcademicYearService } from "@services/AcademicYearService";
import { getAllClassSummaries } from "@services/AssessmentProgressService";
import { getReportActivityStats } from "@services/ReportAnalyticsService";
import {
  getSchoolOverview,
  getSubjectAverages,
  getGradeBandDistribution,
  getPassRate,
  getAttendanceSummary,
  getOverallAverage,
} from "@services/AnalyticsService";
import { db } from "@database/db";
import { Link } from "react-router-dom";

/** Administration Dashboard summary cards, per Phase 1 Module list. */
const SUMMARY_CARDS: Array<{ key: string; label: string; icon: string }> = [
  { key: "schools", label: "Schools Configured", icon: "bi-building" },
  { key: "academicYears", label: "Academic Years", icon: "bi-calendar3" },
  { key: "activeTerm", label: "Active Term", icon: "bi-calendar-check" },
  { key: "levels", label: "Levels", icon: "bi-layers" },
  { key: "classes", label: "Classes", icon: "bi-people" },
  { key: "subjects", label: "Subjects", icon: "bi-journal-bookmark" },
  { key: "skills", label: "KG Skills", icon: "bi-list-check" },
  { key: "gradeBands", label: "Grade Bands", icon: "bi-bar-chart-steps" },
  { key: "remarksBank", label: "Remarks", icon: "bi-chat-square-text" },
];

export function Dashboard() {
  const { summary, loading } = useDatabaseSummary();
  const { app } = useAppInfo();
  const directory = useStudentDirectory();
  const currentYear = useLiveQuery(() => AcademicYearService.getAll().then((ys) => ys.find((y) => y.isCurrent)), []);

  const genderCounts = directory
    ? { M: directory.filter((r) => r.student.gender === "M").length, F: directory.filter((r) => r.student.gender === "F").length }
    : { M: 0, F: 0 };

  const byLevel = useLiveQuery(async () => {
    const levels = await db.levels.toArray();
    const rows = directory ?? [];
    return levels
      .map((l) => ({ label: l.name, value: rows.filter((r) => r.levelId === l.id).length }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [directory]);

  const byClass = useLiveQuery(async () => {
    const classes = await db.classes.toArray();
    const rows = directory ?? [];
    return classes
      .map((c) => ({ label: c.name, value: rows.filter((r) => r.classId === c.id).length }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [directory]);

  const newAdmissions = directory && currentYear
    ? directory.filter((r) => r.student.academicYearOfAdmissionId === currentYear.id).length
    : 0;
  const activeStudents = directory ? directory.filter((r) => r.student.status === "ACTIVE").length : 0;
  const inactiveStudents = directory ? directory.length - activeStudents : 0;

  // Module 14 - Assessment Dashboard enhancements, surfaced on the main
  // Dashboard too so a head teacher sees assessment progress without
  // leaving the overview page.
  const activeTerm = useLiveQuery(() => db.terms.filter((t) => t.isActive).first(), []);
  const assessmentSummaries = useLiveQuery(
    () => (activeTerm?.id ? getAllClassSummaries(activeTerm.id) : Promise.resolve(undefined)),
    [activeTerm?.id],
  );

  const assessmentStats = assessmentSummaries
    ? {
        totalClasses: assessmentSummaries.length,
        notStarted: assessmentSummaries.filter((s) => s.status === "NOT_STARTED").length,
        inProgress: assessmentSummaries.filter((s) => s.status === "DRAFT" || s.status === "COMPLETED").length,
        verified: assessmentSummaries.filter((s) => s.status === "VERIFIED").length,
        finalized: assessmentSummaries.filter((s) => s.status === "FINALIZED").length,
        studentsMissing: assessmentSummaries.reduce((sum, s) => sum + (s.totalStudents - s.fullyAssessedStudents), 0),
        kgClasses: assessmentSummaries.filter((s) => s.assessmentMode === "skill-checklist"),
      }
    : undefined;
  const kgFullyRated = assessmentStats
    ? assessmentStats.kgClasses.filter((s) => s.totalStudents > 0 && s.fullyAssessedStudents === s.totalStudents).length
    : 0;

  // Module 14 - Report Card dashboard enhancements.
  const reportStats = useLiveQuery(
    () => (activeTerm?.id ? getReportActivityStats(activeTerm.id) : Promise.resolve(undefined)),
    [activeTerm?.id],
  );

  // Module 4 (Phase 5) - Dashboard & Analytics.
  const schoolOverview = useLiveQuery(() => getSchoolOverview(activeTerm?.id), [activeTerm?.id]);
  const subjectAverages = useLiveQuery(
    () => (activeTerm?.id ? getSubjectAverages(activeTerm.id) : Promise.resolve(undefined)),
    [activeTerm?.id],
  );
  const gradeBandDistribution = useLiveQuery(
    () => (activeTerm?.id ? getGradeBandDistribution(activeTerm.id) : Promise.resolve(undefined)),
    [activeTerm?.id],
  );
  const passRate = useLiveQuery(
    () => (activeTerm?.id ? getPassRate(activeTerm.id) : Promise.resolve(undefined)),
    [activeTerm?.id],
  );
  const attendanceSummary = useLiveQuery(
    () => (activeTerm?.id ? getAttendanceSummary(activeTerm.id) : Promise.resolve(undefined)),
    [activeTerm?.id],
  );
  const performanceTrend = useLiveQuery(async () => {
    if (!currentYear?.id) return undefined;
    const yearTerms = (await db.terms.where("academicYearId").equals(currentYear.id).toArray())
      .sort((a, b) => a.termNumber - b.termNumber);
    const points = await Promise.all(
      yearTerms.map(async (t) => ({ label: t.termName, value: await getOverallAverage(t.id!) })),
    );
    return points.filter((p) => p.value > 0);
  }, [currentYear?.id]);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${app.name} — administration overview`}
        phaseBadge={app.phase}
      />

      <Card className="mb-4">
        <h2 className="h6">Welcome</h2>
        <p className="text-muted mb-0">
          ACTRS is a complete, offline-first school information system: configuration,
          student management, assessments, report card generation/printing, and the
          records/archiving, backup, analytics and search tools below - all running
          entirely in this browser, with no server or internet connection required.
        </p>
      </Card>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card>
            <div className="text-muted small">Total Students</div>
            <div className="fs-2 fw-bold" style={{ color: "var(--actrs-navy)" }}>{directory?.length ?? "—"}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card>
            <div className="text-muted small">Active Students</div>
            <div className="fs-2 fw-bold text-success">{directory ? activeStudents : "—"}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card>
            <div className="text-muted small">Inactive Students</div>
            <div className="fs-2 fw-bold text-secondary">{directory ? inactiveStudents : "—"}</div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card>
            <div className="text-muted small">New Admissions{currentYear ? ` (${currentYear.label})` : ""}</div>
            <div className="fs-2 fw-bold" style={{ color: "var(--actrs-blue)" }}>{directory ? newAdmissions : "—"}</div>
          </Card>
        </div>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <Card className="h-100">
            <h2 className="h6 mb-3">Gender distribution</h2>
            <MiniDonut
              segments={[
                { label: "Male", value: genderCounts.M, color: "var(--actrs-navy)" },
                { label: "Female", value: genderCounts.F, color: "var(--actrs-blue)" },
              ]}
            />
          </Card>
        </div>
        <div className="col-md-4">
          <Card className="h-100">
            <h2 className="h6 mb-3">Students by level</h2>
            <MiniBarChart data={byLevel ?? []} />
          </Card>
        </div>
        <div className="col-md-4">
          <Card className="h-100">
            <h2 className="h6 mb-3">Students by class (top 8)</h2>
            <MiniBarChart data={byClass ?? []} color="var(--actrs-navy)" />
          </Card>
        </div>
      </div>

      <Card className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h6 mb-0">Assessment progress{activeTerm ? ` - ${activeTerm.termName}` : ""}</h2>
          <Link to="/assessments" className="btn btn-sm btn-outline-primary">
            Open Assessments <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
        {!activeTerm ? (
          <p className="text-muted mb-0">No active term is set - configure one under Terms to see assessment progress here.</p>
        ) : !assessmentStats ? (
          <p className="text-muted mb-0">Loading…</p>
        ) : assessmentStats.totalClasses === 0 ? (
          <p className="text-muted mb-0">No active classes yet - add classes under Levels &amp; Classes.</p>
        ) : (
          <div className="row g-3">
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold">{assessmentStats.totalClasses}</div>
                <div className="small text-muted">Classes</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold text-secondary">{assessmentStats.notStarted}</div>
                <div className="small text-muted">Not started</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold text-warning">{assessmentStats.inProgress}</div>
                <div className="small text-muted">Draft / in progress</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold text-primary">{assessmentStats.verified}</div>
                <div className="small text-muted">Verified</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold text-success">{assessmentStats.finalized}</div>
                <div className="small text-muted">Finalized</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold" style={{ color: assessmentStats.studentsMissing > 0 ? "var(--actrs-warning)" : undefined }}>
                  {assessmentStats.studentsMissing}
                </div>
                <div className="small text-muted">Students with missing scores/ratings</div>
              </div>
            </div>
            {assessmentStats.kgClasses.length > 0 && (
              <div className="col-12">
                <div className="p-3 rounded-3 bg-light">
                  <span className="fw-semibold">KG completion: </span>
                  {kgFullyRated} of {assessmentStats.kgClasses.length} KG class{assessmentStats.kgClasses.length === 1 ? "" : "es"} fully
                  rated (every skill, every student).
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h6 mb-0">Report cards{activeTerm ? ` - ${activeTerm.termName}` : ""}</h2>
          <Link to="/report-cards" className="btn btn-sm btn-outline-primary">
            Open Report Cards <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
        {!activeTerm ? (
          <p className="text-muted mb-0">No active term is set - configure one under Terms to see report activity here.</p>
        ) : !reportStats ? (
          <p className="text-muted mb-0">Loading…</p>
        ) : (
          <div className="row g-3">
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold" style={{ color: "var(--actrs-navy)" }}>{reportStats.generatedToday}</div>
                <div className="small text-muted">Generated today</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold text-warning">{reportStats.pendingTotal}</div>
                <div className="small text-muted">Reports pending</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold text-success">{reportStats.finalizedClassesReadyForPrinting}</div>
                <div className="small text-muted">Classes ready to print</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold">{reportStats.printsToday}</div>
                <div className="small text-muted">Prints today</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="fs-4 fw-bold">{reportStats.exportsToday}</div>
                <div className="small text-muted">PDF exports today</div>
              </div>
            </div>
            <div className="col-6 col-md-4 col-lg-2">
              <div className="p-3 rounded-3 h-100 bg-light">
                <div className="small fw-bold">
                  {reportStats.lastPdfExportAt ? new Date(reportStats.lastPdfExportAt).toLocaleString() : "—"}
                </div>
                <div className="small text-muted">Last PDF export</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 className="h6 mb-0">Performance analytics{activeTerm ? ` - ${activeTerm.termName}` : ""}</h2>
          <Link to="/archives" className="btn btn-sm btn-outline-primary">
            Compare years <i className="bi bi-arrow-right ms-1" />
          </Link>
        </div>
        {!activeTerm ? (
          <p className="text-muted mb-0">No active term is set - configure one under Terms to see performance analytics here.</p>
        ) : (
          <>
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 h-100 bg-light">
                  <div className="fs-4 fw-bold" style={{ color: "var(--actrs-navy)" }}>{schoolOverview?.teachersConfigured ?? "—"}</div>
                  <div className="small text-muted">Class teachers configured</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 h-100 bg-light">
                  <div className="fs-4 fw-bold text-success">{passRate ? `${passRate.pct}%` : "—"}</div>
                  <div className="small text-muted">Pass rate ({passRate?.totalCount ?? 0} scored entries)</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 h-100 bg-light">
                  <div className="fs-4 fw-bold" style={{ color: "var(--actrs-blue)" }}>{attendanceSummary ? `${attendanceSummary.averagePct}%` : "—"}</div>
                  <div className="small text-muted">Average attendance ({attendanceSummary?.studentsRecorded ?? 0} of {attendanceSummary?.totalStudents ?? 0} recorded)</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="p-3 rounded-3 h-100 bg-light">
                  <div className="fs-4 fw-bold">{schoolOverview ? `${schoolOverview.boys}/${schoolOverview.girls}` : "—"}</div>
                  <div className="small text-muted">Boys / Girls (active)</div>
                </div>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-md-4">
                <h3 className="h6 small text-muted">Subject averages</h3>
                <MiniBarChart data={(subjectAverages ?? []).slice(0, 8).map((s) => ({ label: s.name, value: s.average }))} />
              </div>
              <div className="col-md-4">
                <h3 className="h6 small text-muted">Grade band distribution</h3>
                {gradeBandDistribution && gradeBandDistribution.length > 0 ? (
                  <MiniDonut segments={gradeBandDistribution.map((g) => ({ label: g.label, value: g.count, color: g.color }))} />
                ) : (
                  <p className="text-muted small mb-0">No scored entries yet.</p>
                )}
              </div>
              <div className="col-md-4">
                <h3 className="h6 small text-muted">Performance trend ({currentYear?.label ?? "current year"})</h3>
                <MiniLineChart data={performanceTrend ?? []} />
              </div>
            </div>
          </>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="h6 mb-3">Configuration summary</h2>
        {loading || !summary ? (
          <p className="text-muted mb-0">Loading…</p>
        ) : (
          <div className="row g-3">
            {SUMMARY_CARDS.map((card) => (
              <div className="col-6 col-md-4 col-lg-3" key={card.key}>
                <div className="p-3 rounded-3 h-100" style={{ background: "var(--actrs-blue-light)" }}>
                  <i className={`bi ${card.icon} mb-2 d-block`} style={{ color: "var(--actrs-navy)" }} />
                  <div className="fs-4 fw-bold" style={{ color: "var(--actrs-navy)" }}>
                    {(summary as Record<string, number>)[card.key] ?? 0}
                  </div>
                  <div className="small text-muted">{card.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <DeveloperCredit variant="full" />
      </Card>
    </>
  );
}
