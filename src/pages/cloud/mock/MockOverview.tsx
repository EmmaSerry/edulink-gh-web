import { useMemo } from "react";
import type { MockFull } from "@/services/cloud/MockExamService";
import { computeCandidateResult } from "@/mock/mockEngine";
import {
  AGGREGATE_BANDS,
  analyseSubjects,
  averageAggregateVerdict,
  completenessVerdict,
  passRateVerdict,
  rankSubjects,
  schoolInsights,
  summariseSchool,
} from "@/mock/mockAnalysis";
import { Bar, DISCLAIMER, TONE_COLOR, ToneBadge, VerdictCard } from "@pages/cloud/mock/MockUi";

export function useMockAnalysis(data: MockFull) {
  return useMemo(() => {
    const { mock, subjects, candidates, marks } = data;
    const results = candidates.map((c) => computeCandidateResult(c, subjects, marks, mock.grading));
    const summary = summariseSchool(
      candidates.map((c) => ({ id: c.id, status: c.status, gender: c.gender })),
      results.map((r) => ({ candidateId: r.candidateId, status: r.status, aggregate: r.aggregate }))
    );
    const subjectList = analyseSubjects(subjects, candidates.map((c) => ({ id: c.id, status: c.status, gender: c.gender })), marks, mock.grading);
    return { results, summary, subjectList, insights: schoolInsights(summary, subjectList, mock.grading.lowerIsBetter) };
  }, [data]);
}

/** "How are we doing?" - the one-screen, plain-language summary of this mock. */
export function MockOverview({ data }: { data: MockFull }) {
  const a = useMockAnalysis(data);
  const s = a.summary;
  const pv = passRateVerdict(s.passPct, s.assessed);
  const av = averageAggregateVerdict(s.avgAggregate);
  const cv = completenessVerdict(s.assessed, s.present);
  const ranked = rankSubjects(a.subjectList, data.mock.grading.lowerIsBetter).filter((x) => x.valid >= 5);
  const maxBand = Math.max(1, ...AGGREGATE_BANDS.map((b) => s.bandCounts[b.key]));
  const bandColor = ["#146c43", "#3a9d6b", "#7bc096", "#e3b341", "#e08a5b", "#c0392b"];

  return (
    <div>
      <div className="row g-3 mb-3">
        <VerdictCard label="Learners who passed" value={s.passPct === null ? "—" : `${s.passPct}%`} tone={pv.tone} word={pv.word} sentence={pv.sentence} />
        <VerdictCard label="Average aggregate" value={s.avgAggregate ?? "—"} tone={av.tone} word={av.word} sentence={av.sentence} />
        <VerdictCard label="Results complete" value={`${s.assessed} / ${s.present}`} tone={cv.tone} word={cv.word} sentence={cv.sentence} />
        <VerdictCard
          label="Best learner"
          value={s.bestAggregate ?? "—"}
          tone={s.bestAggregate === null ? "na" : "good"}
          word={s.bestAggregate === null ? "No result yet" : "Best aggregate"}
          sentence={s.bestAggregate === null ? "Enter marks to see the best result." : `${s.bandCounts.a06 ? s.bandCounts.a06 + " learner(s) in Aggregate 06. " : ""}Lower is better.`}
        />
      </div>

      <div className="card mb-3">
        <div className="card-header fw-semibold">What this means, in plain words</div>
        <ul className="list-group list-group-flush">
          {a.insights.map((i, k) => (
            <li key={k} className="list-group-item d-flex gap-2 align-items-start">
              <span style={{ color: TONE_COLOR[i.tone].fg, fontWeight: 700 }}>{TONE_COLOR[i.tone].icon}</span>
              <span>{i.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">How many learners in each aggregate band</div>
            <div className="card-body">
              {AGGREGATE_BANDS.map((b, i) => (
                <div key={b.key} className="d-flex align-items-center gap-2 mb-2">
                  <div style={{ width: 130 }} className="small">
                    {b.label}
                  </div>
                  <Bar value={s.bandCounts[b.key]} max={maxBand} color={bandColor[i]} />
                  <div style={{ width: 70 }} className="small text-end">
                    {s.bandCounts[b.key]}
                    {s.assessed ? ` (${Math.round((s.bandCounts[b.key] / s.assessed) * 100)}%)` : ""}
                  </div>
                </div>
              ))}
              <div className="small text-muted mt-2">Pass level is aggregate 30 or better. Based on {s.assessed} learner(s) with a full result.</div>
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card h-100">
            <div className="card-header fw-semibold">Subjects, strongest to weakest</div>
            <div className="card-body">
              {ranked.length === 0 ? (
                <div className="text-muted">Not enough marks yet (a subject needs at least 5).</div>
              ) : (
                ranked.map((x) => (
                  <div key={x.subjectId} className="d-flex align-items-center gap-2 mb-2">
                    <div style={{ width: 140 }} className="small text-truncate" title={x.name}>
                      {x.name}
                    </div>
                    <Bar value={x.passPct ?? 0} max={100} color={TONE_COLOR[x.verdict.tone].fg} />
                    <div style={{ width: 150 }} className="small text-end">
                      {x.passPct}% passed <ToneBadge tone={x.verdict.tone}>{x.verdict.word}</ToneBadge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {(s.male.assessed >= 3 || s.female.assessed >= 3) && (
        <div className="card mb-3">
          <div className="card-header fw-semibold">Boys and girls</div>
          <div className="card-body small">
            <div className="row">
              <div className="col-md-6">
                Boys: {s.male.assessed} with a full result · {s.male.passPct === null ? "—" : `${s.male.passPct}% passed`} · average aggregate {s.male.avgAggregate ?? "—"}
              </div>
              <div className="col-md-6">
                Girls: {s.female.assessed} with a full result · {s.female.passPct === null ? "—" : `${s.female.passPct}% passed`} · average aggregate {s.female.avgAggregate ?? "—"}
              </div>
            </div>
          </div>
        </div>
      )}
      <p className="small text-muted">
        {s.registered} registered · {s.present} sat · {s.absent} absent · {s.incomplete} still waiting for marks. {DISCLAIMER}
      </p>
    </div>
  );
}
