import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { generatePdfFromPages, sanitizeFileNamePart, downloadBlob } from "@services/cloud/PdfService";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import { buildSampleSnapshot } from "@reporting/buildSampleSnapshot";
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from "@models/TemplateSettings";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { ReportTemplateCode } from "@/types/database";

const TEMPLATE_OPTIONS: { code: ReportTemplateCode; label: string }[] = [
  { code: "KG", label: "Kindergarten" },
  { code: "LOWER_PRIMARY", label: "Lower Primary" },
  { code: "UPPER_PRIMARY", label: "Upper Primary" },
  { code: "JHS", label: "JHS" },
];

/**
 * "Preview a sample report card" - reachable by super admin, district
 * admin, school admin and bursar (see RequireAdmin's roles="reportSample"
 * and CloudSidebar) without needing a single real student, score or
 * remark on file. Picking a template and clicking Preview builds a
 * complete, made-up ReportSnapshot (buildSampleSnapshot.ts) and renders
 * it through the exact same ReportPrintSurface a real report uses, with
 * the school's own configured print settings (paper size, orientation,
 * margins, colours, fonts) applied - so this is the right screen to
 * check "does my print setting actually look right" against, right
 * after changing it under Settings -> Report template, before a single
 * real student has been entered.
 *
 * A school_admin/bursar sees their OWN school's configured print
 * settings applied to the sample. A district_admin/platform_admin has
 * no single school's settings to apply (and no business seeing another
 * school's, read-only or not), so they get the same sensible defaults
 * every school starts with - still a fully faithful preview of the
 * template layout itself, just not tied to one school's customisation.
 */
export function CloudSampleReportPreview() {
  const { profile } = useCloudAuth();
  const [templateCode, setTemplateCode] = useState<ReportTemplateCode>("LOWER_PRIMARY");
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null);
  const [pageElements, setPageElements] = useState<HTMLElement[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const hasOwnSchool = profile?.role === "school_admin" || profile?.role === "bursar";

  useEffect(() => {
    let cancelled = false;
    if (hasOwnSchool && profile?.school_id) {
      CloudTemplateSettingsService.get(profile.school_id)
        .then((s) => !cancelled && setTemplateSettings(s))
        .catch(() => !cancelled && setTemplateSettings({ ...DEFAULT_TEMPLATE_SETTINGS, id: undefined }))
        .finally(() => !cancelled && setLoadingSettings(false));
    } else {
      setTemplateSettings({ ...DEFAULT_TEMPLATE_SETTINGS, id: undefined });
      setLoadingSettings(false);
    }
    return () => {
      cancelled = true;
    };
  }, [hasOwnSchool, profile?.school_id]);

  const handlePagesReady = useCallback((elements: HTMLElement[]) => {
    setPageElements(elements);
  }, []);

  function handlePreview() {
    setPageElements([]);
    setExportError(null);
    setSnapshot(buildSampleSnapshot(templateCode));
  }

  async function handleDownloadPdf() {
    if (!templateSettings || pageElements.length === 0) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await generatePdfFromPages(pageElements, {
        paperSize: templateSettings.paperSize,
        orientation: templateSettings.orientation,
      });
      const fileName = `sample-report-${sanitizeFileNamePart(templateCode)}.pdf`;
      downloadBlob(blob, fileName);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Could not export this sample as a PDF.");
    } finally {
      setExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const settingsNote = useMemo(() => {
    if (loadingSettings) return null;
    return hasOwnSchool && profile?.school_id
      ? "Using your school's own configured print settings (Settings → Report template)."
      : "Using EduLink GH's default print settings - your account has no single school's settings of its own to apply.";
  }, [hasOwnSchool, profile?.school_id, loadingSettings]);

  return (
    <div>
      <div className="no-print">
        <h1 className="h4 mb-1">Sample report preview</h1>
        <p className="text-muted mb-4">
          Check how a report template and your print settings actually look, using a made-up learner - no real
          students, scores or remarks needed.
        </p>

        <div className="actrs-card p-3 mb-4 d-flex align-items-end gap-3 flex-wrap">
          <div>
            <label className="form-label small">Report template</label>
            <select
              className="form-select"
              style={{ minWidth: 220 }}
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value as ReportTemplateCode)}
            >
              {TEMPLATE_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button type="button" className="btn btn-primary" disabled={loadingSettings} onClick={handlePreview}>
            Preview sample report
          </button>
          {snapshot && (
            <>
              <button
                type="button"
                className="btn btn-outline-secondary"
                disabled={exporting || pageElements.length === 0}
                onClick={handleDownloadPdf}
              >
                {exporting ? "Exporting…" : "Download PDF"}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={handlePrint}>
                Print
              </button>
            </>
          )}
        </div>

        {settingsNote && <p className="text-muted small mb-3">{settingsNote}</p>}
        {exportError && <div className="alert alert-danger">{exportError}</div>}

        {snapshot && (
          <div className="alert alert-warning py-2 mb-4">
            This is a sample - the school name, teacher/headteacher names, learner details, scores and remarks
            below are all made up for preview purposes only. Nothing here is saved or counted anywhere.
          </div>
        )}
      </div>

      {snapshot && templateSettings && (
        <div className="d-flex justify-content-center">
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
