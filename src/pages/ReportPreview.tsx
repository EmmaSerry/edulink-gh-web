import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import { PageHeader } from "@components/PageHeader";
import { Breadcrumb } from "@components/Breadcrumb";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";
import { useToast } from "@contexts/ToastContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { TemplateSettingsService } from "@services/TemplateSettingsService";
import { buildClassSnapshots } from "@services/ReportDataService";
import { buildSampleSnapshot } from "@services/SampleReportService";
import { ReportGenerationService } from "@services/ReportGenerationService";
import { generatePdfFromPages, downloadBlob, sanitizeFileNamePart } from "@services/PdfService";
import { printReports } from "@services/PrintService";
import { ReportRenderer } from "@reporting/templateRegistry";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { ReportTemplateCode } from "@models/ReportTemplate";

const ZOOM_MIN = 40;
const ZOOM_MAX = 200;
const ZOOM_STEP = 10;

/**
 * Module 7 - interactive Report Preview. Reads `classId`/`termId` (and
 * optionally a `studentIds` allow-list) from the URL so it is directly
 * linkable from the Dashboard, Batch generation and Report History.
 * `mode=frozen&reportId=` shows a past `GeneratedReport`/`ReportVersion`
 * snapshot exactly as generated (Module 13 - "reopen and reprint without
 * recalculating"); the default `mode=live` always rebuilds from current
 * data, which is what "Preview" from the Dashboard means before a report
 * has even been generated yet. `mode=sample&templateCode=` (Version 1.0
 * update) builds a made-up learner's report card for a given level
 * (KG/Lower Primary/Upper Primary/JHS) using the school's real branding
 * and curriculum configuration - for seeing what a report card looks
 * like before any real students/scores exist. Downloading/printing a
 * sample still produces a real PDF/printout, just without touching
 * ReportGenerationService's record-keeping (there's no real student to
 * attribute it to).
 */
