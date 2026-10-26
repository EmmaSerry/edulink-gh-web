import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { CloudReportGenerationService } from "@services/cloud/ReportGenerationService";
import { validateReportPrerequisites, type ReportValidationResult } from "@services/cloud/ReportDataService";
import { generatePdfFromPages, sanitizeFileNamePart, downloadBlob } from "@services/cloud/PdfService";
import { ReportBillingService, type LockState } from "@services/cloud/ReportBillingService";
import { ReportLockShield } from "@components/ReportLockShield";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { TermRow, ClassRow, StudentRow, GeneratedReportRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

/**
 * Reports for one learner. Pick the CLASS first, then the learner from that
 * class (so a school with hundreds of learners never has to scroll one long
 * list). The first report opened in a class is free (one free report per class
 * each term) - it is unlocked automatically; later ones show a locked preview
 * until the report fee is paid.
 *
 * Renders through the exact same ReportPrintSurface/ReportPage/template
 * components the offline app uses (see @reporting/*) - nothing here is
 * a reimplementation of report layout, only the surrounding page.
 */
export function CloudReportView() {
  const { profile } = useCloudAuth();

  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [validation, setValidation] = useState<ReportValidationResult | null>(null);
  const [report, setReport] = useState<GeneratedReportRow | null>(null);
  const [stale, setStale] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [pageElements, setPageElements] = useState<HTMLElement[]>([]);
  const [lock, setLock] = useState<LockState | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [autoFreeNote, setAutoFreeNote] = useState<string | null>(null);
  const autoTriedRef = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CloudTermService.getActive(profile?.school_id),
      CloudClassService.list(undefined, profile?.school_id),
      profile?.school_id ? CloudTemplateSettingsService.get(profile.school_id) : Promise.resolve(null),
    ])
      .then(([activeTerm, classRows, settings]) => {
        if (cancelled) return;
        setTerm(activeTerm);
        setClasses(CloudClassService.forRole(classRows, profile));
        setTemplateSettings(settings);
      })
      .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load setup data."))
      .finally(() => !cancelled && setLoadingContext(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.school_id]);

  // Learners of the chosen class only.
  useEffect(() => {
    setStudentId("");
    setStudents([]);
    if (!classId || !term) return;
    let cancelled = false;
    setLoadingRoster(true);
    CloudEnrollmentService.getRoster(term.id, classId)
      .then((roster) => CloudStudentService.listByIds(roster.map((e) => e.student_id)))
      .then((rows) => {
        if (cancelled) return;
        setStudents(
          rows
            .filter((s) => s.status === "ACTIVE")
            .sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)))
        );
      })
      .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load this class."))
      .finally(() => !cancelled && setLoadingRoster(false));
    return () => {
      cancelled = true;
    };
  }, [classId, term]);

  const reloadLock = useCallback(async () => {
    if (!term) return;
    try {
      setLock(await ReportBillingService.getLockState(term.id));
    } catch {
      setLock(null);
    }
  }, [term]);

  useEffect(() => {
    void reloadLock();
  }, [reloadLock]);

  useEffect(() => {
    if (!studentId || !term) {
      setValidation(null);
      setReport(null);
      setStale(false);
      setAutoFreeNote(null);
      return;
    }
    let cancelled = false;
    setLoadingStudent(true);
    setStudentError(null);
    setAutoFreeNote(null);
    setPageElements([]);
    Promise.all([
      validateReportPrerequisites(studentId, term.id),
      CloudReportGenerationService.getCurrent(studentId, term.id),
    ])
      .then(async ([validationResult, existing]) => {
        if (cancelled) return;
        setValidation(validationResult);
        setReport(existing);
        setStale(existing ? await CloudReportGenerationService.isStale(existing) : false);
      })
      .catch((err) => !cancelled && setStudentError(err instanceof Error ? err.message : "Could not load this student's report status."))
      .finally(() => !cancelled && setLoadingStudent(false));
    return () => {
      cancelled = true;
    };
  }, [studentId, term]);

  const snapshot = useMemo<ReportSnapshot | null>(
    () => (report ? (report.snapshot_data as unknown as ReportSnapshot) : null),
    [report]
  );

  // A report is locked until paid for (or it is the class's one free report).
  const locked = !!report && !!lock && lock.isLocked(report.student_id);
  const classFreeUsed = !!report && !!lock && lock.freeClasses.has(report.class_id);

  // The first report opened in a class is free - unlock it automatically.
  useEffect(() => {
    if (!report || !lock || !term || !locked || classFreeUsed) return;
    if (autoTriedRef.current.has(report.student_id)) return;
    autoTriedRef.current.add(report.student_id);
    void (async () => {
      try {
        await ReportBillingService.claimFree(report.student_id, term.id);
        await reloadLock();
        setAutoFreeNote("This is the class's free report for this term - opened free of charge.");
      } catch {
        /* stays locked; the manual button below still works */
      }
    })();
  }, [report, lock, term, locked, classFreeUsed, reloadLock]);

  async function handleUseFree() {
    if (!term || !studentId) return;
    setClaiming(true);
    setStudentError(null);
    try {
      await ReportBillingService.claimFree(studentId, term.id);
      await reloadLock();
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Could not use the free report.");
    } finally {
      setClaiming(false);
    }
  }

  const handlePagesReady = useCallback((elements: HTMLElement[]) => {
    setPageElements(elements);
  }, []);

  async function handleGenerate() {
    if (!term || !studentId) return;
    setGenerating(true);
    setStudentError(null);
    try {
      const generated = await CloudReportGenerationService.generateForStudent(studentId, term.id);
      setReport(generated);
      setStale(false);
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Could not generate this report.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadPdf() {
    if (!term || !templateSettings || pageElements.length === 0 || !report || locked) return;
    setExporting(true);
    try {
      const student = students.find((s) => s.id === studentId);
      const blob = await generatePdfFromPages(pageElements, {
        paperSize: templateSettings.paperSize,
        orientation: templateSettings.orientation,
      });
      const fileName = `${sanitizeFileNamePart(student ? fullNameOf(student) : "report")}-${sanitizeFileNamePart(term.term_name)}.pdf`;
      downloadBlob(blob, fileName);
      await CloudReportGenerationService.recordExport(studentId, term.id, "single", fileName);
    } catch (err) {
      setStudentError(err instanceof Error ? err.message : "Could not export this report as a PDF.");
    } finally {
      setExporting(false);
    }
  }

  async function handlePrint() {
    if (!studentId || !term || locked) return;
    window.print();
    try {
      await CloudReportGenerationService.recordPrint(studentId, term.id);
    } catch {
      // Print tracking is best-effort - never block the actual print.
    }
  }

  if (loadingContext) return <p className="text-muted">Loading…</p>;
  if (contextError) return <div className="alert alert-danger">{contextError}</div>;
  if (!term) return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;

  return (
    <div>
      <div className="no-print">
        <h1 className="h4 mb-1">Reports</h1>
        <p className="text-muted mb-1">{term.term_name}</p>
        <p className="text-muted small mb-4">
          <Link to="/reports/batch">Generate for a whole class →</Link>
        </p>

        <div className="actrs-card p-3 mb-4">
          <div className="row g-3">
            <div className="col-md-5">
              <label className="form-label small">1. Class</label>
              <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class…</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-5">
              <label className="form-label small">2. Learner</label>
              <select
                className="form-select"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                disabled={!classId || loadingRoster}
              >
                <option value="">
                  {!classId ? "Choose a class first" : loadingRoster ? "Loading learners…" : students.length === 0 ? "No learners in this class" : "Select a learner…"}
                </option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fullNameOf(s)} ({s.student_id})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {studentError && <div className="alert alert-danger">{studentError}</div>}

        {loadingStudent && <p className="text-muted">Checking…</p>}

        {!loadingStudent && studentId && validation && !validation.valid && (
          <div className="alert alert-warning">
            <p className="fw-semibold mb-2">This report can't be generated yet:</p>
            <ul className="mb-0 ps-3">
              {validation.issues.map((issue) => (
                <li key={issue.code}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}

        {!loadingStudent && studentId && validation?.valid && (
          <div className="actrs-card p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              {report ? (
                <span className="text-muted small">
                  Version {report.version_number} generated {new Date(report.generated_at).toLocaleString()}
                  {stale && <span className="text-warning fw-semibold"> — scores have changed since this was generated</span>}
                </span>
              ) : (
                <span className="text-muted small">No report generated yet for this student.</span>
              )}
            </div>
            <div className="d-flex gap-2">
              <button className="btn btn-primary" disabled={generating} onClick={handleGenerate}>
                {generating ? "Generating…" : report ? "Regenerate report" : "Generate report"}
              </button>
              {report && !locked && (
                <>
                  <button className="btn btn-outline-secondary" disabled={exporting || pageElements.length === 0} onClick={handleDownloadPdf}>
                    {exporting ? "Exporting…" : "Download PDF"}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={handlePrint}>
                    Print
                  </button>
                </>
              )}
              {report && locked && (
                <Link to="/report-fees" className="btn btn-warning">
                  <i className="bi bi-unlock me-1" />
                  Pay to unlock
                </Link>
              )}
            </div>
          </div>
        )}

        {report && locked && (
          <div className="alert alert-warning">
            <strong>Locked - blurred preview.</strong> This report stays blurred, and printing, downloading and sending it by SMS
            are locked until the report fee is paid ({lock ? `GHS ${lock.price.toFixed(2)} per learner` : ""}).
            {!classFreeUsed ? (
              <>
                {" "}Each class gets <strong>one free full report</strong> per term.{" "}
                <button className="btn btn-sm btn-outline-dark ms-1" disabled={claiming} onClick={handleUseFree}>
                  {claiming ? "Unlocking…" : "Use this class's free report on this learner"}
                </button>
              </>
            ) : (
              <> This class has already used its free report this term.</>
            )}
          </div>
        )}
        {autoFreeNote && !locked && <div className="alert alert-success py-2 small">{autoFreeNote}</div>}
        {report && !locked && lock?.enforced && !autoFreeNote && (
          <div className="alert alert-success py-2 small">This report is unlocked.</div>
        )}
      </div>

      {snapshot && templateSettings && (
        <div className="d-flex justify-content-center">
          {locked ? (
            <ReportLockShield>
              <ReportPrintSurface
                snapshots={[snapshot]}
                settings={templateSettings}
                onReady={handlePagesReady}
                className="actrs-report-print-area"
              />
            </ReportLockShield>
          ) : (
            <ReportPrintSurface
              snapshots={[snapshot]}
              settings={templateSettings}
              onReady={handlePagesReady}
              className="actrs-report-print-area"
            />
          )}
        </div>
      )}
    </div>
  );
}
