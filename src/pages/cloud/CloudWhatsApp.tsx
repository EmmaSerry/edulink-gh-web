import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudSmsService } from "@services/cloud/SmsService";
import { CloudTemplateSettingsService } from "@services/cloud/TemplateSettingsService";
import { ReportBillingService } from "@services/cloud/ReportBillingService";
import { PlatformPaymentsService, type MessagingPricing } from "@services/cloud/PlatformPaymentsService";
import { generatePdfFromPages } from "@services/cloud/PdfService";
import { rest } from "@/lib/supabaseClient";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { ClassRow, SmsRecipient, TermRow } from "@/types/database";

type Mode = "report" | "custom";

interface Row {
  studentId: string;
  name: string;
  hasPhone: boolean;
  optedIn: boolean;
  generated: boolean;
  unlocked: boolean;
  snapshot: ReportSnapshot | null;
}

interface Outcome {
  name: string;
  status: "sent" | "failed" | "skipped";
  reason?: string;
}

function money(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Send paid (unlocked) report-card PDFs, or a customised message, to parents'
 * WhatsApp. For report cards the PDF is built here in the browser, saved to
 * private storage, and the server (send-whatsapp) checks the report is paid
 * for, deducts one WhatsApp token per message and sends it.
 */
export function CloudWhatsApp() {
  const { profile } = useCloudAuth();
  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [settings, setSettings] = useState<TemplateSettings | null>(null);
  const [pricing, setPricing] = useState<MessagingPricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("report");
  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [loadingClass, setLoadingClass] = useState(false);

  const [sending, setSending] = useState(false);
  const [queue, setQueue] = useState<Row[]>([]);
  const [idx, setIdx] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CloudTermService.getActive(profile?.school_id),
      CloudClassService.list(),
      profile?.school_id ? CloudTemplateSettingsService.get(profile.school_id) : Promise.resolve(null),
      PlatformPaymentsService.pricing(),
    ])
      .then(([t, c, s, p]) => {
        if (cancelled) return;
        setTerm(t);
        setClasses(CloudClassService.forRole(c, profile));
        setSettings(s);
        setPricing(p);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setRows([]);
    setSelected(new Set());
    setOutcomes([]);
    if (!classId || !term) return;
    let cancelled = false;
    setLoadingClass(true);
    (async () => {
      const [recips, lockState, reports] = await Promise.all([
        CloudSmsService.getRecipients({ classId }),
        ReportBillingService.getLockState(term.id),
        rest.select<{ student_id: string; snapshot_data: unknown }>("generated_reports", {
          select: "student_id,snapshot_data",
          filters: { term_id: `eq.${term.id}`, class_id: `eq.${classId}` },
        }),
      ]);
      if (cancelled) return;
      const snapByStudent = new Map(reports.map((r) => [r.student_id, r.snapshot_data as unknown as ReportSnapshot]));
      const byStudent = new Map<string, SmsRecipient>();
      for (const r of recips) if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, r);
      const built: Row[] = [...byStudent.values()]
        .map((r) => ({
          studentId: r.student_id,
          name: r.student_name,
          hasPhone: !!r.phone,
          optedIn: r.sms_opt_in,
          generated: snapByStudent.has(r.student_id),
          unlocked: !lockState.isLocked(r.student_id),
          snapshot: snapByStudent.get(r.student_id) ?? null,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setRows(built);
      setSelected(new Set(built.filter((r) => eligible(r, mode)).map((r) => r.studentId)));
    })()
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load this class."))
      .finally(() => !cancelled && setLoadingClass(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, term]);

  useEffect(() => {
    setSelected(new Set(rows.filter((r) => eligible(r, mode)).map((r) => r.studentId)));
  }, [mode, rows]);

  function eligible(r: Row, m: Mode): boolean {
    if (!r.hasPhone || !r.optedIn) return false;
    return m === "custom" ? true : r.generated && r.unlocked;
  }
  function why(r: Row): string | null {
    if (!r.hasPhone) return "No phone number";
    if (!r.optedIn) return "Opted out";
    if (mode === "report") {
      if (!r.generated) return "Report not generated";
      if (!r.unlocked) return "Report not paid for";
    }
    return null;
  }

  const price = pricing?.whatsapp_price ?? 0;
  const balance = pricing?.whatsapp_tokens ?? 0;
  const count = selected.size;
  const needed = price > 0 ? count : 0;
  const short = price > 0 && balance < count;

  function toggle(id: string) {
    setSelected((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function refreshBalance() {
    setPricing(await PlatformPaymentsService.pricing());
  }

  async function handleSend() {
    if (!term || count === 0) return;
    setError(null);
    setOutcomes([]);
    if (mode === "custom") {
      if (!message.trim()) {
        setError("Write the message first.");
        return;
      }
      if (!window.confirm(`Send this WhatsApp message to ${count} parent(s)?`)) return;
      setSending(true);
      try {
        const r = await PlatformPaymentsService.sendWhatsApp({
          kind: "custom",
          termId: term.id,
          message,
          items: [...selected].map((studentId) => ({ studentId })),
        });
        setOutcomes(r.results.map((x) => ({ name: x.name, status: x.status, reason: x.reason })));
        await refreshBalance();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not send.");
      } finally {
        setSending(false);
      }
      return;
    }
    if (!window.confirm(`Send ${count} report card PDF(s) to parents on WhatsApp?`)) return;
    const q = rows.filter((r) => selected.has(r.studentId) && r.snapshot);
    setQueue(q);
    setIdx(0);
    setSending(true);
  }

  const current = sending && mode === "report" ? queue[idx] ?? null : null;

  const handleReady = useCallback(
    async (pages: HTMLElement[]) => {
      if (!current || !settings || !term || !profile?.school_id) return;
      let outcome: Outcome;
      try {
        if (pages.length === 0) throw new Error("Could not draw this report.");
        const blob = await generatePdfFromPages(pages, { paperSize: settings.paperSize, orientation: settings.orientation });
        const path = await PlatformPaymentsService.uploadReportPdf(profile.school_id, term.id, current.studentId, blob);
        const r = await PlatformPaymentsService.sendWhatsApp({
          kind: "report",
          termId: term.id,
          items: [{ studentId: current.studentId, pdfPath: path }],
        });
        const x = r.results[0];
        outcome = { name: current.name, status: x?.status ?? "failed", reason: x?.reason };
      } catch (e) {
        outcome = { name: current.name, status: "failed", reason: e instanceof Error ? e.message : "Failed" };
      }
      setOutcomes((o) => [...o, outcome]);
      setIdx((i) => i + 1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, settings, term, profile?.school_id]
  );

  useEffect(() => {
    if (sending && mode === "report" && queue.length > 0 && idx >= queue.length) {
      setSending(false);
      void refreshBalance();
    }
  }, [idx, queue.length, sending, mode]);

  const summary = useMemo(() => {
    const s = outcomes.filter((o) => o.status === "sent").length;
    return { sent: s, other: outcomes.length - s };
  }, [outcomes]);

  if (loading) return <p className="text-muted">Loading...</p>;
  if (!term) return <div className="alert alert-warning">Your school has no active term set up yet.</div>;

  return (
    <div>
      <h1 className="h4 mb-1">WhatsApp to parents</h1>
      <p className="text-muted">
        Send paid report cards (as a PDF) or a customised message to parents' WhatsApp. {term.term_name}.
      </p>
      {error && <div className="alert alert-danger">{error}</div>}

      <div className="actrs-card p-3 mb-3">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div className="btn-group">
            <button className={`btn ${mode === "report" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setMode("report")}>
              Report cards (PDF)
            </button>
            <button className={`btn ${mode === "custom" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setMode("custom")}>
              Custom message
            </button>
          </div>
          <div className="small">
            {price > 0 ? (
              <>
                {money(price)} per message · balance <strong>{balance.toLocaleString()}</strong> tokens{" "}
                <Link to="/credits">Buy more</Link>
              </>
            ) : (
              <span className="text-success">WhatsApp is free right now</span>
            )}
          </div>
        </div>
      </div>

      <div className="actrs-card p-3 mb-3">
        <label className="form-label small">Class</label>
        <select className="form-select" style={{ maxWidth: 360 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Select a class...</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {mode === "custom" && classId && (
        <div className="actrs-card p-3 mb-3">
          <label className="form-label small">Your message (one paragraph, up to 600 characters)</label>
          <textarea className="form-control" rows={3} maxLength={600} value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="small text-muted mt-1">{message.length}/600. Parents see: "Hello [parent name], a message from [school name]: your text".</div>
        </div>
      )}

      {loadingClass && <p className="text-muted">Loading class...</p>}

      {classId && !loadingClass && (
        <div className="actrs-card p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <strong>{count} selected</strong>
            <span className="small text-muted">{price > 0 ? `Cost: ${needed} token(s) = ${money(needed * price)}` : ""}</span>
          </div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <tbody>
                {rows.map((r) => {
                  const reason = why(r);
                  return (
                    <tr key={r.studentId}>
                      <td style={{ width: 36 }}>
                        <input type="checkbox" disabled={!eligible(r, mode)} checked={selected.has(r.studentId)} onChange={() => toggle(r.studentId)} />
                      </td>
                      <td>{r.name}</td>
                      <td className="text-end small">{reason ? <span className="text-muted">{reason}</span> : <span className="text-success">Ready</span>}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td className="text-muted">No learners with a guardian on file in this class.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {short && (
            <div className="alert alert-warning mt-3 mb-0 py-2">
              You need {count} token(s) but have {balance}. <Link to="/credits">Buy WhatsApp tokens</Link>
            </div>
          )}
          <button className="btn btn-success mt-3" disabled={sending || count === 0 || short || (mode === "custom" && !message.trim())} onClick={handleSend}>
            {sending
              ? mode === "report"
                ? `Sending ${Math.min(idx + 1, queue.length)} of ${queue.length}...`
                : "Sending..."
              : mode === "report"
                ? `Send ${count} report card(s) on WhatsApp`
                : `Send message to ${count} parent(s)`}
          </button>
          {mode === "report" && (
            <p className="text-muted small mt-2 mb-0">
              Only reports that are generated <strong>and paid for</strong> can be sent. Building each PDF takes a few seconds - keep this page open.
            </p>
          )}
        </div>
      )}

      {outcomes.length > 0 && (
        <div className={`alert ${summary.other ? "alert-warning" : "alert-success"}`}>
          <strong>{summary.sent}</strong> sent{summary.other > 0 && <>, <strong>{summary.other}</strong> not sent</>}.
          <ul className="mb-0 mt-2 small">
            {outcomes.filter((o) => o.status !== "sent").map((o, i) => (
              <li key={i}>{o.name}: {o.reason ?? o.status}</li>
            ))}
          </ul>
        </div>
      )}

      {current && settings && current.snapshot && (
        <div style={{ position: "fixed", left: -10000, top: 0 }}>
          <ReportPrintSurface key={current.studentId} snapshots={[current.snapshot]} settings={settings} onReady={handleReady} className="actrs-report-print-area" />
        </div>
      )}
    </div>
  );
}
