import { db } from "@database/db";
import { EnrollmentService } from "./EnrollmentService";
import { GradeBandService } from "./GradeBandService";
import {
  computeSubjectTotal,
  findGradeBand,
  resolveGradeBandsForLevel,
} from "./AssessmentCalculationEngine";
import { getAllClassSummaries } from "./AssessmentProgressService";
import type { PromotionStatus } from "@models/PromotionHistory";

/**
 * Module 4 (Phase 5) - Dashboard & Analytics, plus the aggregate figures
 * Module 1's "compare academic years" view needs. Everything here reads
 * directly from the raw score/enrollment tables (never through the
 * heavier per-student ReportSnapshot builder in ReportDataService,
 * which also resolves remarks/rankings/signatures that these aggregate
 * views don't need) so it stays fast at the 5,000+ student scale Phase 5
 * targets - each function does O(1) indexed table reads plus a single
 * in-memory pass, never a per-student query loop.
 */

export interface SchoolOverview {
  totalStudents: number;
  activeStudents: number;
  boys: number;
  girls: number;
  classes: number;
  teachersConfigured: number;
  assessmentsCompleted: number;
  assessmentsTotal: number;
}

export interface SubjectAverage {
  subjectId: number;
  name: string;
  average: number;
  studentCount: number;
}

export interface ClassAverage {
  classId: number;
  name: string;
  levelName: string;
  average: number;
  studentCount: number;
}

export interface GradeBandSlice {
  label: string;
  code: string;
  count: number;
  color: string;
}

const BAND_COLORS = [
  "#1F3864", "#2F6FB0", "#4C9F70", "#D9A441", "#C0504D", "#7A5DA0", "#5B8C85",
];

/** School Overview tile row (Module 4). `termId` selects which term's
 *  assessment-completion figures to show; student/class/gender counts
 *  are always "right now" totals, independent of term. */
export async function getSchoolOverview(termId?: number): Promise<SchoolOverview> {
  const [students, classes] = await Promise.all([db.students.toArray(), db.classes.toArray()]);
  const activeStudents = students.filter((s) => s.status === "ACTIVE");
  const boys = activeStudents.filter((s) => s.gender === "M").length;
  const girls = activeStudents.filter((s) => s.gender === "F").length;
  const activeClasses = classes.filter((c) => c.isActive);
  const teachersConfigured = new Set(
    activeClasses.map((c) => c.classTeacherName?.trim()).filter((n): n is string => !!n),
  ).size;

  let assessmentsCompleted = 0;
  let assessmentsTotal = 0;
  if (termId) {
    const summaries = await getAllClassSummaries(termId);
    assessmentsTotal = summaries.length;
    assessmentsCompleted = summaries.filter((s) => s.status === "FINALIZED").length;
  }

  return {
    totalStudents: students.length,
    activeStudents: activeStudents.length,
    boys,
    girls,
    classes: activeClasses.length,
    teachersConfigured,
    assessmentsCompleted,
    assessmentsTotal,
  };
}

/** Per-subject average Total (SBA+Exam) across every student who has a
 *  complete score for that subject in the given term. Subjects with no
 *  scored students yet are omitted rather than shown as a misleading 0. */
export async function getSubjectAverages(termId: number): Promise<SubjectAverage[]> {
  const [scores, subjects] = await Promise.all([
    db.scoreRecords.where("termId").equals(termId).toArray(),
    db.subjects.filter((s) => s.isActive).toArray(),
  ]);

  return subjects
    .map((subject) => {
      const totals = scores
        .filter((s) => s.subjectId === subject.id)
        .map((s) => computeSubjectTotal(s.sbaScore, s.examScore))
        .filter((t): t is number => t !== null);
      const average = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
      return { subjectId: subject.id!, name: subject.name, average: Math.round(average * 10) / 10, studentCount: totals.length };
    })
    .filter((row) => row.studentCount > 0)
    .sort((a, b) => b.average - a.average);
}

/** Per-class average across every subject/student in that class for the
 *  term (a single overall figure per class, for the class-comparison
 *  chart/table). */
