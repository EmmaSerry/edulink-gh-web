import { useMemo, useState } from "react";
import type { MockFull } from "@/services/cloud/MockExamService";
import { assessComparability, type ComparabilityLevel } from "@/mock/mockEngine";
import { analyseSubjects, compareSubjects, compareSummaries, summariseSchool, type Direction, type MockSnapshot, type Tone } from "@/mock/mockAnalysis";
import { useMockSnapshots } from "@pages/cloud/mock/useMockSnapshots";
import { TONE_COLOR, ToneBadge } from "@pages/cloud/mock/MockUi";

const LEVEL_TEXT: Record<ComparabilityLevel, { tone: Tone; word: string; sentence: string }> = {
  comparable: { tone: "good", word: "Fair to compare", sentence: "Same subjects, same grading and the same learners, so the change below is meaningful." },
  comparable_with_limitations: { tone: "ok", word: "Compare with care", sentence: "These two mocks can be compared, but read the notes below first." },
  not_directly_comparable: { tone: "bad", word: "Not directly comparable", sentence: "These mocks were graded or built differently, so improvement or decline is NOT stated. Figures are shown side by side only." },
  insufficient_data: { tone: "na", word: "Not enough data", sentence: "Too little in common to compare." },
};

const DIR_STYLE: Record<Direction, { tone: Tone; word: string }> = {
  improved: { tone: "good", word: "Better" },
  declined: { tone: "bad", word: "Weaker" },
  same: { tone: "ok", word: "Same" },
  na: { tone: "na", word: "—" },
};

function summarise(snap: MockSnapshot) {
  const cands = snap.candidates.map((c) => ({ id: c.id, status: c.status, gender: null as string | null }));
  return {
    summary: summariseSchool(
      cands,
      snap.results.map((r) => ({ candidateId: r.candidateId, status: r.status, aggregate: r.aggregate }))
    ),
    subjects: analyseSubjects(snap.subjects, cands, snap.marks, snap.grading),
  };
}

