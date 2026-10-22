import { Fragment, useEffect, useMemo, useState } from "react";
import { MockExamService, type DistrictMockRow } from "@/services/cloud/MockExamService";
import { buildDistrictView, districtSubjectRollup } from "@/mock/mockAnalysis";
import { Bar, DISCLAIMER, TONE_COLOR, ToneBadge, VerdictCard } from "@pages/cloud/mock/MockUi";
import { MockPlans } from "@pages/cloud/mock/MockPlans";

function arrow(change: number | null, unit: string, higherIsBetter = true): string {
  if (change === null) return "—";
  if (change === 0) return "no change";
  const good = higherIsBetter ? change > 0 : change < 0;
  return `${good ? "▲" : "▼"} ${Math.abs(change)}${unit}`;
}

/** District view of mock examinations: aggregate figures only, never learner names or marks. */
export function CloudMockDistrict() {
  const [rows, setRows] = useState<DistrictMockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [circuit, setCircuit] = useState("");
  const [tab, setTab] = useState<"schools" | "subjects" | "plans">("schools");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    MockExamService.districtOverview()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load."))
      .finally(() => setLoading(false));
  }, []);

  const circuits = [...new Set(rows.map((r) => r.circuit).filter((c): c is string => !!c))].sort();
  const filtered = useMemo(() => (circuit ? rows.filter((r) => r.circuit === circuit) : rows), [rows, circuit]);
  const view = useMemo(() => buildDistrictView(filtered), [filtered]);
  const subjects = useMemo(() => districtSubjectRollup(filtered), [filtered]);

  const totals = useMemo(() => {
    const ok = view.filter((v) => v.latest.assessed >= 5);
    const assessed = ok.reduce((s, v) => s + v.latest.assessed, 0);
    const passed = ok.reduce((s, v) => s + Math.round(((v.latest.passPct ?? 0) / 100) * v.latest.assessed), 0);
    return {
      schools: view.length,
      priority: view.filter((v) => v.support === "priority").length,
      positive: view.filter((v) => v.support === "positive").length,
      insufficient: view.filter((v) => v.support === "insufficient").length,
      passPct: assessed ? Math.round((passed / assessed) * 1000) / 10 : null,
      assessed,
    };
  }, [view]);

  if (loading) return <div className="text-muted">Loading…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const schoolOptions = view.map((v) => ({ id: v.schoolId, name: v.schoolName }));

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h4 className="mb-0">Mock Exams: district view</h4>
          <div className="text-muted small">Each school's latest mock, in plain words. Figures only: no learner names or marks.</div>
        </div>
        <select className="form-select form-select-sm w-auto" value={circuit} onChange={(e) => setCircuit(e.target.value)}>
          <option value="">All circuits</option>
          {circuits.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="row g-3 mb-3">
        <VerdictCard label="Schools with mock results" value={totals.schools} tone={totals.schools ? "ok" : "na"} word={totals.schools ? "Reporting" : "None yet"} sentence={`${totals.insufficient} school(s) do not have enough complete results yet.`} />
        <VerdictCard label="District pass rate" value={totals.passPct === null ? "—" : `${totals.passPct}%`} tone={totals.passPct === null ? "na" : totals.passPct >= 80 ? "good" : totals.passPct >= 60 ? "ok" : "bad"} word={totals.passPct === null ? "Not enough data" : totals.passPct >= 80 ? "Strong" : totals.passPct >= 60 ? "Fair" : "Needs attention"} sentence={`Across ${totals.assessed} learners with a full result (schools with at least 5 only).`} />
        <VerdictCard label="Priority support recommended" value={totals.priority} tone={totals.priority ? "bad" : "good"} word={totals.priority ? "Schools to prioritise" : "None"} sentence="Schools whose pass rate or average aggregate is outside the usual level." />
        <VerdictCard label="Progressing positively" value={totals.positive} tone={totals.positive ? "good" : "na"} word="Doing well" sentence="Schools with a strong pass rate and no major subject concerns." />
      </div>

      <ul className="nav nav-tabs mb-3">
        {([["schools", "Schools"], ["subjects", "Subjects across the district"], ["plans", "Improvement plans"]] as const).map(([k, label]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === "schools" && (
        <div className="table-responsive">
          <table className="table align-middle">
            <thead className="table-light">
              <tr>
                <th>Position</th>
                <th>School</th>
                <th>Circuit</th>
                <th>Latest mock</th>
                <th className="text-end">Pass rate</th>
                <th className="text-end">Average aggregate</th>
                <th>Since earlier mock</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              {view.map((v) => (
                <Fragment key={v.schoolId}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpen(open === v.schoolId ? null : v.schoolId)}>
                    <td>{v.rank ?? "—"}</td>
                    <td className="fw-semibold">{v.schoolName}</td>
                    <td>{v.circuit ?? "—"}</td>
                    <td className="small">
                      {v.latest.mockName}
                      <div className="text-muted">
                        {v.latest.assessed} of {v.latest.present} with full result
                      </div>
                    </td>
                    <td className="text-end">{v.latest.passPct === null ? "—" : `${v.latest.passPct}%`}</td>
                    <td className="text-end">{v.latest.avgAggregate ?? "—"}</td>
                    <td className="small">
                      Pass rate {arrow(v.passChange, " pts")}
                      <br />
                      Aggregate {arrow(v.avgChange, " pts")}
                    </td>
                    <td>
                      <ToneBadge tone={v.tone}>{v.supportWord}</ToneBadge>
                    </td>
                  </tr>
                  {open === v.schoolId && (
                    <tr>
                      <td colSpan={8} style={{ background: TONE_COLOR[v.tone].bg }}>
                        <div className="row">
                          <div className="col-md-4">
                            <div className="fw-semibold small">Why this classification</div>
                            <ul className="small mb-0">{v.factors.map((f) => <li key={f}>{f}</li>)}</ul>
                          </div>
                          <div className="col-md-4">
                            <div className="fw-semibold small">Subjects needing support</div>
                            {v.flaggedSubjects.length === 0 ? (
                              <div className="small text-muted">None flagged.</div>
                            ) : (
                              <ul className="small mb-0">{v.flaggedSubjects.map((s) => <li key={s.name}>{s.name}: {s.passPct}% passed, average grade {s.meanGrade}</li>)}</ul>
                            )}
                          </div>
                          <div className="col-md-4">
                            <div className="fw-semibold small">Please keep in mind</div>
                            <ul className="small mb-0">{v.limitations.map((l) => <li key={l}>{l}</li>)}</ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {view.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-muted">
                    No school has opened a mock yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <p className="small text-muted">
            Position uses grade points divided by average aggregate, as in the WAC analysis; only schools with at least 5 full results are ranked. {DISCLAIMER}
          </p>
        </div>
      )}

      {tab === "subjects" && (
        <div className="card">
          <div className="card-body">
            {subjects.length === 0 ? (
              <div className="text-muted">No subject data yet.</div>
            ) : (
              subjects.map((s) => (
                <div key={s.code} className="d-flex align-items-center gap-2 mb-2">
                  <div style={{ width: 180 }} className="small text-truncate">{s.name}</div>
                  <Bar value={s.passPct ?? 0} max={100} color={(s.passPct ?? 0) < 60 ? "#a52a2a" : (s.passPct ?? 0) < 80 ? "#8a6100" : "#146c43"} />
                  <div style={{ width: 280 }} className="small text-end">
                    {s.passPct}% passed · avg grade {s.meanGrade} · {s.schoolsFlagged} of {s.schools} school(s) flagged
                  </div>
                </div>
              ))
            )}
            <div className="small text-muted mt-2">Weakest subjects first. Counts come from each school's latest mock.</div>
          </div>
        </div>
      )}

      {tab === "plans" && <MockPlans schoolId={null} mockId={null} suggestions={[]} canEdit schoolOptions={schoolOptions} />}
    </div>
  );
}
