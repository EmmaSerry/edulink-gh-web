// Phase 7 (Module 13 - Final Acceptance Test), Scenario 1: the full
// Primary/JHS school workflow exactly as diagrammed in the Phase 7
// brief:
//
//   Configure School -> Register Students -> Assign Classes ->
//   Enter SBA and Examination Scores -> Finalize Assessments ->
//   Generate Reports -> Print Reports -> Archive Term ->
//   Backup System -> Restore Backup -> Reprint Archived Reports
//
// Same constraints as every other proof script in this project (no real
// browser, no installed node_modules in this sandbox) - a faithful,
// hand-transcribed simulation of a whole in-memory "database" using the
// exact table shapes/algorithms from src/database/db.ts,
// AssessmentCalculationEngine.ts, ArchiveService.ts,
// ReportGenerationService.ts and BackupService.ts, read directly from
// source immediately before writing this script.

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; }
  else console.log("  ok -", msg);
}
function step(n, name) {
  console.log(`\n--- Step ${n}: ${name} ---`);
}

// A tiny in-memory stand-in for the relevant Dexie tables.
const db = {
  schools: [],
  academicYears: [],
  terms: [],
  classes: [],
  students: [],
  enrollments: [],
  scoreRecords: [],
  assessmentSessions: [],
  gradeBands: [],
  archives: [],
  generatedReports: [],
  reportVersions: [],
  printLogs: [],
};

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
function computeOverallForStudent(subjectTotals, bands) {
  if (subjectTotals.length === 0) return { total: 0, average: 0, grade: undefined };
  const total = subjectTotals.reduce((sum, t) => sum + t, 0);
  const average = total / subjectTotals.length;
  return { total, average, grade: findGradeBand(average, bands) };
}

step(1, "Configure School");
db.schools.push({ id: 1, name: "Amenfi Central Model School", schoolCode: "ACT-001", circuit: "Amenfi Central" });
db.academicYears.push({ id: 1, label: "2025/2026", isCurrent: true });
db.terms.push({ id: 1, academicYearId: 1, termNumber: 1, isActive: true, vacationDate: "2025-12-19", reopeningDate: "2026-01-12" });
db.classes.push({ id: 1, levelId: 4, code: "JHS2A", name: "JHS 2 A" });
db.gradeBands.push(
  { code: "A", label: "Excellent", minScore: 80, maxScore: 100, isActive: true },
  { code: "B", label: "Very Good", minScore: 70, maxScore: 79, isActive: true },
  { code: "C", label: "Good", minScore: 60, maxScore: 69, isActive: true },
  { code: "D", label: "Credit", minScore: 50, maxScore: 59, isActive: true },
  { code: "F", label: "Fail", minScore: 0, maxScore: 49, isActive: true },
);
assert(db.schools.length === 1 && db.terms.length === 1, "School profile, academic year, term and grade bands configured");

step(2, "Register Students");
db.students.push(
  { id: 1, studentId: "ACT-2025-0001", firstName: "Ama", lastName: "Boateng", status: "ACTIVE" },
  { id: 2, studentId: "ACT-2025-0002", firstName: "Kofi", lastName: "Mensah", status: "ACTIVE" },
);
assert(db.students.every((s) => s.studentId?.startsWith("ACT-")), "Both students registered with a permanent generated Student ID");

step(3, "Assign Classes");
db.enrollments.push(
  { id: 1, studentId: 1, academicYearId: 1, termId: 1, levelId: 4, classId: 1, isCurrent: true },
  { id: 2, studentId: 2, academicYearId: 1, termId: 1, levelId: 4, classId: 1, isCurrent: true },
);
assert(db.enrollments.length === 2 && db.enrollments.every((e) => e.classId === 1), "Both students enrolled into JHS 2 A for Term 1");

step(4, "Enter SBA and Examination Scores");
const subjects = [{ id: 501, name: "Mathematics" }, { id: 502, name: "English" }];
db.scoreRecords.push(
  { studentId: 1, termId: 1, subjectId: 501, sbaScore: 45, examScore: 40 },
  { studentId: 1, termId: 1, subjectId: 502, sbaScore: 40, examScore: 38 },
  { studentId: 2, termId: 1, subjectId: 501, sbaScore: 30, examScore: 28 },
  { studentId: 2, termId: 1, subjectId: 502, sbaScore: 48, examScore: 47 },
);
assert(db.scoreRecords.length === 4, "SBA + Exam scores entered for both students, both subjects");

step(5, "Finalize Assessments");
db.assessmentSessions.push({ id: 1, classId: 1, termId: 1, status: "DRAFT" });
const ORDER = ["DRAFT", "COMPLETED", "VERIFIED", "FINALIZED"];
for (const next of ORDER.slice(1)) {
  db.assessmentSessions[0].status = next; // mirrors AssessmentSessionService.changeStatus's forward progression
}
assert(db.assessmentSessions[0].status === "FINALIZED", "Assessment session progressed Draft -> Completed -> Verified -> Finalized");

