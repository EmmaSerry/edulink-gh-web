import { useCallback, useEffect, useMemo, useState } from "react";
import { edgeFunctions } from "@/lib/supabaseClient";
import { CloudSmsService } from "@services/cloud/SmsService";
import { MockExamService, type MockFull, type MockMessageRow } from "@/services/cloud/MockExamService";
import type { SmsRecipient } from "@/types/database";
import { buildLearnerProfile, composeParentMessage } from "@/mock/mockAnalysis";
import { useMockSnapshots } from "@pages/cloud/mock/useMockSnapshots";
import { ToneBadge } from "@pages/cloud/mock/MockUi";

type Channel = "sms" | "whatsapp";

interface Row {
  candidateId: string;
  studentId: string;
  name: string;
  className: string;
  message: string;
  complete: boolean;
  guardianIds: string[];
  hasPhone: boolean;
  optedIn: boolean;
}

const STATUS_TONE = { accepted: "good", failed: "bad", skipped: "ok" } as const;
const STATUS_WORD = { accepted: "Handed to provider", failed: "Failed", skipped: "Not sent" } as const;

/** Parent messages: a short, plain result message per learner, sent by SMS or WhatsApp, with an honest log. */
export function MockParents({ data }: { data: MockFull }) {
  const { all, loading, error: snapError } = useMockSnapshots(data);
  const [recips, setRecips] = useState<SmsRecipient[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [channel, setChannel] = useState<Channel>("sms");
  const [note, setNote] = useState("");
  const [includeIncomplete, setIncludeIncomplete] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState("");
  const [err, setErr] = useState("");
  const [log, setLog] = useState<MockMessageRow[]>([]);

  const reloadLog = useCallback(() => {
    MockExamService.messages(data.mock.id).then(setLog).catch(() => setLog([]));
  }, [data.mock.id]);
  useEffect(reloadLog, [reloadLog]);

  useEffect(() => {
    const ids = data.candidates.filter((c) => c.status === "registered").map((c) => c.studentId);
    if (ids.length === 0) {
      setRecLoading(false);
      return;
    }
    CloudSmsService.getRecipients({ studentIds: ids })
      .then(setRecips)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load parent contacts."))
      .finally(() => setRecLoading(false));
  }, [data.candidates]);

  const rows: Row[] = useMemo(() => {
    const byStudent = new Map<string, SmsRecipient[]>();
    recips.forEach((r) => byStudent.set(r.student_id, [...(byStudent.get(r.student_id) ?? []), r]));
    const out: Row[] = [];
    for (const c of data.candidates) {
      if (c.status !== "registered") continue;
      const profile = buildLearnerProfile(c.studentId, all);
      const entry = profile?.entries.find((e) => e.mockId === data.mock.id);
      if (!profile || !entry) continue;
      const guardians = byStudent.get(c.studentId) ?? [];
      const text = composeParentMessage({ schoolName: data.mock.schoolName, mockName: data.mock.name, studentName: c.fullName, entry, profile });
      out.push({
        candidateId: c.id,
        studentId: c.studentId,
        name: c.fullName,
        className: c.className,
        message: note.trim() ? `${text} ${note.trim()}`.slice(0, 470) : text,
        complete: entry.status === "complete",
        guardianIds: guardians.filter((g) => g.sms_opt_in && g.phone).map((g) => g.guardian_id),
        hasPhone: guardians.some((g) => !!g.phone),
        optedIn: guardians.some((g) => g.sms_opt_in),
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [data.candidates, data.mock.id, data.mock.name, data.mock.schoolName, all, recips, note]);

  const eligible = (r: Row) => r.guardianIds.length > 0 && (r.complete || includeIncomplete);
  const why = (r: Row): string | null => {
    if (!r.hasPhone) return "No phone number on file";
    if (!r.optedIn) return "Parent opted out of messages";
    if (!r.complete && !includeIncomplete) return "Result not complete yet";
    return null;
  };

  useEffect(() => {
    setSelected(new Set(rows.filter(eligible).map((r) => r.candidateId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, includeIncomplete, recLoading]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const send = async () => {
    const targets = rows.filter((r) => selected.has(r.candidateId) && eligible(r));
    if (targets.length === 0) return;
    if (!window.confirm(`Send ${channel === "sms" ? "an SMS" : "a WhatsApp message"} to the parents of ${targets.length} learner(s)? This uses your message credits.`)) return;
    setSending(true);
    setErr("");
    let accepted = 0;
    let failed = 0;
    let skipped = 0;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      setProgress(`Sending ${i + 1} of ${targets.length}: ${t.name}`);
      let status: "accepted" | "failed" | "skipped" = "failed";
      let detail = "";
      try {
        if (channel === "sms") {
          const res = await CloudSmsService.send({ guardianIds: t.guardianIds, message: t.message, purpose: "mock_result" });
          status = res.sent > 0 ? "accepted" : "skipped";
          if (status === "skipped") detail = res.skipped[0]?.reason ?? "Not sent.";
        } else {
          const res = await edgeFunctions.invoke<{ results: Array<{ status: "sent" | "failed" | "skipped"; reason?: string }> }>("send-whatsapp", {
            kind: "custom",
            items: [{ studentId: t.studentId }],
            message: t.message,
          });
          const r = res.results?.[0];
          status = r?.status === "sent" ? "accepted" : r?.status === "skipped" ? "skipped" : "failed";
          detail = r?.reason ?? "";
        }
      } catch (e) {
        status = "failed";
        detail = e instanceof Error ? e.message : "Could not send.";
        if (/not enough|INSUFFICIENT|tokens/i.test(detail)) {
          await MockExamService.recordMessage(data.mock.id, t.candidateId, channel, "failed", t.message, detail).catch(() => undefined);
          setErr(detail + " Sending stopped.");
          failed += 1;
          break;
        }
      }
      if (status === "accepted") accepted += 1;
      else if (status === "failed") failed += 1;
      else skipped += 1;
      await MockExamService.recordMessage(data.mock.id, t.candidateId, channel, status, t.message, detail || undefined).catch(() => undefined);
    }
    setProgress(`Done: ${accepted} handed to the ${channel === "sms" ? "SMS" : "WhatsApp"} provider, ${failed} failed, ${skipped} not sent.`);
    setSending(false);
    reloadLog();
  };

  if (loading || recLoading) return <div className="text-muted">Loading learners and parent contacts…</div>;
  if (snapError) return <div className="alert alert-danger">{snapError}</div>;
  const nameOf = (cid: string) => data.candidates.find((c) => c.id === cid)?.fullName ?? "";

  return (
    <div>
      {data.mock.status !== "finalised" && <div className="alert alert-warning small">This mock is not finalised yet. Results may still change, so it is best to finalise before messaging parents.</div>}
      {err && <div className="alert alert-danger">{err}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label small mb-0">Send by</label>
              <select className="form-select form-select-sm" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small mb-0">Optional note added to every message (e.g. PTA date)</label>
              <input className="form-control form-control-sm" maxLength={90} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="col-md-3">
              <div className="form-check">
                <input id="incl" type="checkbox" className="form-check-input" checked={includeIncomplete} onChange={(e) => setIncludeIncomplete(e.target.checked)} />
                <label htmlFor="incl" className="form-check-label small">
                  Also message learners with incomplete results
                </label>
              </div>
            </div>
          </div>
          <div className="small text-muted mt-2">
            Each parent receives only their own child's result, in plain words, marked as a school mock (not an official WAEC result). No rank or other learners' marks are included. Parents who opted out, or have no phone number, are skipped. Messages use your SMS / WhatsApp credits (see “SMS & WhatsApp credits”). “Handed to provider” means the message was accepted for sending; it does not prove the parent has read it.
          </div>
        </div>
      </div>

      <div className="d-flex gap-2 mb-2 align-items-center">
        <button className="btn btn-primary btn-sm" disabled={sending || selected.size === 0} onClick={send}>
          {sending ? "Sending…" : `Send to ${selected.size} parent${selected.size === 1 ? "" : "s"}`}
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelected(new Set(rows.filter(eligible).map((r) => r.candidateId)))}>
          Select all who can receive
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSelected(new Set())}>
          Clear
        </button>
        <span className="small text-muted">{progress}</span>
      </div>

      <div className="table-responsive mb-4">
        <table className="table table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th style={{ width: 36 }} />
              <th>Learner</th>
              <th>Class</th>
              <th>Message preview</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const reason = why(r);
              return (
                <tr key={r.candidateId} className={reason ? "text-muted" : ""}>
                  <td>
                    <input type="checkbox" className="form-check-input" disabled={!eligible(r)} checked={selected.has(r.candidateId)} onChange={() => toggle(r.candidateId)} />
                  </td>
                  <td>{r.name}</td>
                  <td>{r.className}</td>
                  <td className="small" style={{ maxWidth: 520 }}>
                    {open === r.candidateId ? r.message : r.message.slice(0, 90) + (r.message.length > 90 ? "…" : "")}{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); setOpen(open === r.candidateId ? null : r.candidateId); }}>
                      {open === r.candidateId ? "less" : "full message"}
                    </a>
                    <span className="text-muted"> ({r.message.length} characters)</span>
                  </td>
                  <td className="small">{reason ?? <ToneBadge tone="good">Ready</ToneBadge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h6>Message history for this mock</h6>
      {log.length === 0 ? (
        <div className="text-muted small">Nothing sent yet.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm small">
            <thead>
              <tr>
                <th>When</th>
                <th>Learner</th>
                <th>By</th>
                <th>Channel</th>
                <th>Result</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.at).toLocaleString()}</td>
                  <td>{nameOf(m.candidateId)}</td>
                  <td>{m.by ?? "—"}</td>
                  <td>{m.channel === "sms" ? "SMS" : "WhatsApp"}</td>
                  <td>
                    <ToneBadge tone={STATUS_TONE[m.status]}>{STATUS_WORD[m.status]}</ToneBadge>
                  </td>
                  <td>{m.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
