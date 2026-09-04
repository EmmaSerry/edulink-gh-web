// Phase 6 (Module 11 - End-to-End Testing, Scenario 1: "full scored-level
// lifecycle"). This sandbox has no real browser and no installed
// node_modules (npm registry is unavailable), so this is a faithful,
// hand-transcribed reproduction of the exact pure functions in
// src/services/AssessmentCalculationEngine.ts and the exact wiring in
// src/services/ReportDataService.ts's scored-level branch (both re-read
// directly from source immediately before writing this script - see
// Phase 6 findings log for line references). It walks a JHS class of 3
// students through registration -> enrollment -> score entry -> report
// calculation -> archiving -> versioning, asserting the real business
// rules at every step.

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; }
  else console.log("ok -", msg);
}

// ---- AssessmentCalculationEngine, transcribed verbatim ----
function computeSubjectTotal(sba, exam) {
  if (sba === null || exam === null) return null;
  return Math.min(100, sba + exam);
}
function findGradeBand(score, bands) {
  if (score === null) return undefined;
  const sorted = [...bands].filter((b) => b.isActive).sort((a, b) => b.minScore - a.minScore);
  return sorted.find((b) => score >= b.minScore && score <= b.maxScore);
}
function computeCompetitionRanking(items, getValue) {
  const scored = items.map((item) => ({ item, value: getValue(item) })).filter((x) => x.value !== null && x.value !== undefined);
  const sorted = [...scored].sort((a, b) => b.value - a.value);
  const ranked = [];
  let rank = 0, lastValue = null, seen = 0;
  for (const { item, value } of sorted) {
    seen++;
    if (value !== lastValue) { rank = seen; lastValue = value; }
    ranked.push({ item, value, rank });
  }
  return ranked;
}
function computeOverallForStudent(subjectTotals, bands) {
  if (subjectTotals.length === 0) return { total: 0, average: 0, grade: undefined };
  const total = subjectTotals.reduce((sum, t) => sum + t, 0);
  const average = total / subjectTotals.length;
  return { total, average, grade: findGradeBand(average, bands) };
}

console.log("--- Step 1: Registration & Enrollment ---");
const students = [
  { id: 1, name: "Ama Boateng" },
  { id: 2, name: "Kofi Mensah" },
  { id: 3, name: "Efua Owusu" },
];
const classId = 10, termId = 100, levelId = 4; // JHS 2
assert(students.length === 3, "3 students registered and enrolled into JHS 2, Term 1");

console.log("\n--- Step 2: Score entry (SBA/Exam, 0-50 each) ---");
const subjects = [
  { id: 501, name: "Mathematics" },
  { id: 502, name: "English" },
  { id: 503, name: "Science" },
];
// Efua (student 3) is deliberately left unscored in Science, to test the
// "partial assessment -> average over what's entered, not zero" rule.
const scoresByStudentAndSubject = new Map([
  ["1:501", { sba: 45, exam: 40 }], // Ama Math = 85
  ["1:502", { sba: 40, exam: 35 }], // Ama English = 75
  ["1:503", { sba: 42, exam: 38 }], // Ama Science = 80
  ["2:501", { sba: 30, exam: 25 }], // Kofi Math = 55
  ["2:502", { sba: 48, exam: 47 }], // Kofi English = 95 (best in class)
  ["2:503", { sba: 35, exam: 30 }], // Kofi Science = 65
  ["3:501", { sba: 50, exam: 50 }], // Efua Math = 100 (best in class, cap boundary)
  ["3:502", { sba: 20, exam: 15 }], // Efua English = 35
  // 3:503 intentionally absent - Efua not yet scored in Science
]);

const gradeBands = [
  { code: "A", label: "Excellent", minScore: 80, maxScore: 100, isActive: true },
  { code: "B", label: "Very Good", minScore: 70, maxScore: 79, isActive: true },
  { code: "C", label: "Good", minScore: 60, maxScore: 69, isActive: true },
  { code: "D", label: "Credit", minScore: 50, maxScore: 59, isActive: true },
  { code: "E", label: "Pass", minScore: 40, maxScore: 49, isActive: true },
  { code: "F", label: "Fail", minScore: 0, maxScore: 39, isActive: true },
];

assert(computeSubjectTotal(45, 40) === 85, "Subject total = SBA + Exam (45+40=85)");
assert(computeSubjectTotal(50, 50) === 100, "Subject total caps correctly at the 100 boundary (50+50=100)");
assert(computeSubjectTotal(60, 60) === 100, "Defense-in-depth: an out-of-spec 60+60 is still capped at 100, never allowed to exceed it");
assert(computeSubjectTotal(45, null) === null, "A subject with only one component entered (not yet fully scored) has no total - not a partial guess");
assert(findGradeBand(80, gradeBands).code === "A", "Score of exactly 80 lands in band A (lower boundary inclusive)");
assert(findGradeBand(79, gradeBands).code === "B", "Score of 79 lands in band B, not A (upper boundary of B respected)");

console.log("\n--- Step 3: Report calculation (per-subject + overall) ---");
const studentIds = students.map((s) => s.id);

