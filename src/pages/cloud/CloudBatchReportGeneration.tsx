import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import JSZip from "jszip";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { CloudReportGenerationService, type GenerateResult } from "@services/cloud/ReportGenerationService";
import { generatePdfFromPages, sanitizeFileNamePart, downloadBlob } from "@services/cloud/PdfService";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { TermRow, ClassRow, StudentRow } from "@/types/database";

function fullNameOf(s: { first_name: string; middle_name: string | null; last_name: string }): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

interface QueueItem {
  studentId: string;
  studentName: string;
  snapshot: ReportSnapshot;
}

type ZipStatus = "idle" | "rendering" | "done" | "error";

/**
 * "Generate for a whole class" (item 5 of the fixes batch) - the small
 * extension CloudReportView.tsx's own doc comment always said would
 * come once single-report generation was trusted. Reuses that same
 * generation/PDF machinery (CloudReportGenerationService.generateForClass,
 * generatePdfFromPages) rather than reinventing it; the one new piece
 * is packing every student's PDF into a single .zip (JSZip) instead of
 * N separate downloads, which is what was actually asked for.
 *
 * Rendering is deliberately sequential - one student's ReportPrintSurface
 * mounted at a time (see `renderIndex` below) - rather than mounting an
 * entire class's worth of report pages off-screen at once. A class can
 * be 30-40 KG pupils at 3 pages each; one at a time keeps this light on
 * the browser and gives an honest "3 of 27" progress readout instead of
 * a long silent pause.
 */
