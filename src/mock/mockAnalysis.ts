/**
 * Mock analysis in plain language - the WAC-BAS (district BECE analysis) rules, applied
 * to a school's own mock examinations. Pure functions, no database, no UI.
 *
 * Rules adopted from WAC-BAS (all configurable, these are the defaults):
 *   - A learner PASSES the mock when the six-subject aggregate is 30 or better (<= 30).
 *   - Aggregate bands: 06 | 07-09 | 10-19 | 20-30 | 31-36 | 37+
 *   - Grade points: Aggregate 06 = 4, 07-09 = 3, 10-19 = 2, 20-30 = 1, worse = 0
 *   - Rank score = grade points / average aggregate (used to compare schools)
 *   - A subject is "passed" with grade 1-5 (grade 6-9 = not passed)
 *   - A subject is flagged for support when its pass rate is under 60% or its mean grade is worse than 5.0
 *
 * Everything is labelled "Mock": a school-level estimate, not an official WAEC result.
 * Missing / absent / incomplete results are never counted as fails or zeros.
 */
import {
  assessComparability,
  classifyProgress,
  earlySupportFlags,
  gradeForMark,
  type CandidateResult,
  type GradingConfig,
  type MockMark,
  type MockSubject,
  type ProgressPoint,
  type ProgressSummary,
} from "./mockEngine";

/* ------------------------------ configuration ----------------------------- */

export interface AnalysisConfig {
  /** Aggregate at or below this is a pass (lower-is-better scales). */
  passAggregate: number;
  /** A single subject grade at or better than this counts as passed. */
  subjectPassGrade: number;
  /** A subject is flagged when its pass rate is below this percentage... */
  interventionPassPct: number;
  /** ...or its mean grade is worse (higher) than this. */
  interventionMeanGrade: number;
}

export const DEFAULT_ANALYSIS_CONFIG: AnalysisConfig = {
  passAggregate: 30,
  subjectPassGrade: 5,
  interventionPassPct: 60,
  interventionMeanGrade: 5.0,
};

export type BandKey = "a06" | "a07_09" | "a10_19" | "a20_30" | "a31_36" | "a37plus";

export const AGGREGATE_BANDS: Array<{ key: BandKey; label: string; min: number; max: number; weight: number }> = [
  { key: "a06", label: "Aggregate 06", min: 6, max: 6, weight: 4 },
  { key: "a07_09", label: "Aggregate 07-09", min: 7, max: 9, weight: 3 },
  { key: "a10_19", label: "Aggregate 10-19", min: 10, max: 19, weight: 2 },
  { key: "a20_30", label: "Aggregate 20-30", min: 20, max: 30, weight: 1 },
  { key: "a31_36", label: "Aggregate 31-36", min: 31, max: 36, weight: 0 },
  { key: "a37plus", label: "Aggregate 37+", min: 37, max: 999, weight: 0 },
];

