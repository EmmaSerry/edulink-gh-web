import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";
import { Modal } from "@components/Modal";
import { useToast } from "@contexts/ToastContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { getFullName, type Student } from "@models/Student";
import { EnrollmentService } from "@services/EnrollmentService";
import { ReportGenerationService } from "@services/ReportGenerationService";
import { TemplateSettingsService } from "@services/TemplateSettingsService";
import { buildClassSnapshots } from "@services/ReportDataService";
import { generatePdfFromPages, downloadBlob, sanitizeFileNamePart } from "@services/PdfService";
import { printReports } from "@services/PrintService";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { GeneratedReport } from "@models/GeneratedReport";
import { ReportHistoryModal } from "./ReportHistoryModal";
import { AssessmentSessionService } from "@services/AssessmentSessionService";
import { getClassAssessmentSummary } from "@services/AssessmentProgressService";
import type { AssessmentSessionStatus } from "@models/AssessmentSession";
import { LifecyclePanel, LifecycleStatusBadge } from "@components/LifecyclePanel";

interface RosterRow {
  student: Student;
  report?: GeneratedReport;
  stale: boolean;
}

/**
 * Module 9 - Batch Report Generation, hosted inside the per-class
 * management view reached from the Report Dashboard's "Manage" action.
 * Also covers Modules 7/8/10's "Selected Students" / "Entire Class"
 * scope for preview, PDF export and printing, so a teacher never has to
 * leave this screen to produce an entire class's reports.
 */