export function ReportPreview() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const currentUser = useCurrentUser();

  const classId = Number(searchParams.get("classId"));
  const termId = Number(searchParams.get("termId"));
  const studentIdsParam = searchParams.get("studentIds");
  const allowList = studentIdsParam ? studentIdsParam.split(",").map(Number) : undefined;
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "frozen" ? "frozen" : modeParam === "sample" ? "sample" : "live";
  const frozenReportId = Number(searchParams.get("reportId"));
  const sampleTemplateCode = searchParams.get("templateCode") as ReportTemplateCode | null;

  const settings = useLiveQuery(() => TemplateSettingsService.get(), []);
  const [snapshots, setSnapshots] = useState<ReportSnapshot[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [exportSurface, setExportSurface] = useState<ReportSnapshot[] | null>(null);
  const [resolvedTermId, setResolvedTermId] = useState<number>(0);

  const loadLive = useCallback(async () => {
    setSnapshots(undefined);
    setLoadError(null);
    try {
      const map = await buildClassSnapshots(classId, termId);
      // The map is keyed by the student's numeric row id (not the
      // permanent ACTRS-XXXX-NNNNNN code stored on the snapshot itself),
      // which is exactly what the URL's studentIds allow-list contains.
      let list: ReportSnapshot[];
      if (allowList) {
        const idSet = new Set(allowList);
        list = Array.from(map.entries())
          .filter(([id]) => idSet.has(id))
          .map(([, snap]) => snap);
      } else {
        list = Array.from(map.values());
      }
      list.sort((a, b) => a.student.fullName.localeCompare(b.student.fullName));
      setSnapshots(list);
      setIndex(0);
      setResolvedTermId(termId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not build the report preview.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, termId, studentIdsParam]);

  const loadFrozen = useCallback(async () => {
    setSnapshots(undefined);
    setLoadError(null);
    try {
      const version = await db.reportVersions.get(frozenReportId);
      if (!version) {
        setLoadError("This report version could not be found.");
        return;
      }
      setSnapshots([version.snapshotData]);
      setIndex(0);
      setResolvedTermId(version.termId);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load this report version.");
    }
  }, [frozenReportId]);

  const loadSample = useCallback(async () => {
    if (!sampleTemplateCode) return;
    setSnapshots(undefined);
    setLoadError(null);
    try {
      const snapshot = await buildSampleSnapshot(sampleTemplateCode);
      setSnapshots([snapshot]);
      setIndex(0);
      setResolvedTermId(0);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not build the sample report card.");
    }
  }, [sampleTemplateCode]);

  useEffect(() => {
    if (mode === "frozen") void loadFrozen();
    else if (mode === "sample") void loadSample();
    else void loadLive();
  }, [mode, loadFrozen, loadLive, loadSample]);

  const current = snapshots?.[index];

  async function handleDownloadPdf() {
    if (!current || !settings) return;
    setExporting(true);
    try {
      if (mode === "live") {
        const studentRow = await db.students.where("studentId").equals(current.student.studentId).first();
        if (!studentRow?.id) {
          showToast("Could not resolve this student's record.", "error");
          return;
        }
        const result = await ReportGenerationService.generateForStudent(studentRow.id, termId, currentUser.name);
        if (!result.success) {
          showToast(
            result.validation?.issues.map((i) => i.message).join(" ") ?? "This report cannot be generated yet.",
            "error",
          );
          return;
        }
      }
      setExportSurface([current]);
    } finally {
      setExporting(false);
    }
  }

  async function handleExportReady(pageElements: HTMLElement[]) {
    if (!current || !settings) return;
    try {
      const blob = await generatePdfFromPages(pageElements, { paperSize: settings.paperSize, orientation: settings.orientation });
      const fileName = `${sanitizeFileNamePart(current.student.fullName)}-${sanitizeFileNamePart(current.term.termName)}.pdf`;
      downloadBlob(blob, fileName);
      const studentRow = await db.students.where("studentId").equals(current.student.studentId).first();
      if (studentRow?.id) {
        await ReportGenerationService.recordExport(studentRow.id, resolvedTermId, currentUser.name, "single", fileName);
      }
      showToast("PDF downloaded.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "PDF generation failed.", "error");
    } finally {
      setExportSurface(null);
    }
  }

  async function handlePrint() {
    if (!current || !settings) return;
    setPrinting(true);
    try {
      await printReports([current], settings);
      const studentRow = await db.students.where("studentId").equals(current.student.studentId).first();
      if (studentRow?.id) {
        await ReportGenerationService.recordPrint(studentRow.id, resolvedTermId, currentUser.name);
      }
    } finally {
      setPrinting(false);
    }
  }

  const zoomStyle = useMemo(() => ({ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }), [zoom]);

  if (mode === "live" && (!classId || !termId)) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Report Cards", path: "/report-cards" }, { label: "Preview" }]} />
        <EmptyState icon="bi-exclamation-triangle" title="Missing class or term" message="Open Preview from the Report Dashboard." />
      </div>
    );
  }
  if (mode === "frozen" && !frozenReportId) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Report Cards", path: "/report-cards" }, { label: "Preview" }]} />
        <EmptyState icon="bi-exclamation-triangle" title="Missing report version" message="Open this from Report History." />
      </div>
    );
  }
  if (mode === "sample" && !sampleTemplateCode) {
    return (
      <div>
        <Breadcrumb items={[{ label: "Report Cards", path: "/report-cards" }, { label: "Preview" }]} />
        <EmptyState icon="bi-exclamation-triangle" title="Missing level" message="Open this from the Report Dashboard's sample preview buttons." />
      </div>
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Report Cards", path: "/report-cards" }, { label: "Preview" }]} />
      <PageHeader
        title="Report Preview"
        phaseBadge="Phase 4"
        actions={
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => navigate("/report-cards")}>
            <i className="bi bi-arrow-left me-1" />
            Return to Dashboard
          </button>
        }
      />

      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3 no-print">
        <div className="d-flex gap-2 align-items-center">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={!snapshots || index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <i className="bi bi-chevron-left" /> Previous
          </button>
          <span className="small text-muted">
            {snapshots ? `${snapshots.length === 0 ? 0 : index + 1} of ${snapshots.length}` : "…"}
          </span>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            disabled={!snapshots || index >= (snapshots?.length ?? 1) - 1}
            onClick={() => setIndex((i) => Math.min((snapshots?.length ?? 1) - 1, i + 1))}
          >
            Next <i className="bi bi-chevron-right" />
          </button>
        </div>

        <div className="d-flex gap-2 align-items-center">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}>
            <i className="bi bi-zoom-out" />
          </button>
          <span className="small text-muted" style={{ minWidth: 42, textAlign: "center" }}>{zoom}%</span>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}>
            <i className="bi bi-zoom-in" />
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setZoom(100)}>
            Fit Width
          </button>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setZoom(60)}>
            Fit Page
          </button>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={!current || exporting} onClick={handleDownloadPdf}>
            {exporting ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-file-earmark-pdf me-1" />}
            Download PDF
          </button>
          <button type="button" className="btn btn-outline-primary btn-sm" disabled={!current || printing} onClick={handlePrint}>
            {printing ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-printer me-1" />}
            Print
          </button>
        </div>
      </div>

      {loadError ? (
        <EmptyState icon="bi-exclamation-triangle" title="Could not load preview" message={loadError} />
      ) : !snapshots || !settings ? (
        <LoadingSpinner label="Building report preview…" />
      ) : snapshots.length === 0 ? (
        <EmptyState icon="bi-people" title="Nothing to preview" message="No students matched the selected class/term." />
      ) : (
        <div style={{ overflow: "auto" }}>
          <div style={zoomStyle}>{current && <ReportRenderer snapshot={current} settings={settings} />}</div>
        </div>
      )}

      {exportSurface && settings && (
        <ReportPrintSurface snapshots={exportSurface} settings={settings} hidden onReady={handleExportReady} />
      )}
    </div>
  );
}