export function bandForAggregate(aggregate: number): BandKey {
  if (aggregate <= 6) return "a06";
  const b = AGGREGATE_BANDS.find((x) => aggregate >= x.min && aggregate <= x.max);
  return b ? b.key : "a37plus";
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const pct = (num: number, den: number): number | null => (den > 0 ? round2((num / den) * 100) : null);

/* --------------------------------- tone ---------------------------------- */

export type Tone = "good" | "ok" | "bad" | "na";

export interface Verdict {
  tone: Tone;
  /** One or two plain words. */
  word: string;
  /** One plain sentence. */
  sentence: string;
}

/* --------------------------- school-level summary -------------------------- */

export interface SummaryCandidate {
  id: string;
  status: "registered" | "excluded" | "absent_all";
  gender?: string | null;
}

export interface SummaryResult {
  candidateId: string;
  status: CandidateResult["status"];
  aggregate: number | null;
}

export interface GenderSummary {
  assessed: number;
  pass: number;
  passPct: number | null;
  avgAggregate: number | null;
}

export interface SchoolSummary {
  /** Candidates registered for the mock (excluded candidates are never counted). */
  registered: number;
  /** Registered and not absent from the whole examination. */
  present: number;
  absent: number;
  /** Present learners whose six-subject aggregate is complete: the base for every rate below. */
  assessed: number;
  /** Present learners still waiting for one or more marks. */
  incomplete: number;
  pass: number;
  notPassed: number;
  passPct: number | null;
  bandCounts: Record<BandKey, number>;
  pct06: number | null;
  pct07to30: number | null;
  avgAggregate: number | null;
  bestAggregate: number | null;
  worstAggregate: number | null;
  gradePoints: number;
  rankScore: number | null;
  male: GenderSummary;
  female: GenderSummary;
  /** True when too few learners have a complete result to draw conclusions. */
  thin: boolean;
}

const emptyBands = (): Record<BandKey, number> => ({ a06: 0, a07_09: 0, a10_19: 0, a20_30: 0, a31_36: 0, a37plus: 0 });

function genderSummary(rows: Array<{ aggregate: number }>, cfg: AnalysisConfig): GenderSummary {
  const pass = rows.filter((r) => r.aggregate <= cfg.passAggregate).length;
  return {
    assessed: rows.length,
    pass,
    passPct: pct(pass, rows.length),
    avgAggregate: rows.length ? round2(rows.reduce((s, r) => s + r.aggregate, 0) / rows.length) : null,
  };
}

export function summariseSchool(candidates: SummaryCandidate[], results: SummaryResult[], cfg: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG): SchoolSummary {
  const registeredList = candidates.filter((c) => c.status !== "excluded");
  const present = registeredList.filter((c) => c.status === "registered");
  const byId = new Map(results.map((r) => [r.candidateId, r] as const));

  const complete: Array<{ aggregate: number; gender: string }> = [];
  let incomplete = 0;
  for (const c of present) {
    const r = byId.get(c.id);
    if (r && r.status === "complete" && r.aggregate !== null) complete.push({ aggregate: r.aggregate, gender: (c.gender ?? "").toUpperCase() });
    else incomplete += 1;
  }

  const bandCounts = emptyBands();
  complete.forEach((r) => (bandCounts[bandForAggregate(r.aggregate)] += 1));
  const pass = complete.filter((r) => r.aggregate <= cfg.passAggregate).length;
  const gradePoints = AGGREGATE_BANDS.reduce((s, b) => s + bandCounts[b.key] * b.weight, 0);
  const avg = complete.length ? round2(complete.reduce((s, r) => s + r.aggregate, 0) / complete.length) : null;
  const sevenToThirty = bandCounts.a07_09 + bandCounts.a10_19 + bandCounts.a20_30;

  return {
    registered: registeredList.length,
    present: present.length,
    absent: registeredList.length - present.length,
    assessed: complete.length,
    incomplete,
    pass,
    notPassed: complete.length - pass,
    passPct: pct(pass, complete.length),
    bandCounts,
    pct06: pct(bandCounts.a06, complete.length),
    pct07to30: pct(sevenToThirty, complete.length),
    avgAggregate: avg,
    bestAggregate: complete.length ? Math.min(...complete.map((r) => r.aggregate)) : null,
    worstAggregate: complete.length ? Math.max(...complete.map((r) => r.aggregate)) : null,
    gradePoints,
    rankScore: avg && avg > 0 ? Math.round((gradePoints / avg) * 1e7) / 1e7 : null,
    male: genderSummary(complete.filter((r) => r.gender === "M"), cfg),
    female: genderSummary(complete.filter((r) => r.gender === "F"), cfg),
    thin: complete.length < 5,
  };
}

/* ------------------------------ plain verdicts ----------------------------- */

export function passRateVerdict(passPct: number | null, assessed: number): Verdict {
  if (passPct === null || assessed === 0) return { tone: "na", word: "Not enough data", sentence: "No learner has a complete result yet." };
  if (passPct >= 80) return { tone: "good", word: "Strong", sentence: `${passPct}% of learners passed (aggregate 30 or better).` };
  if (passPct >= 60) return { tone: "ok", word: "Fair", sentence: `${passPct}% of learners passed. Some learners need extra support.` };
  return { tone: "bad", word: "Needs attention", sentence: `Only ${passPct}% of learners passed. Many learners need support.` };
}

export function averageAggregateVerdict(avg: number | null): Verdict {
  if (avg === null) return { tone: "na", word: "Not enough data", sentence: "No complete aggregate yet." };
  if (avg <= 19) return { tone: "good", word: "Good", sentence: `The average aggregate is ${avg} (lower is better).` };
  if (avg <= 30) return { tone: "ok", word: "Fair", sentence: `The average aggregate is ${avg}: within the pass range but with room to improve.` };
  return { tone: "bad", word: "Weak", sentence: `The average aggregate is ${avg}: outside the pass range.` };
}

export function completenessVerdict(assessed: number, present: number): Verdict {
  if (present === 0) return { tone: "na", word: "No learners", sentence: "No learners are sitting this mock." };
  const p = Math.round((assessed / present) * 100);
  if (p >= 95) return { tone: "good", word: "Complete", sentence: `${assessed} of ${present} learners have a full result.` };
  if (p >= 70) return { tone: "ok", word: "Mostly complete", sentence: `${assessed} of ${present} learners have a full result. Results may change when the rest are entered.` };
  return { tone: "bad", word: "Incomplete", sentence: `Only ${assessed} of ${present} learners have a full result. Treat these figures with caution.` };
}

/* ------------------------------ subject analysis --------------------------- */

export interface SubjectAnalysis {
  subjectId: string;
  code: string;
  name: string;
  isCore: boolean;
  valid: number;
  meanGrade: number | null;
  medianGrade: number | null;
  modeGrade: number | null;
  meanPct: number | null;
  passed: number;
  passPct: number | null;
  gradeCounts: Record<number, number>;
  maleMeanGrade: number | null;
  femaleMeanGrade: number | null;
  malePassPct: number | null;
  femalePassPct: number | null;
  flagged: boolean;
  flagReasons: string[];
  verdict: Verdict;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return round2(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}
function mode(xs: number[]): number | null {
  if (!xs.length) return null;
  const f = new Map<number, number>();
  xs.forEach((x) => f.set(x, (f.get(x) ?? 0) + 1));
  let best: number | null = null;
  let bestN = -1;
  [...f.keys()].sort((a, b) => a - b).forEach((k) => {
    if ((f.get(k) ?? 0) > bestN) {
      best = k;
      bestN = f.get(k) ?? 0;
    }
  });
  return best;
}
const mean = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

export function analyseSubjects(
  subjects: MockSubject[],
  candidates: SummaryCandidate[],
  marks: MockMark[],
  grading: GradingConfig,
  cfg: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG
): SubjectAnalysis[] {
  const sitting = new Map(candidates.filter((c) => c.status === "registered").map((c) => [c.id, c] as const));
  const lowerBetter = grading.lowerIsBetter;
  const passes = (g: number) => (lowerBetter ? g <= cfg.subjectPassGrade : g >= cfg.subjectPassGrade);
  const worseThan = (m: number) => (lowerBetter ? m > cfg.interventionMeanGrade : m < cfg.interventionMeanGrade);

  return subjects.map((s) => {
    const rows: Array<{ grade: number; pctMark: number; gender: string }> = [];
    for (const m of marks) {
      if (m.subjectId !== s.id || m.status !== "entered") continue;
      const cand = sitting.get(m.candidateId);
      if (!cand) continue;
      const band = gradeForMark(m.mark, s.maxMark, grading);
      if (!band || m.mark === null) continue;
      rows.push({ grade: band.grade, pctMark: (m.mark / s.maxMark) * 100, gender: (cand.gender ?? "").toUpperCase() });
    }
    const grades = rows.map((r) => r.grade);
    const passed = grades.filter(passes).length;
    const passPct = pct(passed, grades.length);
    const meanGrade = mean(grades);
    const counts: Record<number, number> = {};
    grades.forEach((g) => (counts[g] = (counts[g] ?? 0) + 1));

    const gen = (g: string) => rows.filter((r) => r.gender === g);
    const gm = (g: string) => mean(gen(g).map((r) => r.grade));
    const gp = (g: string) => pct(gen(g).filter((r) => passes(r.grade)).length, gen(g).length);

    const reasons: string[] = [];
    if (grades.length >= 5) {
      if (passPct !== null && passPct < cfg.interventionPassPct) reasons.push(`Pass rate is ${passPct}%, below the ${cfg.interventionPassPct}% level.`);
      if (meanGrade !== null && worseThan(meanGrade)) reasons.push(`Average grade is ${meanGrade}, weaker than ${cfg.interventionMeanGrade}.`);
    }

    let verdict: Verdict;
    if (grades.length < 5) verdict = { tone: "na", word: "Not enough data", sentence: `Only ${grades.length} valid mark${grades.length === 1 ? "" : "s"} so far.` };
    else if (reasons.length) verdict = { tone: "bad", word: "Needs support", sentence: reasons.join(" ") };
    else if (passPct !== null && passPct >= 80) verdict = { tone: "good", word: "Strong", sentence: `${passPct}% passed; average grade ${meanGrade}.` };
    else verdict = { tone: "ok", word: "Fair", sentence: `${passPct}% passed; average grade ${meanGrade}.` };

    return {
      subjectId: s.id,
      code: s.code,
      name: s.name,
      isCore: s.isCore,
      valid: grades.length,
      meanGrade,
      medianGrade: median(grades),
      modeGrade: mode(grades),
      meanPct: rows.length ? round2(rows.reduce((a, r) => a + r.pctMark, 0) / rows.length) : null,
      passed,
      passPct,
      gradeCounts: counts,
      maleMeanGrade: gm("M"),
      femaleMeanGrade: gm("F"),
      malePassPct: gp("M"),
      femalePassPct: gp("F"),
      flagged: reasons.length > 0,
      flagReasons: reasons,
      verdict,
    };
  });
}

/** Subjects ordered strongest first (higher pass rate, then better mean grade). Subjects without data go last. */
export function rankSubjects(list: SubjectAnalysis[], lowerIsBetter = true): SubjectAnalysis[] {
  const thin = (x: SubjectAnalysis) => x.passPct === null || x.valid < 5;
  return [...list].sort((a, b) => {
    if (thin(a) && thin(b)) return 0;
    if (thin(a)) return 1;
    if (thin(b)) return -1;
    if (a.passPct === null || b.passPct === null) return 0;
    if (b.passPct !== a.passPct) return b.passPct - a.passPct;
    const ma = a.meanGrade ?? 99;
    const mb = b.meanGrade ?? 99;
    return lowerIsBetter ? ma - mb : mb - ma;
  });
}

/* ------------------------------ school insights ---------------------------- */

export interface Insight {
  tone: Tone;
  text: string;
}

export function schoolInsights(summary: SchoolSummary, subjects: SubjectAnalysis[], lowerIsBetter = true): Insight[] {
  const out: Insight[] = [];
  const pv = passRateVerdict(summary.passPct, summary.assessed);
  out.push({ tone: pv.tone, text: pv.sentence });
  if (summary.incomplete > 0) {
    out.push({ tone: "ok", text: `${summary.incomplete} learner(s) are still waiting for one or more marks, so they are not counted in these rates yet.` });
  }
  if (summary.thin && summary.assessed > 0) out.push({ tone: "ok", text: "Fewer than 5 learners have a full result, so these figures are not a reliable picture yet." });
  if (summary.pct06 !== null && summary.bandCounts.a06 > 0) out.push({ tone: "good", text: `${summary.bandCounts.a06} learner(s) scored the best possible aggregate (06).` });
  if (summary.assessed > 0 && summary.bandCounts.a37plus > 0) out.push({ tone: "bad", text: `${summary.bandCounts.a37plus} learner(s) are in the weakest band (37+) and need urgent support.` });

  const ranked = rankSubjects(subjects.filter((s) => s.valid >= 5), lowerIsBetter);
  if (ranked.length >= 2) {
    out.push({ tone: "good", text: `Strongest subject: ${ranked[0].name} (${ranked[0].passPct}% passed).` });
    const last = ranked[ranked.length - 1];
    out.push({ tone: last.flagged ? "bad" : "ok", text: `Weakest subject: ${last.name} (${last.passPct}% passed).` });
  }
  const flagged = subjects.filter((s) => s.flagged).map((s) => s.name);
  if (flagged.length) out.push({ tone: "bad", text: `Subjects needing support: ${flagged.join(", ")}.` });

  if (summary.male.assessed >= 3 && summary.female.assessed >= 3 && summary.male.passPct !== null && summary.female.passPct !== null) {
    const d = round2(Math.abs(summary.male.passPct - summary.female.passPct));
    if (d === 0) out.push({ tone: "ok", text: "Boys and girls passed at the same rate." });
    else out.push({ tone: "ok", text: `${summary.male.passPct > summary.female.passPct ? "Boys" : "Girls"} passed at a higher rate, by ${d} percentage points.` });
  }
  return out;
}

/* ------------------------------ mock-to-mock ------------------------------- */

export type Direction = "improved" | "declined" | "same" | "na";

export interface ComparisonRow {
  key: string;
  label: string;
  before: number | null;
  after: number | null;
  unit: "%" | "pts" | "";
  delta: number | null;
  direction: Direction;
  sentence: string;
}

function dir(before: number | null, after: number | null, higherIsBetter: boolean): { delta: number | null; direction: Direction } {
  if (before === null || after === null) return { delta: null, direction: "na" };
  const delta = round2(after - before);
  if (delta === 0) return { delta, direction: "same" };
  const better = higherIsBetter ? delta > 0 : delta < 0;
  return { delta, direction: better ? "improved" : "declined" };
}

function row(key: string, label: string, before: number | null, after: number | null, unit: ComparisonRow["unit"], higherIsBetter: boolean, noun: string): ComparisonRow {
  const { delta, direction } = dir(before, after, higherIsBetter);
  let sentence: string;
  if (direction === "na") sentence = `${label}: not enough data to compare.`;
  else if (direction === "same") sentence = `${label} stayed at ${after}${unit === "%" ? "%" : ""}.`;
  else {
    const amount = Math.abs(delta as number);
    const u = unit === "%" ? " percentage points" : unit === "pts" ? (amount === 1 ? " point" : " points") : "";
    sentence = `${label} ${direction === "improved" ? "improved" : "got worse"}: ${noun} ${(delta as number) > 0 ? "rose" : "fell"} from ${before}${unit === "%" ? "%" : ""} to ${after}${unit === "%" ? "%" : ""} (${amount}${u}).`;
  }
  return { key, label, before, after, unit, delta, direction, sentence };
}

export function compareSummaries(prev: SchoolSummary, curr: SchoolSummary): ComparisonRow[] {
  return [
    row("pass", "Pass rate", prev.passPct, curr.passPct, "%", true, "the pass rate"),
    row("avg", "Average aggregate", prev.avgAggregate, curr.avgAggregate, "pts", false, "the average aggregate"),
    row("best", "Best aggregate", prev.bestAggregate, curr.bestAggregate, "pts", false, "the best aggregate"),
    row("p06", "Learners in Aggregate 06", prev.pct06, curr.pct06, "%", true, "the share"),
    row("p07", "Learners in Aggregate 07-30", prev.pct07to30, curr.pct07to30, "%", true, "the share"),
    row("gp", "Grade points", prev.gradePoints, curr.gradePoints, "", true, "grade points"),
  ];
}

export interface SubjectComparisonRow {
  code: string;
  name: string;
  beforePassPct: number | null;
  afterPassPct: number | null;
  beforeMeanGrade: number | null;
  afterMeanGrade: number | null;
  direction: Direction;
  sentence: string;
}

export function compareSubjects(prev: SubjectAnalysis[], curr: SubjectAnalysis[], lowerIsBetter = true): SubjectComparisonRow[] {
  const before = new Map(prev.map((s) => [s.code, s] as const));
  return curr
    .filter((c) => before.has(c.code))
    .map((c) => {
      const b = before.get(c.code)!;
      const { direction } = dir(b.meanGrade, c.meanGrade, !lowerIsBetter);
      const sentence =
        direction === "na"
          ? `${c.name}: not enough data to compare.`
          : direction === "same"
            ? `${c.name}: average grade unchanged at ${c.meanGrade}.`
            : `${c.name}: ${direction === "improved" ? "better" : "weaker"}, average grade ${b.meanGrade} → ${c.meanGrade}${
                b.passPct !== null && c.passPct !== null ? `, pass rate ${b.passPct}% → ${c.passPct}%` : ""
              }.`;
      return { code: c.code, name: c.name, beforePassPct: b.passPct, afterPassPct: c.passPct, beforeMeanGrade: b.meanGrade, afterMeanGrade: c.meanGrade, direction, sentence };
    });
}

/* ------------------------------- learner view ------------------------------ */

export interface MockSnapshot {
  mockId: string;
  mockName: string;
  /** ISO date used for ordering (start date, or creation date). */
  date: string;
  status: "draft" | "open" | "entry_closed" | "finalised";
  grading: GradingConfig;
  subjects: MockSubject[];
  candidates: Array<{ id: string; studentId: string; status: "registered" | "excluded" | "absent_all"; fullName: string }>;
  marks: MockMark[];
  results: CandidateResult[];
  targetAggregate: number | null;
}

export interface LearnerMockEntry {
  mockId: string;
  mockName: string;
  date: string;
  status: CandidateResult["status"];
  aggregate: number | null;
  subjectGrades: Array<{ code: string; name: string; grade: number; pct: number }>;
  missing: string[];
}

export type LearnerLabel = "improving" | "steady" | "declining" | "first_mock" | "not_enough_data";

export interface LearnerProfile {
  studentId: string;
  fullName: string;
  entries: LearnerMockEntry[];
  summary: ProgressSummary;
  label: LearnerLabel;
  tone: Tone;
  headline: string;
  sentence: string;
  strongest: { name: string; pct: number } | null;
  weakest: { name: string; pct: number } | null;
  passing: boolean | null;
  supportFlags: string[];
}

const LABEL_TEXT: Record<LearnerLabel, { word: string; tone: Tone }> = {
  improving: { word: "Improving", tone: "good" },
  steady: { word: "Holding steady", tone: "ok" },
  declining: { word: "Slipping", tone: "bad" },
  first_mock: { word: "First mock", tone: "na" },
  not_enough_data: { word: "Not enough data", tone: "na" },
};

export function buildLearnerProfile(studentId: string, snapshots: MockSnapshot[], cfg: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG): LearnerProfile | null {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const entries: LearnerMockEntry[] = [];
  const points: ProgressPoint[] = [];
  let fullName = "";
  let prevSnap: MockSnapshot | null = null;

  for (const snap of ordered) {
    const cand = snap.candidates.find((c) => c.studentId === studentId && c.status !== "excluded");
    if (!cand) continue;
    fullName = cand.fullName;
    const res = snap.results.find((r) => r.candidateId === cand.id);
    const status = res?.status ?? "incomplete";
    const subjectGrades: LearnerMockEntry["subjectGrades"] = [];
    const subjectPct: Record<string, number | null> = {};
    const missing: string[] = [];
    for (const s of snap.subjects) {
      const m = snap.marks.find((x) => x.candidateId === cand.id && x.subjectId === s.id);
      if (m && m.status === "entered" && m.mark !== null) {
        const g = gradeForMark(m.mark, s.maxMark, snap.grading);
        const p = Math.round((m.mark / s.maxMark) * 1000) / 10;
        subjectPct[s.code] = p;
        if (g) subjectGrades.push({ code: s.code, name: s.name, grade: g.grade, pct: p });
      } else {
        subjectPct[s.code] = null;
        if (!m) missing.push(s.name);
      }
    }
    let comparable = true;
    if (prevSnap) {
      const cmpReport = assessComparability(
        { id: prevSnap.mockId, name: prevSnap.mockName, subjects: prevSnap.subjects, grading: prevSnap.grading, studentIds: prevSnap.candidates.map((c) => c.studentId), pctComplete: null },
        { id: snap.mockId, name: snap.mockName, subjects: snap.subjects, grading: snap.grading, studentIds: snap.candidates.map((c) => c.studentId), pctComplete: null },
        1
      );
      comparable = cmpReport.aggregateComparable && cmpReport.gradesComparable;
    }
    entries.push({ mockId: snap.mockId, mockName: snap.mockName, date: snap.date, status, aggregate: res?.aggregate ?? null, subjectGrades, missing });
    points.push({ mockId: snap.mockId, mockName: snap.mockName, date: snap.date, status, aggregate: res?.aggregate ?? null, subjectPct, comparableToPrevious: comparable, outstanding: missing.length > 0 });
    prevSnap = snap;
  }
  if (entries.length === 0) return null;

  const latestSnap = [...ordered].reverse().find((s) => s.candidates.some((c) => c.studentId === studentId));
  const lowerIsBetter = latestSnap?.grading.lowerIsBetter ?? true;
  const summary = classifyProgress(points, { lowerIsBetter, aggregateChangeThreshold: 3, subjectPctThreshold: 5, targetAggregate: latestSnap?.targetAggregate ?? null, minComparable: 2 });

  const completeEntries = entries.filter((e) => e.status === "complete" && e.aggregate !== null);
  const latest = entries[entries.length - 1];
  const latestComplete = completeEntries[completeEntries.length - 1] ?? null;
  const prevComplete = completeEntries.length >= 2 ? completeEntries[completeEntries.length - 2] : null;

  let label: LearnerLabel;
  if (summary.trend === "improving") label = "improving";
  else if (summary.trend === "declining") label = "declining";
  else if (summary.trend === "maintaining") label = "steady";
  else label = entries.length === 1 ? "first_mock" : "not_enough_data";

  const subjectsNow = [...latest.subjectGrades].sort((a, b) => b.pct - a.pct);
  const strongest = subjectsNow.length >= 2 ? { name: subjectsNow[0].name, pct: subjectsNow[0].pct } : null;
  const weakest = subjectsNow.length >= 2 ? { name: subjectsNow[subjectsNow.length - 1].name, pct: subjectsNow[subjectsNow.length - 1].pct } : null;

  const parts: string[] = [];
  if (latestComplete && prevComplete && label !== "not_enough_data") {
    const d = (prevComplete.aggregate as number) - (latestComplete.aggregate as number);
    if (d > 0) parts.push(`Aggregate improved from ${prevComplete.aggregate} to ${latestComplete.aggregate} (${d} point${d === 1 ? "" : "s"} better).`);
    else if (d < 0) parts.push(`Aggregate got worse, from ${prevComplete.aggregate} to ${latestComplete.aggregate} (${-d} point${d === -1 ? "" : "s"} weaker).`);
    else parts.push(`Aggregate stayed at ${latestComplete.aggregate}.`);
  } else if (latestComplete) {
    parts.push(`Aggregate is ${latestComplete.aggregate}.`);
  } else {
    parts.push("No complete aggregate yet" + (latest.missing.length ? ` (still waiting for: ${latest.missing.join(", ")}).` : "."));
  }
  if (latest.status !== "complete" && latest.missing.length && latestComplete) parts.push(`The latest mock (${latest.mockName}) is still waiting for: ${latest.missing.join(", ")}.`);
  if (strongest && weakest) parts.push(`Strongest: ${strongest.name} (${strongest.pct}%). Needs most help: ${weakest.name} (${weakest.pct}%).`);

  const flags = earlySupportFlags(
    points,
    { lowerIsBetter, targetAggregate: latestSnap?.targetAggregate ?? null, defaultSubjectTargetPct: 40, subjectTargetPct: {}, multipleSubjectsThreshold: 3 },
    summary
  ).map((f) => f.message);

  return {
    studentId,
    fullName,
    entries,
    summary,
    label,
    tone: LABEL_TEXT[label].tone,
    headline: LABEL_TEXT[label].word,
    sentence: parts.join(" "),
    strongest,
    weakest,
    passing: latestComplete ? (latestComplete.aggregate as number) <= cfg.passAggregate : null,
    supportFlags: flags,
  };
}

/* --------------------------- messages to parents --------------------------- */

const ABBREV: Array<[RegExp, string]> = [
  [/english/i, "Eng"],
  [/math/i, "Math"],
  [/social/i, "SocSt"],
  [/science/i, "Sci"],
  [/career/i, "CareerTech"],
  [/creative/i, "Arts"],
  [/comput/i, "ICT"],
  [/religious|rme/i, "RME"],
  [/twi/i, "Twi"],
  [/french/i, "French"],
];
export function shortSubject(name: string): string {
  for (const [re, ab] of ABBREV) if (re.test(name)) return ab;
  return name.length > 8 ? name.slice(0, 8) : name;
}

export interface ParentMessageInput {
  schoolName: string;
  mockName: string;
  studentName: string;
  entry: LearnerMockEntry;
  profile?: LearnerProfile | null;
  passAggregate?: number;
}

/**
 * One short, plain message per learner. Contains the learner's own result only (never a rank or
 * other learners' data). The language is deliberately simple and says "mock" so nobody mistakes it
 * for an official WAEC result.
 */
export function composeParentMessage(i: ParentMessageInput, maxLen = 450): string {
  const pass = i.passAggregate ?? DEFAULT_ANALYSIS_CONFIG.passAggregate;
  const first = i.studentName.split(/\s+/)[0] || i.studentName;
  const grades = i.entry.subjectGrades.map((g) => `${shortSubject(g.name)} ${g.grade}`).join(", ");
  const lines: string[] = [];

  if (i.entry.status === "complete" && i.entry.aggregate !== null) {
    lines.push(`${i.schoolName}: ${first}'s ${i.mockName} result. Mock aggregate ${i.entry.aggregate} (${i.entry.aggregate <= pass ? "PASS level" : "below pass level"}).`);
    if (grades) lines.push(`Grades: ${grades}.`);
    const p = i.profile;
    if (p && p.entries.length > 1 && p.label !== "not_enough_data") {
      if (p.label === "improving") lines.push("Progress: improving since the last mock. Well done!");
      else if (p.label === "declining") lines.push("Progress: lower than the last mock. Please help with extra revision.");
      else lines.push("Progress: about the same as the last mock.");
    }
    if (p?.weakest && p.strongest && p.weakest.name !== p.strongest.name) lines.push(`Best: ${shortSubject(p.strongest.name)}. Needs help: ${shortSubject(p.weakest.name)}.`);
    lines.push("(School mock exam, not an official WAEC result.)");
  } else {
    lines.push(`${i.schoolName}: ${first}'s ${i.mockName} result is not complete yet${i.entry.missing.length ? ` (waiting for ${i.entry.missing.map(shortSubject).join(", ")})` : ""}.`);
    if (grades) lines.push(`Grades so far: ${grades}.`);
    lines.push("We will send the full result when ready.");
  }
  let text = lines.join(" ");
  if (text.length > maxLen) text = text.slice(0, maxLen - 1).trimEnd() + "…";
  return text;
}

/* ------------------------------- district view ------------------------------ */

export interface DistrictInput {
  mockId: string;
  schoolId: string;
  schoolName: string;
  circuit: string | null;
  mockName: string;
  seriesKey: string | null;
  startDate: string | null;
  status: string;
  lowerIsBetter: boolean;
  registered: number;
  present: number;
  assessed: number;
  pass: number;
  a06: number;
  a07_09: number;
  a10_19: number;
  a20_30: number;
  a31_36: number;
  a37plus: number;
  sumAggregate: number;
  bestAggregate: number | null;
  subjects: Array<{ code: string; name: string; isCore: boolean; valid: number; passed: number; gradeSum: number }>;
}

export interface DistrictMetrics {
  mockId: string;
  mockName: string;
  assessed: number;
  present: number;
  passPct: number | null;
  avgAggregate: number | null;
  gradePoints: number;
  rankScore: number | null;
  completenessPct: number | null;
}

export type SupportClass = "priority" | "monitor" | "positive" | "insufficient";

export interface DistrictSchoolView {
  schoolId: string;
  schoolName: string;
  circuit: string | null;
  latest: DistrictMetrics;
  previous: DistrictMetrics | null;
  passChange: number | null;
  avgChange: number | null;
  rank: number | null;
  support: SupportClass;
  supportWord: string;
  tone: Tone;
  /** Every reason that contributed, so the classification is never an unexplained score. */
  factors: string[];
  /** Things that limit how far the figures can be trusted. */
  limitations: string[];
  flaggedSubjects: Array<{ name: string; passPct: number; meanGrade: number }>;
}

function districtMetrics(r: DistrictInput): DistrictMetrics {
  const gp = r.a06 * 4 + r.a07_09 * 3 + r.a10_19 * 2 + r.a20_30 * 1;
  const avg = r.assessed ? round2(r.sumAggregate / r.assessed) : null;
  return {
    mockId: r.mockId,
    mockName: r.mockName,
    assessed: r.assessed,
    present: r.present,
    passPct: pct(r.pass, r.assessed),
    avgAggregate: avg,
    gradePoints: gp,
    rankScore: avg && avg > 0 ? Math.round((gp / avg) * 1e7) / 1e7 : null,
    completenessPct: pct(r.assessed, r.present),
  };
}

export function buildDistrictView(rows: DistrictInput[], cfg: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG): DistrictSchoolView[] {
  const bySchool = new Map<string, DistrictInput[]>();
  rows.filter((r) => r.lowerIsBetter).forEach((r) => bySchool.set(r.schoolId, [...(bySchool.get(r.schoolId) ?? []), r]));

  const views: DistrictSchoolView[] = [];
  for (const list of bySchool.values()) {
    const sorted = [...list].sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"));
    const lastRow = sorted[sorted.length - 1];
    const prevRow = sorted.length > 1 ? sorted[sorted.length - 2] : null;
    const latest = districtMetrics(lastRow);
    const previous = prevRow ? districtMetrics(prevRow) : null;
    const comparable = !!previous && previous.assessed >= 5 && latest.assessed >= 5;
    const passChange = comparable && previous!.passPct !== null && latest.passPct !== null ? round2(latest.passPct - previous!.passPct) : null;
    const avgChange = comparable && previous!.avgAggregate !== null && latest.avgAggregate !== null ? round2(previous!.avgAggregate - latest.avgAggregate) : null;

    const factors: string[] = [];
    const limitations: string[] = [];
    if (latest.assessed < 5) limitations.push(`Only ${latest.assessed} learner(s) have a full result, too few to judge.`);
    if (latest.completenessPct !== null && latest.completenessPct < 70) limitations.push(`Only ${latest.completenessPct}% of learners who sat have a full result; figures may change.`);
    if (lastRow.status !== "finalised") limitations.push("The latest mock is not finalised yet.");
    if (prevRow && !comparable) limitations.push("No fair comparison with the earlier mock (too few full results).");
    if (prevRow) limitations.push("Mock papers may differ in difficulty between mocks; a change is a prompt for discussion, not proof of cause.");

    const flagged = lastRow.subjects
      .filter((s) => s.valid >= 5)
      .map((s) => ({ name: s.name, passPct: pct(s.passed, s.valid) as number, meanGrade: round2(s.gradeSum / s.valid) }))
      .filter((s) => s.passPct < cfg.interventionPassPct || s.meanGrade > cfg.interventionMeanGrade);

    let support: SupportClass;
    if (latest.assessed < 5 || (latest.completenessPct !== null && latest.completenessPct < 70)) {
      support = "insufficient";
      factors.push("Not enough complete results to classify this school reliably.");
    } else {
      const lowPass = latest.passPct !== null && latest.passPct < cfg.interventionPassPct;
      const weakAvg = latest.avgAggregate !== null && latest.avgAggregate > cfg.passAggregate;
      const falling = (passChange !== null && passChange <= -5) || (avgChange !== null && avgChange <= -3);
      const rising = (passChange !== null && passChange >= 5) || (avgChange !== null && avgChange >= 3);
      if (lowPass) factors.push(`Pass rate is ${latest.passPct}%, below ${cfg.interventionPassPct}%.`);
      if (weakAvg) factors.push(`Average aggregate is ${latest.avgAggregate}, outside the pass range.`);
      if (falling) factors.push("Results fell compared with the earlier mock.");
      if (flagged.length >= 3) factors.push(`${flagged.length} subjects need support.`);
      if (rising) factors.push("Results improved compared with the earlier mock.");
      if (lowPass || weakAvg) support = "priority";
      else if (falling || flagged.length >= 3 || (latest.passPct !== null && latest.passPct < 80)) {
        support = "monitor";
        if (latest.passPct !== null && latest.passPct < 80 && !falling && flagged.length < 3) factors.push(`Pass rate is ${latest.passPct}%: acceptable but below 80%.`);
      } else {
        support = "positive";
        if (latest.passPct !== null) factors.push(`Pass rate is ${latest.passPct}%.`);
      }
    }
    const words: Record<SupportClass, { word: string; tone: Tone }> = {
      priority: { word: "Priority support recommended", tone: "bad" },
      monitor: { word: "Monitoring recommended", tone: "ok" },
      positive: { word: "Progressing positively", tone: "good" },
      insufficient: { word: "Insufficient data", tone: "na" },
    };
    views.push({
      schoolId: lastRow.schoolId,
      schoolName: lastRow.schoolName,
      circuit: lastRow.circuit,
      latest,
      previous,
      passChange,
      avgChange,
      rank: null,
      support,
      supportWord: words[support].word,
      tone: words[support].tone,
      factors,
      limitations,
      flaggedSubjects: flagged,
    });
  }

  // Rank by rank score (grade points / average aggregate), ties share a position; only schools with enough results.
  const rankable = views.filter((v) => v.latest.rankScore !== null && v.latest.assessed >= 5).sort((a, b) => (b.latest.rankScore as number) - (a.latest.rankScore as number));
  let rank = 0;
  let prev: number | null = null;
  rankable.forEach((v, i) => {
    if (prev === null || v.latest.rankScore !== prev) rank = i + 1;
    prev = v.latest.rankScore;
    v.rank = rank;
  });
  return views.sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.schoolName.localeCompare(b.schoolName));
}

export interface DistrictSubjectRollup {
  code: string;
  name: string;
  schools: number;
  valid: number;
  passPct: number | null;
  meanGrade: number | null;
  schoolsFlagged: number;
}

/** District-wide subject picture from each school's latest mock. Counts only; no learner data. */
export function districtSubjectRollup(rows: DistrictInput[], cfg: AnalysisConfig = DEFAULT_ANALYSIS_CONFIG): DistrictSubjectRollup[] {
  const latestBySchool = new Map<string, DistrictInput>();
  [...rows]
    .filter((r) => r.lowerIsBetter)
    .sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"))
    .forEach((r) => latestBySchool.set(r.schoolId, r));
  const acc = new Map<string, { name: string; schools: number; valid: number; passed: number; gradeSum: number; flagged: number }>();
  for (const r of latestBySchool.values()) {
    for (const s of r.subjects) {
      if (s.valid === 0) continue;
      const cur = acc.get(s.code) ?? { name: s.name, schools: 0, valid: 0, passed: 0, gradeSum: 0, flagged: 0 };
      cur.schools += 1;
      cur.valid += s.valid;
      cur.passed += s.passed;
      cur.gradeSum += s.gradeSum;
      const p = pct(s.passed, s.valid) as number;
      if (s.valid >= 5 && (p < cfg.interventionPassPct || s.gradeSum / s.valid > cfg.interventionMeanGrade)) cur.flagged += 1;
      acc.set(s.code, cur);
    }
  }
  return [...acc.entries()]
    .map(([code, v]) => ({ code, name: v.name, schools: v.schools, valid: v.valid, passPct: pct(v.passed, v.valid), meanGrade: v.valid ? round2(v.gradeSum / v.valid) : null, schoolsFlagged: v.flagged }))
    .sort((a, b) => (a.passPct ?? 999) - (b.passPct ?? 999));
}