export async function getClassAverages(termId: number): Promise<ClassAverage[]> {
  const [scores, classes, levels] = await Promise.all([
    db.scoreRecords.where("termId").equals(termId).toArray(),
    db.classes.filter((c) => c.isActive).toArray(),
    db.levels.toArray(),
  ]);

  // Performance (Module 8) - fetch every class's roster in parallel
  // rather than one sequential await per class, since this scales with
  // the number of active classes (a school with 20+ classes should not
  // pay 20 sequential round-trips here).
  const rosters = await Promise.all(classes.map((cls) => EnrollmentService.getRoster(termId, cls.id!)));

  const rows: ClassAverage[] = [];
  classes.forEach((cls, i) => {
    const roster = rosters[i];
    const studentIds = new Set(roster.map((r) => r.studentId));
    if (studentIds.size === 0) return;

    const totals = scores
      .filter((s) => studentIds.has(s.studentId))
      .map((s) => computeSubjectTotal(s.sbaScore, s.examScore))
      .filter((t): t is number => t !== null);

    if (totals.length === 0) return;
    const level = levels.find((l) => l.id === cls.levelId);
    const average = totals.reduce((a, b) => a + b, 0) / totals.length;
    rows.push({
      classId: cls.id!,
      name: cls.name,
      levelName: level?.name ?? "—",
      average: Math.round(average * 10) / 10,
      studentCount: studentIds.size,
    });
  });
  return rows.sort((a, b) => b.average - a.average);
}

/** Grade-band distribution across every scored subject entry in the
 *  term, using each level's own configured bands (never a hard-coded
 *  cutoff) - mirrors the exact lookup the report cards themselves use
 *  (AssessmentCalculationEngine.findGradeBand). */
export async function getGradeBandDistribution(termId: number): Promise<GradeBandSlice[]> {
  const [scores, allBands, enrollments] = await Promise.all([
    db.scoreRecords.where("termId").equals(termId).toArray(),
    GradeBandService.getAll(),
    db.enrollments.where("termId").equals(termId).toArray(),
  ]);
  const levelByStudent = new Map(enrollments.map((e) => [e.studentId, e.levelId]));

  const counts = new Map<string, { label: string; code: string; count: number }>();
  for (const rec of scores) {
    const total = computeSubjectTotal(rec.sbaScore, rec.examScore);
    if (total === null) continue;
    const levelId = levelByStudent.get(rec.studentId);
    const bands = resolveGradeBandsForLevel(allBands, levelId ?? -1);
    const band = findGradeBand(total, bands);
    if (!band) continue;
    const key = band.code;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { label: band.label, code: band.code, count: 1 });
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .map((row, i) => ({ ...row, color: BAND_COLORS[i % BAND_COLORS.length] }));
}

/** "Pass rate" (Module 4) is defined relative to the school's own grade
 *  bands, never a hard-coded numeric cutoff: a subject entry "passes" if
 *  its grade band is anything other than the lowest-scoring active band
 *  configured for that level (the same bands the report cards
 *  themselves use). This keeps the figure meaningful even if a school
 *  changes its band thresholds or labels. */
export async function getPassRate(termId: number): Promise<{ passCount: number; totalCount: number; pct: number }> {
  const [scores, allBands, enrollments] = await Promise.all([
    db.scoreRecords.where("termId").equals(termId).toArray(),
    GradeBandService.getAll(),
    db.enrollments.where("termId").equals(termId).toArray(),
  ]);
  const levelByStudent = new Map(enrollments.map((e) => [e.studentId, e.levelId]));

  let passCount = 0;
  let totalCount = 0;
  for (const rec of scores) {
    const total = computeSubjectTotal(rec.sbaScore, rec.examScore);
    if (total === null) continue;
    const levelId = levelByStudent.get(rec.studentId);
    const bands = resolveGradeBandsForLevel(allBands, levelId ?? -1).slice().sort((a, b) => a.minScore - b.minScore);
    const band = findGradeBand(total, bands);
    if (!band) continue;
    totalCount++;
    const lowestBand = bands[0];
    if (lowestBand && band.code !== lowestBand.code) passCount++;
  }
  return { passCount, totalCount, pct: totalCount > 0 ? Math.round((passCount / totalCount) * 1000) / 10 : 0 };
}

/** Promotion statistics (Module 4) for one academic year - how many
 *  students were promoted/repeated/transferred/graduated at its
 *  year-end promotion round. */
export async function getPromotionStatistics(academicYearId: number): Promise<Record<PromotionStatus, number>> {
  const rows = await db.promotionHistory.where("academicYearId").equals(academicYearId).toArray();
  const base: Record<PromotionStatus, number> = { PROMOTED: 0, REPEATED: 0, TRANSFERRED: 0, GRADUATED: 0 };
  for (const row of rows) base[row.status]++;
  return base;
}

/** Attendance summary (Module 4) - average % of school days attended,
 *  from the same `daysPresent` field the report cards print, against
 *  the term's configured `totalSchoolDays`. */
