import { Fragment, useMemo, useState } from "react";
import type { MockFull } from "@/services/cloud/MockExamService";
import { buildLearnerProfile, type LearnerLabel, type LearnerProfile } from "@/mock/mockAnalysis";
import { useMockSnapshots } from "@pages/cloud/mock/useMockSnapshots";
import { Sparkline, ToneBadge } from "@pages/cloud/mock/MockUi";

const FILTERS: Array<[LearnerLabel | "attention" | "all", string]> = [
  ["all", "Everyone"],
  ["attention", "Needs attention"],
  ["declining", "Slipping"],
  ["steady", "Holding steady"],
  ["improving", "Improving"],
];

/** Learner progress: one line per learner, a trend arrow in plain words, and a short sentence. */
export function MockLearners({ data }: { data: MockFull }) {
  const { all, loading, error } = useMockSnapshots(data);
  const [filter, setFilter] = useState<LearnerLabel | "attention" | "all">("all");
  const [cls, setCls] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const out: Array<{ studentId: string; className: string; profile: LearnerProfile }> = [];
    for (const c of data.candidates) {
      if (c.status === "excluded") continue;
      const p = buildLearnerProfile(c.studentId, all);
      if (p) out.push({ studentId: c.studentId, className: c.className, profile: p });
    }
    return out.sort((a, b) => a.profile.fullName.localeCompare(b.profile.fullName));
  }, [data.candidates, all]);

  const classes = [...new Set(rows.map((r) => r.className))].sort();
  const counts = {
    improving: rows.filter((r) => r.profile.label === "improving").length,
    steady: rows.filter((r) => r.profile.label === "steady").length,
    declining: rows.filter((r) => r.profile.label === "declining").length,
  };
  const needsAttention = (p: LearnerProfile) => p.label === "declining" || p.supportFlags.length > 0 || p.passing === false;
  const shown = rows.filter(
    (r) =>
      (!cls || r.className === cls) &&
      (!q || r.profile.fullName.toLowerCase().includes(q.toLowerCase())) &&
      (filter === "all" || (filter === "attention" ? needsAttention(r.profile) : r.profile.label === filter))
  );

  if (loading) return <div className="text-muted">Building learner profiles…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  const lower = data.mock.grading.lowerIsBetter;

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-3">
        <ToneBadge tone="good">{counts.improving} improving</ToneBadge>
        <ToneBadge tone="ok">{counts.steady} holding steady</ToneBadge>
        <ToneBadge tone="bad">{counts.declining} slipping</ToneBadge>
        <span className="small text-muted align-self-center">
          Trends need at least two comparable mocks with full results. A missing mark or a different grading scale is never counted as a decline.
        </span>
      </div>
      <div className="d-flex flex-wrap gap-2 mb-2 align-items-end">
        <div className="btn-group btn-group-sm">
          {FILTERS.map(([k, label]) => (
            <button key={k} className={`btn ${filter === k ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>
        <select className="form-select form-select-sm w-auto" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className="form-control form-control-sm w-auto" placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="table-responsive">
        <table className="table align-middle">
          <thead className="table-light">
            <tr>
              <th>Learner</th>
              <th>Class</th>
              <th>Aggregate over time</th>
              <th>Latest</th>
              <th>Progress</th>
              <th>In plain words</th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ studentId, className, profile: p }) => {
              const latest = [...p.entries].reverse().find((e) => e.aggregate !== null);
              return (
                <Fragment key={studentId}>
                  <tr style={{ cursor: "pointer" }} onClick={() => setOpen(open === studentId ? null : studentId)}>
                    <td className="fw-semibold">{p.fullName}</td>
                    <td>{className}</td>
                    <td>
                      <Sparkline values={p.entries.map((e) => e.aggregate)} lowerIsBetter={lower} />
                    </td>
                    <td>
                      {latest ? (
                        <>
                          {latest.aggregate}{" "}
                          <span className="small text-muted">{p.passing === null ? "" : p.passing ? "(pass level)" : "(below pass level)"}</span>
                        </>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <ToneBadge tone={p.tone}>{p.headline}</ToneBadge>
                    </td>
                    <td className="small">{p.sentence}</td>
                  </tr>
                  {open === studentId && (
                    <tr>
                      <td colSpan={6} className="bg-light">
                        <div className="table-responsive">
                          <table className="table table-sm table-bordered bg-white mb-2">
                            <thead>
                              <tr>
                                <th>Mock</th>
                                <th>Aggregate</th>
                                <th>Grades</th>
                              </tr>
                            </thead>
                            <tbody>
                              {p.entries.map((e) => (
                                <tr key={e.mockId}>
                                  <td>{e.mockName}</td>
                                  <td>{e.aggregate ?? <span className="text-muted">Incomplete</span>}</td>
                                  <td className="small">
                                    {e.subjectGrades.map((g) => `${g.name} ${g.grade} (${g.pct}%)`).join(" · ") || "—"}
                                    {e.missing.length > 0 && <span className="text-muted"> · waiting for: {e.missing.join(", ")}</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {p.supportFlags.length > 0 && (
                          <div className="small">
                            <strong>Early support signals</strong> (to prompt a teacher's judgement, not a diagnosis):
                            <ul className="mb-1">
                              {p.supportFlags.map((f) => (
                                <li key={f}>{f}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {p.summary.reasons.length > 0 && <div className="small text-muted">{p.summary.reasons.join(" ")}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No learners match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