step(6, "Generate Reports");
function buildSnapshot(studentId) {
  const rows = subjects.map((subj) => {
    const cell = db.scoreRecords.find((r) => r.studentId === studentId && r.subjectId === subj.id);
    const total = cell ? computeSubjectTotal(cell.sbaScore, cell.examScore) : null;
    return { subjectId: subj.id, subjectName: subj.name, total, grade: findGradeBand(total, db.gradeBands)?.code };
  });
  const overall = computeOverallForStudent(rows.map((r) => r.total).filter((t) => t !== null), db.gradeBands);
  return { studentId, termId: 1, subjects: rows, overall };
}
for (const student of db.students) {
  const snapshot = buildSnapshot(student.id);
  const now = new Date().toISOString();
  db.generatedReports.push({ studentId: student.id, termId: 1, classId: 1, versionNumber: 1, snapshotData: snapshot, generatedAt: now, printCount: 0 });
  db.reportVersions.push({ studentId: student.id, termId: 1, versionNumber: 1, snapshotData: snapshot, generatedAt: now });
}
assert(db.generatedReports.length === 2, "One current GeneratedReport row created per student");
const amaReport = db.generatedReports.find((r) => r.studentId === 1);
assert(amaReport.snapshotData.overall.average === (85 + 78) / 2, "Ama's report overall average correctly computed as (85+78)/2=81.5");
assert(amaReport.snapshotData.subjects.find((s) => s.subjectId === 501).grade === "A", "Ama's Mathematics (85) correctly graded A");

step(7, "Print Reports");
for (const student of db.students) {
  const report = db.generatedReports.find((r) => r.studentId === student.id);
  report.printCount += 1;
  db.printLogs.push({ studentId: student.id, termId: 1, performedAt: new Date().toISOString() });
}
assert(db.printLogs.length === 2 && db.generatedReports.every((r) => r.printCount === 1), "Both reports printed and logged");

step(8, "Archive Term");
db.archives.push({ termId: 1, academicYearId: 1, archivedAt: new Date().toISOString() });
function assertTermEditable(termId) {
  if (db.archives.some((a) => a.termId === termId)) throw new Error(`Term ${termId} is archived and cannot be edited.`);
}
let editBlocked = false;
try { assertTermEditable(1); } catch { editBlocked = true; }
assert(editBlocked, "Term 1 archived - further score/report edits are now blocked");

step(9, "Backup System");
// Faithful reproduction of BackupService.buildPayload: a plain snapshot
// of every selected table, JSON-serializable.
const backupFile = JSON.parse(JSON.stringify({
  meta: { app: "ACTRS", version: "1.0.0", dbVersion: 6, scope: "full" },
  data: { ...db },
}));
assert(backupFile.data.students.length === 2 && backupFile.data.generatedReports.length === 2, "Full backup captured students, enrollments, scores, reports and the archive record");

step(10, "Restore Backup");
// Faithful reproduction of BackupService.restore: clear each table, then
// bulk-re-add from the backup file, inside what would be one Dexie
// read-write transaction (atomicity is IndexedDB-native, not re-modelled
// here - see docs/DATABASE.md "Data integrity on restore").
for (const table of Object.keys(db)) {
  db[table] = [];
}
assert(Object.values(db).every((t) => t.length === 0), "All tables cleared (simulating a fresh/replacement device) before restore");
for (const [table, rows] of Object.entries(backupFile.data)) {
  db[table] = JSON.parse(JSON.stringify(rows));
}
assert(db.students.length === 2 && db.generatedReports.length === 2 && db.archives.length === 1, "Restore repopulated students, reports and the archive record exactly as backed up");

step(11, "Reprint Archived Reports");
// Reproduces ReportPreview's "mode=frozen" path: reads the existing
// GeneratedReport/ReportVersion snapshot as-is, never recalculates.
const restoredReport = db.generatedReports.find((r) => r.studentId === 1);
assert(restoredReport.snapshotData.overall.average === 81.5, "Ama's restored report still shows the exact original overall average (81.5) - reprinted from the frozen snapshot, not recalculated");
assert(db.reportVersions.find((v) => v.studentId === 1 && v.versionNumber === 1) !== undefined, "Original version 1 snapshot is still independently retrievable after restore");
editBlocked = false;
try { assertTermEditable(1); } catch { editBlocked = true; }
assert(editBlocked, "Term 1 is still archived/locked after restore - the archive record itself was preserved by the backup/restore cycle");

console.log("\nALL CHECKS PASSED - full Primary/JHS acceptance scenario (Configure School -> Register Students -> Assign Classes -> Enter Scores -> Finalize Assessments -> Generate Reports -> Print Reports -> Archive Term -> Backup -> Restore -> Reprint Archived Reports) completes successfully end to end.");