export function MockCompare({ data }: { data: MockFull }) {
  const { others, currentSnap, loading, error } = useMockSnapshots(data);
  const earlier = useMemo(() => others.filter((o) => o.date <= currentSnap.date || !o.date), [others, currentSnap.date]);
  const [pick, setPick] = useState("");

  const prev = earlier.find((o) => o.mockId === pick) ?? (earlier.length ? earlier[earlier.length - 1] : null);

  const view = useMemo(() => {
    if (!prev) return null;
    const a = summarise(prev);
    const b = summarise(currentSnap);
    const report = assessComparability(
      { id: prev.mockId, name: prev.mockName, subjects: prev.subjects, grading: prev.grading, studentIds: prev.candidates.filter((c) => c.status !== "excluded").map((c) => c.studentId), pctComplete: null },
      { id: currentSnap.mockId, name: currentSnap.mockName, subjects: currentSnap.subjects, grading: currentSnap.grading, studentIds: currentSnap.candidates.filter((c) => c.status !== "excluded").map((c) => c.studentId), pctComplete: null },
      3
    );
    // Same learners who have a full result in BOTH mocks.
    const prevAgg = new Map<string, { agg: number; name: string }>();
    prev.candidates.forEach((c) => {
      const r = prev.results.find((x) => x.candidateId === c.id);
      if (r?.status === "complete" && r.aggregate !== null) prevAgg.set(c.studentId, { agg: r.aggregate, name: c.fullName });
    });
    const movers: Array<{ name: string; before: number; after: number; change: number }> = [];
    currentSnap.candidates.forEach((c) => {
      const r = currentSnap.results.find((x) => x.candidateId === c.id);
      const p = prevAgg.get(c.studentId);
      if (r?.status === "complete" && r.aggregate !== null && p) movers.push({ name: c.fullName, before: p.agg, after: r.aggregate, change: p.agg - r.aggregate });
    });
    const lower = currentSnap.grading.lowerIsBetter;
    const good = (m: { change: number }) => (lower ? m.change : -m.change);
    return {
      a,
      b,
      report,
      rows: compareSummaries(a.summary, b.summary),
      subjectRows: compareSubjects(a.subjects, b.subjects, lower),
      movers,
      improved: movers.filter((m) => good(m) >= 3).length,
      slipped: movers.filter((m) => good(m) <= -3).length,
      steady: movers.filter((m) => Math.abs(m.change) < 3).length,
      gains: [...movers].sort((x, y) => good(y) - good(x)).filter((m) => good(m) >= 3).slice(0, 5),
      drops: [...movers].sort((x, y) => good(x) - good(y)).filter((m) => good(m) <= -3).slice(0, 5),
    };
  }, [prev, currentSnap]);

  if (loading) return <div className="text-muted">Loading your other mocks…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!prev || !view) return <div className="alert alert-info">Comparison appears once this school has an earlier mock (open, closed or finalised). Create “Mock 1” and “Mock 2” and come back.</div>;

  const lv = LEVEL_TEXT[view.report.level];
  const showDirection = view.report.level !== "not_directly_comparable" && view.report.level !== "insufficient_data";

  return (
    <div>
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div>
          <label className="form-label small mb-0">Compare {currentSnap.mockName} with</label>
          <select className="form-select form-select-sm" value={prev.mockId} onChange={(e) => setPick(e.target.value)}>
            {earlier.map((o) => (
              <option key={o.mockId} value={o.mockId}>
                {o.mockName}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card mb-3" style={{ borderColor: TONE_COLOR[lv.tone].border, background: TONE_COLOR[lv.tone].bg }}>
        <div className="card-body">
          <ToneBadge tone={lv.tone}>{lv.word}</ToneBadge>
          <div className="mt-2">{lv.sentence}</div>
          {view.report.reasons.length > 0 && (
            <ul className="small mb-0 mt-2">
              {view.report.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold">
          {prev.mockName} → {currentSnap.mockName}
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th>Measure</th>
                <th className="text-end">{prev.mockName}</th>
                <th className="text-end">{currentSnap.mockName}</th>
                <th>Change</th>
                <th>In plain words</th>
              </tr>
            </thead>
            <tbody>
              {view.rows.map((r) => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td className="text-end">{r.before === null ? "—" : r.before + (r.unit === "%" ? "%" : "")}</td>
                  <td className="text-end">{r.after === null ? "—" : r.after + (r.unit === "%" ? "%" : "")}</td>
                  <td>{showDirection ? <ToneBadge tone={DIR_STYLE[r.direction].tone}>{DIR_STYLE[r.direction].word}</ToneBadge> : "—"}</td>
                  <td className="small">{showDirection ? r.sentence : "Shown side by side only."}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card-footer small text-muted">
          Based on {view.a.summary.assessed} learner(s) with a full result in {prev.mockName} and {view.b.summary.assessed} in {currentSnap.mockName}. Lower aggregate is better.
        </div>
      </div>

      {view.movers.length >= 3 && showDirection && (
        <div className="card mb-3">
          <div className="card-header fw-semibold">The same learners, one mock to the next</div>
          <div className="card-body">
            <div className="mb-2">
              Of <strong>{view.movers.length}</strong> learners with a full result in both mocks:{" "}
              <ToneBadge tone="good">{view.improved} improved</ToneBadge> <ToneBadge tone="ok">{view.steady} about the same</ToneBadge> <ToneBadge tone="bad">{view.slipped} slipped</ToneBadge>
            </div>
            <div className="small text-muted mb-2">“Improved/slipped” means the aggregate moved by 3 points or more.</div>
            <div className="row">
              <div className="col-md-6">
                <div className="fw-semibold small">Biggest improvements</div>
                {view.gains.length === 0 ? (
                  <div className="text-muted small">None.</div>
                ) : (
                  <ul className="small mb-0">
                    {view.gains.map((m) => (
                      <li key={m.name}>
                        {m.name}: {m.before} → {m.after}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="col-md-6">
                <div className="fw-semibold small">Needs a conversation</div>
                {view.drops.length === 0 ? (
                  <div className="text-muted small">None.</div>
                ) : (
                  <ul className="small mb-0">
                    {view.drops.map((m) => (
                      <li key={m.name}>
                        {m.name}: {m.before} → {m.after}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header fw-semibold">Subject by subject</div>
        <ul className="list-group list-group-flush">
          {view.subjectRows.map((r) => (
            <li key={r.code} className="list-group-item d-flex justify-content-between gap-2">
              <span className="small">{showDirection ? r.sentence : `${r.name}: average grade ${r.beforeMeanGrade ?? "—"} → ${r.afterMeanGrade ?? "—"}.`}</span>
              {showDirection && <ToneBadge tone={DIR_STYLE[r.direction].tone}>{DIR_STYLE[r.direction].word}</ToneBadge>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