export function CloudBatchReportGeneration() {
  const { profile } = useCloudAuth();

  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [templateSettings, setTemplateSettings] = useState<TemplateSettings | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [generating, setGenerating] = useState(false);
  const [generateResults, setGenerateResults] = useState<GenerateResult[] | null>(null);
  const [generateProgress, setGenerateProgress] = useState<{ done: number; total: number } | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [renderIndex, setRenderIndex] = useState(0);
  const [zipStatus, setZipStatus] = useState<ZipStatus>("idle");
  const [zipParts, setZipParts] = useState<Map<string, Blob>>(new Map());
  const [zipError, setZipError] = useState<string | null>(null);

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
  }, []);

  useEffect(() => {
    setGenerateResults(null);
    setGenerateError(null);
    setQueue([]);
    setRenderIndex(0);
    setZipStatus("idle");
    setZipParts(new Map());
    setZipError(null);
    if (!classId) {
      setStudents([]);
      return;
    }
    CloudStudentService.list({ status: "ACTIVE" })
      .then((all) => setStudents(all))
      .catch(() => setStudents([]));
  }, [classId]);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) ?? null, [classes, classId]);

  async function handleGenerateAll() {
    if (!classId || !term) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateResults(null);
    setGenerateProgress({ done: 0, total: 0 });
    try {
      const results = await CloudReportGenerationService.generateForClass(classId, term.id, undefined, (done, total) =>
        setGenerateProgress({ done, total })
      );
      setGenerateResults(results);
      const succeeded = results.filter((r) => r.report);
      const items: QueueItem[] = succeeded.map((r) => {
        const student = students.find((s) => s.id === r.studentId);
        return {
          studentId: r.studentId,
          studentName: student ? fullNameOf(student) : r.studentId,
          snapshot: r.report!.snapshot_data as unknown as ReportSnapshot,
        };
      });
      // Reset the render/zip cursor explicitly - regenerating the same
      // class a second time must start the sequential render loop over
      // from item 0, not resume from wherever the previous run's
      // renderIndex was left (which could otherwise satisfy "renderIndex
      // >= queue.length" immediately and try to zip nothing).
      setRenderIndex(0);
      setZipStatus("idle");
      setZipParts(new Map());
      setZipError(null);
      setQueue(items);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Could not generate reports for this class.");
    } finally {
      setGenerating(false);
    }
  }

  const currentItem = queue[renderIndex] ?? null;

  const handleCurrentReady = useCallback(
    async (pageElements: HTMLElement[]) => {
      if (!currentItem || !templateSettings) return;
      // No page elements would otherwise stall the whole batch forever
      // (nothing else advances renderIndex) - treat it as a skip, same
      // as a render failure below, rather than hanging.
      if (pageElements.length === 0) {
        setZipError(`Could not render ${currentItem.studentName}'s report - it was skipped from the zip.`);
        setRenderIndex((i) => i + 1);
        return;
      }
      try {
        const blob = await generatePdfFromPages(pageElements, {
          paperSize: templateSettings.paperSize,
          orientation: templateSettings.orientation,
        });
        setZipParts((prev) => {
          const next = new Map(prev);
          next.set(currentItem.studentId, blob);
          return next;
        });
        void CloudReportGenerationService.recordExport(currentItem.studentId, term!.id, "batch");
      } catch {
        setZipError(`Could not render ${currentItem.studentName}'s report - it was skipped from the zip.`);
      } finally {
        setRenderIndex((i) => i + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentItem, templateSettings]
  );

  useEffect(() => {
    if (queue.length === 0) return;
    if (renderIndex === 0) {
      setZipStatus("rendering");
      setZipParts(new Map());
      setZipError(null);
    }
    if (renderIndex >= queue.length && zipStatus === "rendering") {
      buildAndDownloadZip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderIndex, queue.length]);

  async function buildAndDownloadZip() {
    try {
      const zip = new JSZip();
      let count = 0;
      for (const item of queue) {
        const blob = zipParts.get(item.studentId);
        if (!blob) continue;
        zip.file(`${sanitizeFileNamePart(item.studentName)}.pdf`, blob);
        count += 1;
      }
      if (count === 0) {
        setZipStatus("error");
        setZipError("No reports could be rendered for this class.");
        return;
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const fileName = `${sanitizeFileNamePart(selectedClass?.name ?? "class")}-${sanitizeFileNamePart(term?.term_name ?? "term")}-reports.zip`;
      downloadBlob(zipBlob, fileName);
      setZipStatus("done");
    } catch (err) {
      setZipStatus("error");
      setZipError(err instanceof Error ? err.message : "Could not build the zip file.");
    }
  }

  if (loadingContext) return <p className="text-muted">Loading…</p>;
  if (contextError) return <div className="alert alert-danger">{contextError}</div>;
  if (!term) return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;

  const failed = generateResults?.filter((r) => r.error) ?? [];
  const succeeded = generateResults?.filter((r) => r.report) ?? [];

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
          <button className="btn btn-primary" disabled={generating || zipStatus === "rendering"} onClick={handleGenerateAll}>
            {generating
              ? generateProgress
                ? `Generating ${generateProgress.done} of ${generateProgress.total}…`
                : "Generating…"
              : "Generate reports for this class"}
          </button>
          <p className="text-muted small mt-2 mb-0">
            Checks and (re)generates every enrolled student's report, same rules as the single-student screen - a
            student missing remarks, attendance, or a finalized assessment is skipped with a reason, not silently
            left out.
          </p>
        </div>
      )}

      {generateError && <div className="alert alert-danger">{generateError}</div>}

      {generateResults && (
        <div className="actrs-card p-3 mb-4">
          <p className="mb-2">
            <strong>{succeeded.length}</strong> generated, <strong>{failed.length}</strong> skipped.
          </p>
          {failed.length > 0 && (
            <ul className="small text-muted mb-0 ps-3">
              {failed.map((r) => {
                const student = students.find((s) => s.id === r.studentId);
                return (
                  <li key={r.studentId}>
                    {student ? fullNameOf(student) : r.studentId}: {r.error}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {queue.length > 0 && zipStatus === "rendering" && (
        <div className="actrs-card p-3 mb-4">
          <p className="mb-0">
            Rendering {Math.min(renderIndex + 1, queue.length)} of {queue.length}
            {currentItem ? ` — ${currentItem.studentName}…` : "…"}
          </p>
        </div>
      )}

      {zipStatus === "done" && (
        <div className="alert alert-success">Zip downloaded - {zipParts.size} report(s) included.</div>
      )}
      {zipStatus === "error" && zipError && <div className="alert alert-danger">{zipError}</div>}
      {zipError && zipStatus === "rendering" && <div className="alert alert-warning py-2">{zipError}</div>}

      {currentItem && templateSettings && (
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <ReportPrintSurface
            key={currentItem.studentId}
            snapshots={[currentItem.snapshot]}
            settings={templateSettings}
            onReady={handleCurrentReady}
            hidden
          />
        </div>
      )}
    </div>
  );
}
