import { useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudSmsService } from "@services/cloud/SmsService";
import type { ClassRow, SmsLogRow, SmsRecipient, SmsSendResult } from "@/types/database";

const QUICK_TEMPLATES: Array<{ label: string; text: string }> = [
  {
    label: "Report ready for pickup",
    text: "Dear parent/guardian, your ward's report for this term is ready for pickup at the school office. Thank you.",
  },
  {
    label: "School closing / reopening",
    text: "Dear parent/guardian, please note the school will be closing on [date] and reopening on [date]. Thank you.",
  },
  {
    label: "General reminder",
    text: "Dear parent/guardian, this is a reminder from the school. Please contact the office for details.",
  },
];

const MAX_MESSAGE_LENGTH = 480;

/**
 * SMS-to-parents - see edulink_gh_phase0x_sms.sql and the
 * send-parent-sms Edge Function. Pick a class, review who will
 * actually be messaged (opted-in guardians with a phone number on
 * file), write or pick a message, and send. A teacher only ever sees
 * their own class(es) here, same restriction as everywhere else - see
 * CloudClassService.forRole().
 */
export function CloudSmsToParents() {
  const { profile } = useCloudAuth();

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [recipients, setRecipients] = useState<SmsRecipient[] | null>(null);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SmsSendResult | null>(null);

  const [history, setHistory] = useState<SmsLogRow[] | null>(null);

  useEffect(() => {
    CloudClassService.list().then((rows) => setClasses(CloudClassService.forRole(rows, profile)));
  }, [profile]);

  useEffect(() => {
    CloudSmsService.recentHistory().then(setHistory).catch(() => setHistory([]));
  }, [sendResult]);

  useEffect(() => {
    if (!classId) {
      setRecipients(null);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    setLoadingRecipients(true);
    setSendResult(null);
    CloudSmsService.getRecipients({ classId })
      .then((rows) => {
        if (cancelled) return;
        setRecipients(rows);
        setSelected(new Set(rows.filter((r) => r.sms_opt_in && r.phone).map((r) => r.guardian_id)));
      })
      .finally(() => !cancelled && setLoadingRecipients(false));
    return () => {
      cancelled = true;
    };
  }, [classId]);

  const eligible = useMemo(() => (recipients ?? []).filter((r) => r.sms_opt_in && r.phone), [recipients]);
  const ineligible = useMemo(() => (recipients ?? []).filter((r) => !r.sms_opt_in || !r.phone), [recipients]);

  function toggle(guardianId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(guardianId)) next.delete(guardianId);
      else next.add(guardianId);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === eligible.length ? new Set() : new Set(eligible.map((r) => r.guardian_id))));
  }

  const canSend = selected.size > 0 && message.trim().length > 0 && message.length <= MAX_MESSAGE_LENGTH && !sending;

  async function handleSend() {
    if (!canSend) return;
    if (!confirm(`Send this message to ${selected.size} guardian${selected.size === 1 ? "" : "s"}?`)) return;
    setSending(true);
    setSendError(null);
    setSendResult(null);
    try {
      const result = await CloudSmsService.send({
        guardianIds: Array.from(selected),
        message: message.trim(),
        classId: classId || undefined,
      });
      setSendResult(result);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h1 className="h4 mb-1">SMS to parents</h1>
      <p className="text-muted mb-4">
        Send a text message to the guardians of a class - term-report notices, closures, or a general reminder.
        Only guardians who have opted in and have a phone number on file will receive it.
      </p>

      <div className="actrs-card p-4 mb-3">
        <label className="form-label small">Class</label>
        <select className="form-select form-select-sm" style={{ maxWidth: 320 }} value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Select a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loadingRecipients && <p className="text-muted">Loading guardians…</p>}

      {recipients && !loadingRecipients && (
        <>
          <div className="actrs-card p-0 mb-3">
            <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
              <h2 className="h6 fw-bold mb-0">
                Guardians ({selected.size} of {eligible.length} selected)
              </h2>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={toggleAll} disabled={eligible.length === 0}>
                {selected.size === eligible.length ? "Deselect all" : "Select all"}
              </button>
            </div>
            {eligible.length === 0 ? (
              <p className="text-muted small p-3 mb-0">No guardians in this class are reachable by SMS yet.</p>
            ) : (
              <table className="table mb-0 align-middle">
                <tbody>
                  {eligible.map((r) => (
                    <tr key={r.guardian_id}>
                      <td style={{ width: 40 }}>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={selected.has(r.guardian_id)}
                          onChange={() => toggle(r.guardian_id)}
                        />
                      </td>
                      <td>{r.student_name}</td>
                      <td className="text-muted small">{r.guardian_name ?? "Guardian"}</td>
                      <td className="text-muted small">{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {ineligible.length > 0 && (
              <p className="text-muted small p-3 mb-0 border-top">
                {ineligible.length} guardian{ineligible.length === 1 ? "" : "s"} skipped (opted out or no phone on file).
              </p>
            )}
          </div>

          <div className="actrs-card p-4 mb-3">
            <label className="form-label small">Message</label>
            <div className="d-flex flex-wrap gap-2 mb-2">
              {QUICK_TEMPLATES.map((t) => (
                <button key={t.label} type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setMessage(t.text)}>
                  {t.label}
                </button>
              ))}
            </div>
            <textarea
              className="form-control"
              rows={4}
              maxLength={MAX_MESSAGE_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message…"
            />
            <div className="text-muted small mt-1 text-end">
              {message.length} / {MAX_MESSAGE_LENGTH}
            </div>
          </div>

          {sendError && <div className="alert alert-danger py-2">{sendError}</div>}
          {sendResult && (
            <div className={`alert ${sendResult.skipped.length ? "alert-warning" : "alert-success"} py-2`}>
              <div>Sent to {sendResult.sent} guardian{sendResult.sent === 1 ? "" : "s"}.</div>
              {sendResult.skipped.length > 0 && (
                <ul className="mb-0 mt-1 small">
                  {sendResult.skipped.map((s, i) => (
                    <li key={i}>{s.reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button type="button" className="btn btn-primary" disabled={!canSend} onClick={handleSend}>
            {sending ? "Sending…" : `Send to ${selected.size} guardian${selected.size === 1 ? "" : "s"}`}
          </button>
        </>
      )}

      {history && history.length > 0 && (
        <div className="actrs-card p-0 mt-4">
          <div className="p-3 border-bottom">
            <h2 className="h6 fw-bold mb-0">Recent messages</h2>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Sent</th>
                  <th>Guardian</th>
                  <th>Phone</th>
                  <th>Message</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((h) => (
                  <tr key={h.id}>
                    <td className="text-muted small">{new Date(h.sent_at).toLocaleString()}</td>
                    <td className="small">{h.guardian_name ?? "—"}</td>
                    <td className="text-muted small">{h.phone}</td>
                    <td className="small" style={{ maxWidth: 320 }}>
                      {h.message}
                    </td>
                    <td>
                      <span className={`badge ${h.status === "sent" ? "text-bg-success" : "text-bg-danger"}`}>{h.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