export function ClassReportManager() {
  const { classId: classIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currentUser = useCurrentUser();

  const classId = Number(classIdParam);
  const termId = Number(searchParams.get("termId"));

  const cls = useLiveQuery(() => (classId ? db.classes.get(classId) : undefined), [classId]);
  const term = useLiveQuery(() => (termId ? db.terms.get(termId) : undefined), [termId]);
  const level = useLiveQuery(() => (cls?.levelId ? db.levels.get(cls.levelId) : undefined), [cls?.levelId]);
  const settings = useLiveQuery(() => TemplateSettingsService.get(), []);

  const rosterRows = useLiveQuery(async (): Promise<RosterRow[] | undefined> => {
    if (!classId || !termId) return undefined;
    const enrollments = await EnrollmentService.getRoster(termId, classId);
    const students = await db.students.bulkGet(enrollments.map((e) => e.studentId));
    const rows: RosterRow[] = [];
    for (const student of students) {
      if (!student) continue;
      const report = await ReportGenerationService.getCurrent(student.id!, termId);
      const stale = report ? await ReportGenerationService.isStale(report) : false;
      rows.push({ student, report, stale });
    }
    return rows.sort((a, b) => getFullName(a.student).localeCompare(getFullName(b.student)));
  }, [classId, termId]);

  // Module 15 - the assessment lifecycle status (Draft/Completed/
  // Verified/Finalized) previously had zero visibility on this screen
  // at all - a teacher producing report cards had no way to see or
  // change it without leaving for the separate Assessments module.
  // Surfaced here directly, expanded by default (not hidden behind a
  // toggle), reusing the exact same status logic as AssessmentWorkspace.
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [showLifecycle, setShowLifecycle] = useState(true);

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

  async function handleStatusChange(newStatus: AssessmentSessionStatus, reopenReason?: string) {
    if (!session?.id) return;
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
      showToast(`Assessment marked as ${newStatus.charAt(0) + newStatus.slice(1).toLowerCase()}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not change status.", "error");
    }
  }

  const [historyStudent, setHistoryStudent] = useState<{ id: number; name: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failures, setFailures] = useState<Array<{ studentId: number; name: string; issues: string[] }>>([]);
  const [exportSnapshots, setExportSnapshots] = useState<{ snapshots: ReportSnapshot[]; purpose: "pdf-single" | "pdf-individual" } | null>(
    null,
  );

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (checked: boolean) => {
    if (!rosterRows) return;
    setSelected(checked ? new Set(rosterRows.map((r) => r.student.id!)) : new Set());
  };

  async function runGenerate(studentIds?: number[]) {
    if (!classId || !termId) return;
    setFailures([]);
    setProgress({ done: 0, total: studentIds?.length ?? rosterRows?.length ?? 0 });
    try {
      const results = await ReportGenerationService.generateForClass(classId, termId, currentUser.name, studentIds, (done, total) =>
        setProgress({ done, total }),
      );
      const failed = results.filter((r) => !r.success);
      if (failed.length === 0) {
        showToast(`Generated ${results.length} report(s).`, "success");
      } else {
        // The validation issues themselves were always computed (see
        // ReportDataService.validateReportPrerequisites) but never
        // actually reached the screen - the toast told a teacher
        // something failed without ever saying what, a dead end with no
        // way to know what to fix. Surfaced below the toolbar instead.
        setFailures(
          failed.map((r) => {
            const row = rosterRows?.find((rr) => rr.student.id === r.studentId);
            return {
              studentId: r.studentId,
              name: row ? getFullName(row.student) : `Student #${r.studentId}`,
              issues: r.validation?.issues.map((i) => i.message) ?? ["Unknown error - please try again."],
            };
          }),
        );
        showToast(
          `${results.length - failed.length} generated, ${failed.length} could not be generated - see the details below.`,
          "error",
        );
      }
    } finally {
      setProgress(null);
    }
  }

  function goToPreview(studentIds?: number[]) {
    const qs = new URLSearchParams({ classId: String(classId), termId: String(termId) });
    if (studentIds?.length) qs.set("studentIds", studentIds.join(","));
    navigate(`/report-cards/preview?${qs.toString()}`);
  }

  const buildSnapshotsFor = useCallback(
    async (studentIds?: number[]) => {
      const map = await buildClassSnapshots(classId, termId);
      let list = Array.from(map.entries());
      if (studentIds?.length) {
        const idSet = new Set(studentIds);
        list = list.filter(([id]) => idSet.has(id));
      }
      return list.map(([, snap]) => snap).sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
    },
    [classId, termId],
  );

  async function handleExportPdf(studentIds?: number[]) {
    if (!settings) return;
    const snapshots = await buildSnapshotsFor(studentIds);
    if (snapshots.length === 0) {
      showToast("Nothing to export.", "error");
      return;
    }
    setExportSnapshots({
      snapshots,
      purpose: snapshots.length > 1 && settings.batchPdfMode === "single" ? "pdf-single" : "pdf-individual",
    });
  }

  async function handlePdfSurfaceReady(pageElements: HTMLElement[]) {
    if (!exportSnapshots || !settings) return;
    try {
      if (exportSnapshots.purpose === "pdf-single") {
        const blob = await generatePdfFromPages(pageElements, { paperSize: settings.paperSize, orientation: settings.orientation });
        const fileName = `${sanitizeFileNamePart(cls?.name ?? "class")}-${sanitizeFileNamePart(term?.termName ?? "term")}.pdf`;
        downloadBlob(blob, fileName);
        for (const snap of exportSnapshots.snapshots) {
          const row = await db.students.where("studentId").equals(snap.student.studentId).first();
          if (row?.id) await ReportGenerationService.recordExport(row.id, termId, currentUser.name, "batch", fileName);
        }
        showToast(`Exported 1 combined PDF (${exportSnapshots.snapshots.length} reports).`, "success");
      } else {
        // Individual mode: one PDF per student. Sequential with a short
        // delay so the browser doesn't block/drop rapid multi-file
        // downloads (a zip archive would need an additional library
        // outside this project's approved tech stack).
        for (let i = 0; i < exportSnapshots.snapshots.length; i++) {
          const snap = exportSnapshots.snapshots[i];
          const blob = await generatePdfFromPages([pageElements[i]], { paperSize: settings.paperSize, orientation: settings.orientation });
          const fileName = `${sanitizeFileNamePart(snap.student.fullName)}-${sanitizeFileNamePart(snap.term.termName)}.pdf`;
          downloadBlob(blob, fileName);
          const row = await db.students.where("studentId").equals(snap.student.studentId).first();
          if (row?.id) await ReportGenerationService.recordExport(row.id, termId, currentUser.name, "batch", fileName);
          if (i < exportSnapshots.snapshots.length - 1) await new Promise((r) => setTimeout(r, 350));
        }
        showToast(`Exported ${exportSnapshots.snapshots.length} individual PDF(s).`, "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "PDF export failed.", "error");
    } finally {
      setExportSnapshots(null);
    }
  }

  async function handlePrint(studentIds?: number[]) {
    if (!settings) return;
    const snapshots = await buildSnapshotsFor(studentIds);
    if (snapshots.length === 0) {
      showToast("Nothing to print.", "error");
      return;
    }
    await printReports(snapshots, settings);
    for (const snap of snapshots) {
      const row = await db.students.where("studentId").equals(snap.student.studentId).first();
      if (row?.id) await ReportGenerationService.recordPrint(row.id, termId, currentUser.name);
    }
  }

  const loading = !cls || !term || !level || !rosterRows || !settings;
  const selectedCount = selected.size;

  return (
    <div>
      <Breadcrumb items={[{ label: "Report Cards", path: "/report-cards" }, { label: cls?.name ?? "Class" }]} />
      <PageHeader
        title={cls ? `${cls.name} - ${term?.termName ?? ""}` : "Report Cards"}
        description="Generate, preview, export and print this class's report cards."
        phaseBadge="Phase 4"
        actions={
          <div className="d-flex align-items-center gap-2">
            {session && (
              <>
                <LifecycleStatusBadge status={session.status} />
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowLifecycle((v) => !v)}>
                  <i className={`bi ${showLifecycle ? "bi-chevron-up" : "bi-shield-check"} me-1`} />
                  {showLifecycle ? "Hide Lifecycle" : "Lifecycle"}
                </button>
              </>
            )}
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/report-cards")}>
              <i className="bi bi-arrow-left me-1" />
              Back to Dashboard
            </button>
          </div>
        }
      />

      {showLifecycle && session && (
        <Card className="mb-3">
          <h2 className="h6 mb-3">Assessment Lifecycle</h2>
          <LifecyclePanel session={session} onChange={handleStatusChange} />
        </Card>
      )}

      {loading ? (
        <LoadingSpinner label="Loading class roster…" />
      ) : rosterRows!.length === 0 ? (
        <EmptyState icon="bi-people" title="No students enrolled" message="This class has no students enrolled for this term." />
      ) : (
        <>
          <Card className="mb-3">
            <div className="d-flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => runGenerate()}>
                <i className="bi bi-lightning-charge me-1" />
                Generate Entire Class
              </button>
              <button type="button" className="btn btn-outline-primary btn-sm" disabled={selectedCount === 0} onClick={() => runGenerate([...selected])}>
                Generate Selected ({selectedCount})
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => goToPreview()}>
                <i className="bi bi-eye me-1" />
                Preview Class
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={selectedCount === 0} onClick={() => goToPreview([...selected])}>
                Preview Selected
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handleExportPdf()}>
                <i className="bi bi-file-earmark-pdf me-1" />
                Export Class PDF
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={selectedCount === 0}
                onClick={() => handleExportPdf([...selected])}
              >
                Export Selected PDF
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => handlePrint()}>
                <i className="bi bi-printer me-1" />
                Print Class
              </button>
              <button type="button" className="btn btn-outline-secondary btn-sm" disabled={selectedCount === 0} onClick={() => handlePrint([...selected])}>
                Print Selected
              </button>
            </div>
          </Card>

          {failures.length > 0 && (
            <Card className="mb-3 border-danger-subtle">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h2 className="h6 mb-0 text-danger">
                  <i className="bi bi-exclamation-triangle me-1" />
                  {failures.length} report{failures.length === 1 ? "" : "s"} could not be generated
                </h2>
                <button type="button" className="btn-close" aria-label="Dismiss" onClick={() => setFailures([])} />
              </div>
              <ul className="mb-0 small">
                {failures.map((f) => (
                  <li key={f.studentId} className="mb-1">
                    <span className="fw-semibold">{f.name}:</span> {f.issues.join(" ")}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card padded={false}>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={selectedCount > 0 && selectedCount === rosterRows!.length}
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th>Student</th>
                    <th>Status</th>
                    <th>Version</th>
                    <th>Last Generated</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rosterRows!.map((row) => (
                    <tr key={row.student.id}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selected.has(row.student.id!)}
                          onChange={() => toggle(row.student.id!)}
                        />
                      </td>
                      <td className="fw-semibold">{getFullName(row.student)}</td>
                      <td>
                        {!row.report ? (
                          <span className="badge text-bg-secondary">Not generated</span>
                        ) : row.stale ? (
                          <span className="badge text-bg-warning">Needs regeneration</span>
                        ) : (
                          <span className="badge text-bg-success">Up to date</span>
                        )}
                      </td>
                      <td>{row.report ? `v${row.report.versionNumber}` : "-"}</td>
                      <td className="text-muted small">
                        {row.report ? new Date(row.report.generatedAt).toLocaleString() : "-"}
                      </td>
                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => runGenerate([row.student.id!])}>
                            Generate
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={() => goToPreview([row.student.id!])}>
                            Preview
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => setHistoryStudent({ id: row.student.id!, name: getFullName(row.student) })}
                          >
                            History
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {progress && (
        <Modal title="Generating reports…" isOpen onClose={() => {}}>
          <div className="mb-2">
            {progress.done} of {progress.total} report(s) generated
          </div>
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
            />
          </div>
        </Modal>
      )}

      {exportSnapshots && settings && (
        <ReportPrintSurface snapshots={exportSnapshots.snapshots} settings={settings} hidden onReady={handlePdfSurfaceReady} />
      )}

      {historyStudent && (
        <ReportHistoryModal studentId={historyStudent.id} studentName={historyStudent.name} onClose={() => setHistoryStudent(null)} />
      )}
    </div>
  );
}