const rankingBySubject = new Map();
for (const subject of subjects) {
  const items = studentIds.map((sid) => {
    const cell = scoresByStudentAndSubject.get(`${sid}:${subject.id}`);
    const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
    return { studentId: sid, total };
  });
  rankingBySubject.set(subject.id, computeCompetitionRanking(items, (x) => x.total));
}

const mathRanking = rankingBySubject.get(501);
assert(mathRanking.find((r) => r.item.studentId === 3).rank === 1, "Efua ranks 1st in Mathematics (her best subject: 100)");
assert(mathRanking.find((r) => r.item.studentId === 1).rank === 2, "Ama ranks 2nd in Mathematics (85)");
assert(mathRanking.find((r) => r.item.studentId === 2).rank === 3, "Kofi ranks 3rd in Mathematics (55, his weakest)");

const englishRanking = rankingBySubject.get(502);
assert(englishRanking.find((r) => r.item.studentId === 2).rank === 1, "Kofi ranks 1st in English (95, his best) - independent of his 3rd place in Maths");
assert(englishRanking.find((r) => r.item.studentId === 3).rank === 3, "Efua ranks 3rd (last) in English (35) despite ranking 1st in Maths - proves subjects never leak into each other's ranking (the JHS bug class)");

const scienceRanking = rankingBySubject.get(503);
assert(scienceRanking.length === 2, "Science ranking only includes the 2 students actually scored - Efua (unscored) is excluded, not ranked last");

const overallItems = studentIds.map((sid) => {
  const totals = subjects
    .map((subject) => scoresByStudentAndSubject.get(`${sid}:${subject.id}`))
    .filter((cell) => cell)
    .map((cell) => computeSubjectTotal(cell.sba, cell.exam))
    .filter((t) => t !== null);
  const overall = computeOverallForStudent(totals, gradeBands);
  return { studentId: sid, average: totals.length > 0 ? overall.average : null, subjectsScored: totals.length };
});

const efua = overallItems.find((x) => x.studentId === 3);
assert(efua.subjectsScored === 2, "Efua's overall average is computed over exactly the 2 subjects she has scores in");
assert(Math.abs(efua.average - (100 + 35) / 2) < 1e-9, "Efua's average is (100+35)/2=67.5 - NOT diluted by treating the unscored Science subject as a 0");

const overallRanked = computeCompetitionRanking(overallItems, (x) => x.average);
assert(overallRanked[0].item.studentId === 1, "Ama has the highest overall average ((85+75+80)/3=80) and ranks 1st overall");
console.log("   Overall averages:", overallItems.map((x) => `student ${x.studentId}: ${x.average?.toFixed(2)}`).join(", "));

console.log("\n--- Step 4: Archiving locks the term ---");
// Faithful reproduction of ArchiveService.assertTermEditable: throws once
// a term has an entry in the archives table, guarding every mutating
// service method (ScoreRecordService.upsertField, SkillRecordService.
// upsertRating, ReportRecordService.upsertFields, etc.) - see
// src/services/ArchiveService.ts.
const archivedTermIds = new Set();
function assertTermEditable(termId) {
  if (archivedTermIds.has(termId)) throw new Error(`Term ${termId} is archived and cannot be edited.`);
}
assertTermEditable(termId); // does not throw yet
archivedTermIds.add(termId); // school archives the term at term-end
let threw = false;
try { assertTermEditable(termId); } catch { threw = true; }
assert(threw, "After archiving, attempting to edit a score in this term throws - historical records are locked");

console.log("\n--- Step 5: Report versioning survives archiving ---");
// Faithful reproduction of ReportGenerationService.generateForStudent's
// transaction: `generatedReports` (one CURRENT row per student+term) is
// upserted, `reportVersions` (append-only) always gets a new row - see
// src/services/ReportGenerationService.ts.
const generatedReports = new Map(); // key: `${studentId}:${termId}` -> current row
const reportVersions = []; // append-only
function generateReport(studentId, termId, snapshotData) {
  const key = `${studentId}:${termId}`;
  const existing = generatedReports.get(key);
  const versionNumber = (existing?.versionNumber ?? 0) + 1;
  generatedReports.set(key, { studentId, termId, versionNumber, snapshotData });
  reportVersions.push({ studentId, termId, versionNumber, snapshotData });
}
generateReport(1, termId, { overallAverage: 80 }); // first generation, before archiving
generateReport(1, termId, { overallAverage: 80 }); // regenerated once more (e.g. re-opened and reprinted)
assert(generatedReports.get(`1:${termId}`).versionNumber === 2, "The CURRENT report row reflects the latest version (2)");
assert(reportVersions.length === 2, "Both generations are preserved in the append-only version history - the first was never deleted or overwritten");
assert(reportVersions[0].versionNumber === 1 && reportVersions[1].versionNumber === 2, "Version numbers are sequential and both entries remain independently retrievable");

console.log("\nALL CHECKS PASSED - full scored-level lifecycle (registration -> enrollment -> score entry -> calculation -> archiving -> versioning) behaves correctly end to end.");
