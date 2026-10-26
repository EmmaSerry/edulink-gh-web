import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import JSZip from "jszip";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { CloudReportGenerationService } from "@services/cloud/ReportGenerationService";
import { BatchReportService, type BatchItem, type BatchFailure } from "@services/cloud/BatchReportService";
import { ReportBillingService, type LockState } from "@services/cloud/ReportBillingService";
import { generatePdfFromPages, sanitizeFileNamePart, downloadBlob } from "@services/cloud/PdfService";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { TermRow, ClassRow } from "@/types/database";

interface Job {
  items: BatchItem[];
  mode: "single" | "zip";
}

/**
 * Whole-class reports.
 *
 * Generation is now quick: everything is checked and saved in one pass
 * (see BatchReportService) and NO PDF files are rendered up front. When it
 * finishes, the first learner's report is shown open on screen - free, if the
 * class's one free report has not been used. Everyone else appears below as a
 * PDF card: unlocked cards can be viewed or downloaded, locked cards show
 * "Pay to unlock". A PDF is only built at the moment someone asks for it.
 */
export function CloudBatchReportGeneration() {
  const { profile } = useCloudAuth();

  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [failed, setFailed] = useState<BatchFailure[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [lock, setLock] = useState<LockState | null>(null);
  const [autoFreeNote, setAutoFreeNote] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const [job, setJob] = useState<Job | null>(null);
  const [jobIndex, setJobIndex] = useState(0);
  const [jobError, setJobError] = useState<string | null>(null);
  const partsRef = useRef(new Map<string, Blob>());

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
  }, []);

  useEffect(() => {
    setItems([]);
    setFailed([]);
    setHasRun(false);
    setGenerateError(null);
    setAutoFreeNote(null);
    setViewId(null);
    setJob(null);
    setJobError(null);
  }, [classId]);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) ?? null, [classes, classId]);

  const isLocked = useCallback((id: string) => (lock ? lock.isLocked(id) : false), [lock]);
  const unlockedItems = useMemo(() => items.filter((i) => !isLocked(i.studentId)), [items, isLocked]);
  const lockedItems = useMemo(() => items.filter((i) => isLocked(i.studentId)), [items, isLocked]);
  const viewItem = useMemo(
    () => items.find((i) => i.studentId === viewId && !isLocked(i.studentId)) ?? unlockedItems[0] ?? null,
    [items, viewId, unlockedItems, isLocked]
  );

  async function handleGenerateAll() {
    if (!classId || !term) return;
    setGenerating(true);
    setGenerateError(null);
    setAutoFreeNote(null);
    setProgress({ done: 0, total: 0 });
    try {
      const out = await BatchReportService.generateClass(classId, term.id, (done, total) => setProgress({ done, total }));
      let lockState: LockState | null = await ReportBillingService.getLockState(term.id).catch(() => null);

      // The first candidate's report is free: open it automatically if this
      // class has not used its free report yet and nobody is unlocked.
      if (
        lockState &&
        lockState.enforced &&
        out.items.length > 0 &&
        !lockState.freeClasses.has(classId) &&
        !out.items.some((i) => !lockState!.isLocked(i.studentId))
      ) {
        try {
          await ReportBillingService.claimFree(out.items[0].studentId, term.id);
          lockState = await ReportBillingService.getLockState(term.id).catch(() => lockState);
          setAutoFreeNote(`${out.items[0].name}'s report is opened free of charge (one free report per class each term).`);
        } catch {
          /* leave everything locked - the user can still pay */
        }
      }

      setItems(out.items);
      setFailed(out.failed);
      setLock(lockState);
      setViewId(null);
      setHasRun(true);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Could not generate reports for this class.");
    } finally {
      setGenerating(false);
    }
  }

  // ---- on-demand PDF building (one learner, or a zip of the unlocked ones) ----
  function startJob(list: BatchItem[], mode: "single" | "zip") {
    if (list.length === 0) return;
    partsRef.current = new Map();
    setJobError(null);
    setJobIndex(0);
    setJob({ items: list, mode });
  }

  const currentJobItem = job ? job.items[jobIndex] ?? null : null;

  const handleJobReady = useCallback(
    async (pageElements: HTMLElement[]) => {
      if (!job || !currentJobItem || !templateSettings || !term) return;
      try {
        if (pageElements.length === 0) throw new Error("empty");
        const blob = await generatePdfFromPages(pageElements, {
          paperSize: templateSettings.paperSize,
          orientation: templateSettings.orientation,
        });
        partsRef.current.set(currentJobItem.studentId, blob);
        void Promise.resolve(
          CloudReportGenerationService.recordExport(currentJobItem.studentId, term.id, job.mode === "zip" ? "batch" : "single")
        ).catch(() => undefined);
      } catch {
        setJobError(`Could not build ${currentJobItem.name}'s PDF - it was skipped.`);
      } finally {
        setJobIndex((i) => i + 1);
      }
    },
    [job, currentJobItem, templateSettings, term]
  );

  useEffect(() => {
    if (!job || jobIndex < job.items.length) return;
    const finished = job;
    setJob(null);
    void (async () => {
      try {
        const termName = sanitizeFileNamePart(term?.term_name ?? "term");
        if (finished.mode === "single") {
          const only = finished.items[0];
          const blob = partsRef.current.get(only.studentId);
          if (blob) downloadBlob(blob, `${sanitizeFileNamePart(only.name)}-${termName}.pdf`);
          return;
        }
        const zip = new JSZip();
        let count = 0;
        for (const item of finished.items) {
          const blob = partsRef.current.get(item.studentId);
          if (!blob) continue;
          zip.file(`${sanitizeFileNamePart(item.name)}.pdf`, blob);
          count += 1;
        }
        if (count === 0) {
          setJobError("No reports could be built.");
          return;
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${sanitizeFileNamePart(selectedClass?.name ?? "class")}-${termName}-reports.zip`);
      } catch (err) {
        setJobError(err instanceof Error ? err.message : "Could not build the download.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIndex, job]);

  if (loadingContext) return <p className="text-muted">Loading…</p>;
  if (contextError) return <div className="alert alert-danger">{contextError}</div>;
  if (!term) return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;

  const building = job !== null;

  return (
    <div>
      <h1 className="h4 mb-1">Batch report generation</h1>
      <p className="text-muted mb-1">{term.term_name}</p>
      <p className="text-muted small mb-4">
        <Link to="/reports">← Back to single-student reports</Link>
      </p>

      <div className="actrs-card p-3 mb-4">
        <label className="form-label small">Class</label>
        <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ maxWidth: 420 }}>
          <option value="">Select a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {classId && (
        <div className="actrs-card p-3 mb-4">
          <button className="btn btn-primary" disabled={generating || building} onClick={handleGenerateAll}>
            {generating
              ? progress && progress.total > 0
                ? `Generating ${progress.done} of ${progress.total}…`
                : "Generating…"
              : hasRun
                ? "Generate again"
                : "Generate reports for this class"}
          </button>
          <p className="text-muted small mt-2 mb-0">
            Checks and saves every enrolled learner's report. Anyone missing remarks, attendance or a finalized
            assessment is listed below with the reason.
          </p>
        </div>
      )}

      {generateError && <div className="alert alert-danger">{generateError}</div>}

      {hasRun && (
        <div className="actrs-card p-3 mb-4">
          <p className="mb-1">
            <strong>{items.length}</strong> generated, <strong>{failed.length}</strong> skipped.
          </p>
          {failed.length > 0 && (
            <ul className="small text-muted mb-0 ps-3">
              {failed.map((f) => (
                <li key={f.studentId}>
                  {f.name}: {f.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {autoFreeNote && <div className="alert alert-success py-2 small">{autoFreeNote}</div>}
      {jobError && <div className="alert alert-warning py-2 small">{jobError}</div>}
      {building && job && (
        <div className="alert alert-info py-2 small">
          Building PDF {Math.min(jobIndex + 1, job.items.length)} of {job.items.length}
          {currentJobItem ? ` - ${currentJobItem.name}…` : "…"}
        </div>
      )}

      {hasRun && items.length > 0 && (
        <>
          {viewItem ? (
            <div className="actrs-card p-3 mb-4">
              <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <div>
                  <div className="fw-semibold">{viewItem.name}</div>
                  <div className="small text-muted">
                    {lock?.enforced ? "Unlocked report" : "Report"} - shown below
                  </div>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary btn-sm" disabled={building} onClick={() => startJob([viewItem], "single")}>
                    <i className="bi bi-download me-1" />
                    Download PDF
                  </button>
                  {unlockedItems.length > 1 && (
                    <button className="btn btn-outline-primary btn-sm" disabled={building} onClick={() => startJob(unlockedItems, "zip")}>
                      <i className="bi bi-file-earmark-zip me-1" />
                      Download all unlocked ({unlockedItems.length}) as zip
                    </button>
                  )}
                </div>
              </div>
              {templateSettings && (
                <div className="d-flex justify-content-center" style={{ overflowX: "auto" }}>
                  <ReportPrintSurface
                    key={`view-${viewItem.studentId}`}
                    snapshots={[viewItem.snapshot]}
                    settings={templateSettings}
                    onReady={() => undefined}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="alert alert-warning">
              No report is unlocked for this class yet. Pay to unlock below
              {lock?.enforced ? ` (GHS ${lock.price.toFixed(2)} per learner)` : ""}.
            </div>
          )}

          <div className="actrs-card p-3 mb-4">
            <h2 className="h6 fw-bold mb-3">All reports ({items.length})</h2>
            <div className="row g-3">
              {items.map((item) => {
                const locked = isLocked(item.studentId);
                const open = viewItem?.studentId === item.studentId;
                return (
                  <div className="col-6 col-md-4 col-lg-3" key={item.studentId}>
                    <div
                      className="border rounded p-3 h-100 text-center"
                      style={{ opacity: locked ? 0.65 : 1, background: open ? "rgba(13,110,253,0.08)" : undefined }}
                    >
                      <div style={{ fontSize: "2.6rem", lineHeight: 1 }} className={locked ? "text-secondary" : "text-danger"}>
                        <i className={`bi ${locked ? "bi-file-earmark-lock2" : "bi-file-earmark-pdf"}`} />
                      </div>
                      <div className="small fw-semibold mt-2 text-truncate" title={item.name}>
                        {item.name}
                      </div>
                      {locked ? (
                        <Link to="/report-fees" className="btn btn-warning btn-sm mt-2 w-100">
                          <i className="bi bi-unlock me-1" />
                          Pay to unlock
                        </Link>
                      ) : (
                        <div className="d-flex gap-1 mt-2">
                          <button className="btn btn-outline-primary btn-sm flex-fill" disabled={open} onClick={() => setViewId(item.studentId)}>
                            {open ? "Viewing" : "View"}
                          </button>
                          <button className="btn btn-outline-secondary btn-sm flex-fill" disabled={building} onClick={() => startJob([item], "single")}>
                            <i className="bi bi-download" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {lockedItems.length > 0 && lock?.enforced && (
              <p className="text-muted small mt-3 mb-0">
                {lockedItems.length} report(s) are locked: they can't be viewed or downloaded until the report fee
                (GHS {lock.price.toFixed(2)} per learner) is paid. Each class gets one free report per term.
              </p>
            )}
          </div>
        </>
      )}

      {currentJobItem && templateSettings && (
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <ReportPrintSurface
            key={`job-${currentJobItem.studentId}`}
            snapshots={[currentJobItem.snapshot]}
            settings={templateSettings}
            onReady={handleJobReady}
            hidden
          />
        </div>
      )}
    </div>
  );
}
