/** Builds the data for a result slip from a loaded mock (pure; no PDF code). */
import type { MockFull } from "@/services/cloud/MockExamService";
import { computeCandidateResult, gradeForMark, rankCandidates } from "./mockEngine";
import { buildLearnerProfile, DEFAULT_ANALYSIS_CONFIG, type MockSnapshot } from "./mockAnalysis";
import { slipCode, type SlipData, type SlipRow } from "./slipPdf";

export interface SlipSchool {
  name: string;
  address?: string | null;
  headTeacher?: string | null;
  logoDataUrl?: string | null;
}

export interface SlipOptions {
  includePosition: boolean;
  generatedOn: string;
  passAggregate?: number;
}

export function buildSlip(data: MockFull, candidateId: string, history: MockSnapshot[], school: SlipSchool, opts: SlipOptions): SlipData | null {
  const { mock, subjects, candidates, marks } = data;
  const cand = candidates.find((c) => c.id === candidateId);
  if (!cand || cand.status === "excluded") return null;

  const result = computeCandidateResult(cand, subjects, marks, mock.grading);
  const counted = new Set(result.contributing.map((c) => c.code));
  const rows: SlipRow[] = subjects.map((s) => {
    const m = marks.find((x) => x.candidateId === cand.id && x.subjectId === s.id);
    const band = m && m.status === "entered" && m.mark !== null ? gradeForMark(m.mark, s.maxMark, mock.grading) : null;
    return {
      name: s.name,
      isCore: s.isCore,
      max: s.maxMark,
      mark: m && m.status === "entered" ? m.mark : null,
      absent: !!m && m.status === "absent",
      pct: m && m.status === "entered" && m.mark !== null ? Math.round((m.mark / s.maxMark) * 1000) / 10 : null,
      grade: band ? band.grade : null,
      remark: band ? band.remark : "",
      counted: counted.has(s.code),
    };
  });

  const profile = buildLearnerProfile(cand.studentId, history, DEFAULT_ANALYSIS_CONFIG);
  const missing = rows.filter((r) => r.mark === null && !r.absent).map((r) => r.name);

  let position: SlipData["position"] = null;
  if (opts.includePosition && result.status === "complete") {
    const sitting = candidates.filter((c) => c.status === "registered");
    const inputs = sitting.map((c) => {
      const r = computeCandidateResult(c, subjects, marks, mock.grading);
      return { candidateId: c.id, classId: c.classId, status: r.status, aggregate: r.aggregate };
    });
    const ranks = rankCandidates(inputs, mock.grading.lowerIsBetter);
    const mine = ranks.get(cand.id);
    const ranked = inputs.filter((i) => i.status === "complete");
    position = {
      school: mine?.schoolRank ?? null,
      ofSchool: ranked.length,
      class: mine?.classRank ?? null,
      ofClass: ranked.filter((i) => i.classId === cand.classId).length,
    };
  }

  const code = slipCode([
    mock.id,
    cand.id,
    result.aggregate,
    ...rows.map((r) => `${r.name}:${r.absent ? "A" : r.mark === null ? "-" : r.mark}`),
  ]);

  return {
    schoolName: school.name,
    schoolAddress: school.address ?? null,
    headTeacher: school.headTeacher ?? null,
    logoDataUrl: school.logoDataUrl ?? null,
    mockName: mock.name,
    academicYear: mock.academicYearLabel,
    generatedOn: opts.generatedOn,
    learner: { fullName: cand.fullName, className: cand.className, candidateNo: cand.candidateNo },
    bands: mock.grading.bands,
    lowerIsBetter: mock.grading.lowerIsBetter,
    rows,
    status: result.status,
    aggregate: result.aggregate,
    passAggregate: opts.passAggregate ?? DEFAULT_ANALYSIS_CONFIG.passAggregate,
    missing,
    history: (profile?.entries ?? []).map((e) => ({ mockName: e.mockName, aggregate: e.aggregate })),
    progressWord: profile && profile.entries.length > 1 && profile.label !== "not_enough_data" ? profile.headline : null,
    progressSentence: profile && profile.entries.length > 1 ? profile.sentence : null,
    strongest: profile?.strongest ? `${profile.strongest.name} (${profile.strongest.pct}%)` : null,
    weakest: profile?.weakest ? `${profile.weakest.name} (${profile.weakest.pct}%)` : null,
    position,
    code,
  };
}
