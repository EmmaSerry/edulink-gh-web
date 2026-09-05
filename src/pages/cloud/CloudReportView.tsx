import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { CloudReportGenerationService } from "@services/cloud/ReportGenerationService";
import { validateReportPrerequisites, type ReportValidationResult } from "@services/cloud/ReportDataService";
import { generatePdfFromPages, sanitizeFileNamePart, downloadBlob } from "@services/cloud/PdfService";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { TermRow, StudentRow, GeneratedReportRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

/**
 * The payoff screen: turns everything built so far (registration,
 * assessment entry, the grading engine, the freeze step) into an actual
 * report card a parent could be handed. Deliberately student-at-a-time
 * rather than a batch/class view - proving one report end to end
 * correctly matters more right now than covering every workflow at
 * once; a "generate for a whole class" screen is a small extension of
 * this once this is trusted.
 *
 * Renders through the exact same ReportPrintSurface/ReportPage/template
 * components the offline app uses (see @reporting/*) - nothing here is
 * a reimplementation of report layout, only the surrounding page.
 */
export function CloudReportView() {
  const { profile } = useCloudAuth();

  const [term, setTerm] = useState<TermRow | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [studentId, setStudentId] = useState("");
  const [validation, setValidation] = useState<ReportValidationResult | null>(null);
  const [report, setReport] = useState<GeneratedReportRow | null>(null);
  const [stale, setStale] = useState(false);
  const [loadingStudent, setLoadingStudent] = useState(false);
  const [studentError, setStudentError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [pageElements, setPageElements] = useState<HTMLElement[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CloudTermService.getActive(),
      CloudStudentService.list({ status: "ACTIVE" }),
      profile?.school_id ? CloudTemplateSettingsService.get(profile.school_id) : Promise.resolve(null),
    ])
      .then(([activeTerm, studentRows, settings]) => {
        if (cancelled) return;
        setTerm(activeTerm);
        setStudents(studentRows);
        setTemplateSettings(settings);
      })
      .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load setup data."))
      .finally(() => !cancelled && setLoadingContext(false));
    return () => {
      cancelled = true;
    };
  }, [profile?.school_id]);

  useEffect(() => {
    if (!studentId || !term) {
      setValidation(null);
      setReport(null);
      setStale(false);
      return;
    }
    let cancelled = false;
    setLoadingStudent(true);
    setStudentError(null);
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
    if (!term || !templateSettings || pageElements.length === 0 || !report) return;
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
    if (!studentId || !term) return;
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
        <p className="text-muted mb-4">{term.term_name}</p>

        <div className="actrs-card p-3 mb-4">
          <label className="form-label small">Student</label>
          <select className="form-select" value={studentId} onChange={(e) => setStudentId(e.target.value)} style={{ maxWidth: 420 }}>
            <option value="">Select a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {fullNameOf(s)} ({s.student_id})
              </option>
            ))}
          </select>
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
              {report && (
                <>
                  <button className="btn btn-outline-secondary" disabled={exporting || pageElements.length === 0} onClick={handleDownloadPdf}>
                    {exporting ? "Exporting…" : "Download PDF"}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={handlePrint}>
                    Print
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {snapshot && templateSettings && (
        <div className="d-flex justify-content-center">
          {/* report-print.css's @media print rule hides every element on
              the page EXCEPT one carrying this exact class (a common
              "print only this" technique) - without it, window.print()
              blanks the entire page, report included. */}
          <ReportPrintSurface
            snapshots={[snapshot]}
            settings={templateSettings}
            onReady={handlePagesReady}
            className="actrs-report-print-area"
          />
        </div>
      )}
    </div>
  );
}
