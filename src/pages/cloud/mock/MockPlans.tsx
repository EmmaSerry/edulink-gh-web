import { useCallback, useEffect, useState } from "react";
import { MockExamService, type InterventionPlan } from "@/services/cloud/MockExamService";
import { ToneBadge } from "@pages/cloud/mock/MockUi";

const STATUS_WORD: Record<InterventionPlan["status"], string> = { planned: "Planned", in_progress: "In progress", done: "Done", cancelled: "Cancelled" };
const STATUS_TONE = { planned: "ok", in_progress: "ok", done: "good", cancelled: "na" } as const;

interface Draft {
  id: string | null;
  schoolId: string | null;
  mockId: string | null;
  subjectCode: string;
  subjectName: string;
  title: string;
  action: string;
  responsible: string;
  dueDate: string;
  status: InterventionPlan["status"];
  outcome: string;
}

const blank = (schoolId: string | null, mockId: string | null): Draft => ({
  id: null,
  schoolId,
  mockId,
  subjectCode: "",
  subjectName: "",
  title: "",
  action: "",
  responsible: "",
  dueDate: "",
  status: "planned",
  outcome: "",
});

/**
 * Improvement plans: "what are we going to do about it?" A school or the district can record a plan for a
 * subject, say who is responsible and by when, then record the outcome. Compare the next mock to see whether it helped
 * (a change after a plan is a prompt for discussion, not proof the plan caused it).
 */
export function MockPlans({
  schoolId,
  mockId,
  suggestions,
  canEdit,
  schoolOptions,
}: {
  schoolId: string | null;
  mockId: string | null;
  suggestions: Array<{ code: string; name: string; reason: string }>;
  canEdit: boolean;
  /** District view: lets the administrator choose which school the plan is for. */
  schoolOptions?: Array<{ id: string; name: string }>;
}) {
  const [plans, setPlans] = useState<InterventionPlan[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    MockExamService.interventions(schoolId)
      .then(setPlans)
      .catch((e) => setErr(e instanceof Error ? e.message : "Could not load plans."));
  }, [schoolId]);
  useEffect(load, [load]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setErr("");
    try {
      await MockExamService.saveIntervention({
        id: draft.id,
        schoolId: draft.schoolId,
        mockId: draft.mockId,
        subjectCode: draft.subjectCode || null,
        subjectName: draft.subjectName || null,
        title: draft.title,
        action: draft.action,
        responsible: draft.responsible,
        dueDate: draft.dueDate || null,
        status: draft.status,
        outcome: draft.outcome,
      });
      setDraft(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {err && <div className="alert alert-danger">{err}</div>}
      {canEdit && !draft && (
        <div className="mb-3 d-flex flex-wrap gap-2 align-items-center">
          <button className="btn btn-primary btn-sm" onClick={() => setDraft(blank(schoolId, mockId))}>
            New improvement plan
          </button>
          {suggestions.map((s) => (
            <button
              key={s.code}
              className="btn btn-outline-danger btn-sm"
              title={s.reason}
              onClick={() => setDraft({ ...blank(schoolId, mockId), subjectCode: s.code, subjectName: s.name, title: `Improve ${s.name}` })}
            >
              Plan for {s.name}
            </button>
          ))}
        </div>
      )}

      {draft && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-2">
              {schoolOptions && !draft.id && (
                <div className="col-md-12">
                  <label className="form-label small mb-0">School</label>
                  <select className="form-select form-select-sm" value={draft.schoolId ?? ""} onChange={(e) => setDraft({ ...draft, schoolId: e.target.value || null })}>
                    <option value="">Choose a school…</option>
                    {schoolOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-md-6">
                <label className="form-label small mb-0">What is the plan? (short title)</label>
                <input className="form-control form-control-sm" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">Subject (optional)</label>
                <input className="form-control form-control-sm" value={draft.subjectName} onChange={(e) => setDraft({ ...draft, subjectName: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">Status</label>
                <select className="form-select form-select-sm" value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Draft["status"] })}>
                  {(Object.keys(STATUS_WORD) as Array<InterventionPlan["status"]>).map((k) => (
                    <option key={k} value={k}>
                      {STATUS_WORD[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label small mb-0">What will be done?</label>
                <textarea className="form-control form-control-sm" rows={2} value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value })} />
              </div>
              <div className="col-md-6">
                <label className="form-label small mb-0">Who is responsible?</label>
                <input className="form-control form-control-sm" value={draft.responsible} onChange={(e) => setDraft({ ...draft, responsible: e.target.value })} />
              </div>
              <div className="col-md-3">
                <label className="form-label small mb-0">Due date</label>
                <input type="date" className="form-control form-control-sm" value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
              </div>
              <div className="col-12">
                <label className="form-label small mb-0">Outcome (fill in later)</label>
                <textarea className="form-control form-control-sm" rows={2} value={draft.outcome} onChange={(e) => setDraft({ ...draft, outcome: e.target.value })} />
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <button className="btn btn-primary btn-sm" disabled={busy || !draft.title.trim() || (!!schoolOptions && !draft.schoolId)} onClick={save}>
                {busy ? "Saving…" : "Save plan"}
              </button>
              <button className="btn btn-outline-secondary btn-sm" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        <div className="text-muted">No improvement plans yet.</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead className="table-light">
              <tr>
                <th>School</th>
                <th>Plan</th>
                <th>Subject</th>
                <th>Responsible</th>
                <th>Due</th>
                <th>Status</th>
                <th>Outcome</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="small">{p.schoolName}</td>
                  <td>
                    <div className="fw-semibold">{p.title}</div>
                    <div className="small text-muted">{p.action}</div>
                    <div className="small text-muted">Started by {p.startedByRole === "district_admin" ? "the district" : "the school"}</div>
                  </td>
                  <td>{p.subjectName ?? "—"}</td>
                  <td>{p.responsible ?? "—"}</td>
                  <td>{p.dueDate ?? "—"}</td>
                  <td>
                    <ToneBadge tone={STATUS_TONE[p.status]}>{STATUS_WORD[p.status]}</ToneBadge>
                  </td>
                  <td className="small">{p.outcome ?? ""}</td>
                  <td>
                    {canEdit && (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          setDraft({
                            id: p.id,
                            schoolId: p.schoolId,
                            mockId: p.mockId,
                            subjectCode: p.subjectCode ?? "",
                            subjectName: p.subjectName ?? "",
                            title: p.title,
                            action: p.action ?? "",
                            responsible: p.responsible ?? "",
                            dueDate: p.dueDate ?? "",
                            status: p.status,
                            outcome: p.outcome ?? "",
                          })
                        }
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