export async function getAttendanceSummary(termId: number): Promise<{ averagePct: number; studentsRecorded: number; totalStudents: number }> {
  const [term, records, enrollments] = await Promise.all([
    db.terms.get(termId),
    db.reportRecords.where("termId").equals(termId).toArray(),
    db.enrollments.where("termId").equals(termId).toArray(),
  ]);
  const totalSchoolDays = term?.totalSchoolDays ?? 0;
  const withAttendance = records.filter((r) => typeof r.daysPresent === "number");
  const averagePct =
    totalSchoolDays > 0 && withAttendance.length > 0
      ? Math.round(
          (withAttendance.reduce((sum, r) => sum + (r.daysPresent! / totalSchoolDays), 0) / withAttendance.length) * 1000,
        ) / 10
      : 0;
  return { averagePct, studentsRecorded: withAttendance.length, totalStudents: enrollments.length };
}

/** Assessment completion rate (Module 4) - reuses the same per-class
 *  summary the Assessment Dashboard already computes, just rolled up. */
export async function getAssessmentCompletionRate(termId: number): Promise<{ finalizedClasses: number; totalClasses: number; pct: number }> {
  const summaries = await getAllClassSummaries(termId);
  const finalizedClasses = summaries.filter((s) => s.status === "FINALIZED").length;
  return {
    finalizedClasses,
    totalClasses: summaries.length,
    pct: summaries.length > 0 ? Math.round((finalizedClasses / summaries.length) * 1000) / 10 : 0,
  };
}

/** Single overall average Total across every scored subject entry in
 *  the term - used for the Dashboard's academic performance trend line
 *  across terms. */
export async function getOverallAverage(termId: number): Promise<number> {
  const scores = await db.scoreRecords.where("termId").equals(termId).toArray();
  const totals = scores.map((s) => computeSubjectTotal(s.sbaScore, s.examScore)).filter((t): t is number => t !== null);
  return totals.length > 0 ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0;
}

export interface YearComparisonRow {
  academicYearId: number;
  label: string;
  studentCount: number;
  averageScore: number;
  passRatePct: number;
  promotions: Record<PromotionStatus, number>;
}

/** Module 1 - "Compare academic years". Aggregates across every term
 *  belonging to each requested year; reads only the existing, already
 *  permanent live tables (enrollments/scoreRecords/promotionHistory) -
 *  see Archive.ts for why there is no separate archived copy to read
 *  from instead. */
export async function compareAcademicYears(academicYearIds: number[]): Promise<YearComparisonRow[]> {
  const [years, allTerms, allBands] = await Promise.all([
    db.academicYears.bulkGet(academicYearIds),
    db.terms.toArray(),
    GradeBandService.getAll(),
  ]);

  const rows: YearComparisonRow[] = [];
  for (let i = 0; i < academicYearIds.length; i++) {
    const yearId = academicYearIds[i];
    const year = years[i];
    if (!year) continue;
    const termsInYear = allTerms.filter((t) => t.academicYearId === yearId);
    const termIds = termsInYear.map((t) => t.id!);

    const enrollments = await db.enrollments.where("academicYearId").equals(yearId).toArray();
    const studentIds = new Set(enrollments.map((e) => e.studentId));
    const levelByStudent = new Map(enrollments.map((e) => [e.studentId, e.levelId]));

    // Performance (Module 8) - fetch every term's scores in parallel;
    // a school comparing several 20+-year-old academic years otherwise
    // pays one sequential round-trip per term (3 terms/year adds up).
    const scoresByTerm = await Promise.all(termIds.map((termId) => db.scoreRecords.where("termId").equals(termId).toArray()));
    const scores = scoresByTerm.flat();

    const totals = scores.map((s) => computeSubjectTotal(s.sbaScore, s.examScore)).filter((t): t is number => t !== null);
    const averageScore = totals.length > 0 ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : 0;

    let passCount = 0;
    let totalCount = 0;
    for (const rec of scores) {
      const total = computeSubjectTotal(rec.sbaScore, rec.examScore);
      if (total === null) continue;
      const levelId = levelByStudent.get(rec.studentId);
      const bands = resolveGradeBandsForLevel(allBands, levelId ?? -1).slice().sort((a, b) => a.minScore - b.minScore);
      const band = findGradeBand(total, bands);
      if (!band) continue;
      totalCount++;
      if (bands[0] && band.code !== bands[0].code) passCount++;
    }

    const promotions = await getPromotionStatistics(yearId);

    rows.push({
      academicYearId: yearId,
      label: year.label,
      studentCount: studentIds.size,
      averageScore,
      passRatePct: totalCount > 0 ? Math.round((passCount / totalCount) * 1000) / 10 : 0,
      promotions,
    });
  }
  return rows;
}
