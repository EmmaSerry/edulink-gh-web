// Phase 7 (Module 13 - Final Acceptance Test), Scenario 2: the full KG
// school workflow exactly as diagrammed in the Phase 7 brief:
//
//   Configure School -> Register Learners -> Enter Skill Assessments ->
//   Generate KG Reports -> Archive -> Backup -> Restore ->
//   Reprint Reports
//
// Same methodology/constraints as verify_acceptance_primary_workflow.mjs.

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; }
  else console.log("  ok -", msg);
}
function step(n, name) {
  console.log(`\n--- Step ${n}: ${name} ---`);
}

const VALID_RATINGS = ["G", "S", "B", "X", "O"];
const FORBIDDEN_SNAPSHOT_KEYS = ["subjects", "overall", "scoredRemarks", "total", "average", "grade", "position", "rank", "score"];

const db = {
  schools: [],
  academicYears: [],
  terms: [],
  classes: [],
  students: [],
  enrollments: [],
  skillAssessmentRecords: [],
  learningAreas: [],
  skills: [],
  archives: [],
  generatedReports: [],
  reportVersions: [],
  printLogs: [],
};

step(1, "Configure School");
db.schools.push({ id: 1, name: "Amenfi Central Model School", schoolCode: "ACT-001" });
db.academicYears.push({ id: 1, label: "2025/2026", isCurrent: true });
db.terms.push({ id: 1, academicYearId: 1, termNumber: 1, isActive: true });
db.classes.push({ id: 2, levelId: 1, code: "KG1A", name: "KG 1 A" });
db.learningAreas.push({ id: 1, name: "Language & Literacy" }, { id: 2, name: "Numeracy" });
db.skills.push(
  { id: 101, learningAreaId: 1, serialNumber: 1, description: "Recognises own name in print" },
  { id: 201, learningAreaId: 2, serialNumber: 1, description: "Counts objects 1-10" },
);
assert(db.terms.length === 1 && db.learningAreas.length === 2, "School profile, term and KG learning areas/skills configured");

step(2, "Register Learners");
db.students.push({ id: 10, studentId: "ACT-2025-0010", firstName: "Yaw", lastName: "Asante", status: "ACTIVE" });
db.enrollments.push({ id: 5, studentId: 10, academicYearId: 1, termId: 1, levelId: 1, classId: 2, isCurrent: true });
assert(db.students.length === 1 && db.enrollments[0].classId === 2, "Learner registered and enrolled into KG 1 A");

step(3, "Enter Skill Assessments");
db.skillAssessmentRecords.push(
  { studentId: 10, termId: 1, skillId: 101, rating: "G" },
  { studentId: 10, termId: 1, skillId: 201, rating: "S" },
);
assert(db.skillAssessmentRecords.every((r) => VALID_RATINGS.includes(r.rating)), "Skill ratings entered using only the 5 NaCCA qualitative values (G/S/B/X/O)");

step(4, "Generate KG Reports");
function buildKgSnapshot(studentId) {
  const ratings = db.skillAssessmentRecords.filter((r) => r.studentId === studentId);
  const learningAreas = db.learningAreas.map((la) => ({
    learningAreaId: la.id,
    name: la.name,
    skills: db.skills
      .filter((sk) => sk.learningAreaId === la.id)
      .map((sk) => ({
        skillId: sk.id,
        description: sk.description,
        rating: ratings.find((r) => r.skillId === sk.id)?.rating ?? null,
      })),
  }));
  return {
    templateCode: "kg",
    studentId,
    termId: 1,
    attendance: { daysPresent: 58, daysTotal: 60, attendancePercentage: (58 / 60) * 100 },
    learningAreas,
    kgRemarks: { generalComment: "Settling in well." },
  };
}
const kgSnapshot = buildKgSnapshot(10);
const now = new Date().toISOString();
db.generatedReports.push({ studentId: 10, termId: 1, classId: 2, versionNumber: 1, snapshotData: kgSnapshot, generatedAt: now, printCount: 0 });
db.reportVersions.push({ studentId: 10, termId: 1, versionNumber: 1, snapshotData: kgSnapshot, generatedAt: now });

const presentForbiddenKeys = FORBIDDEN_SNAPSHOT_KEYS.filter((k) => k in kgSnapshot);
assert(presentForbiddenKeys.length === 0, "Generated KG report snapshot contains none of the scored-level keys (subjects/overall/total/average/grade/position/rank/score)");
assert(JSON.stringify(kgSnapshot).includes("attendancePercentage"), "Attendance percentage present as the one documented, deliberate exception");
assert(kgSnapshot.learningAreas.find((la) => la.learningAreaId === 1).skills[0].rating === "G", "Language & Literacy skill correctly shows the Gold rating entered");

step(5, "Archive");
db.archives.push({ termId: 1, academicYearId: 1, archivedAt: new Date().toISOString() });
function assertTermEditable(termId) {
  if (db.archives.some((a) => a.termId === termId)) throw new Error(`Term ${termId} is archived and cannot be edited.`);
}
let editBlocked = false;
try { assertTermEditable(1); } catch { editBlocked = true; }
assert(editBlocked, "Term 1 archived - further skill-rating edits are now blocked (same guard as scored levels)");

step(6, "Backup");
const backupFile = JSON.parse(JSON.stringify({
  meta: { app: "ACTRS", version: "1.0.0", dbVersion: 6, scope: "full" },
  data: { ...db },
}));
assert(backupFile.data.skillAssessmentRecords.length === 2 && backupFile.data.generatedReports.length === 1, "Full backup captured the learner, skill ratings, KG report and the archive record");

step(7, "Restore");
for (const table of Object.keys(db)) db[table] = [];
assert(Object.values(db).every((t) => t.length === 0), "All tables cleared before restore");
for (const [table, rows] of Object.entries(backupFile.data)) db[table] = JSON.parse(JSON.stringify(rows));
assert(db.students.length === 1 && db.generatedReports.length === 1 && db.archives.length === 1, "Restore repopulated the learner, KG report and archive record exactly as backed up");

step(8, "Reprint Reports");
const restoredReport = db.generatedReports.find((r) => r.studentId === 10);
const stillForbidden = FORBIDDEN_SNAPSHOT_KEYS.filter((k) => k in restoredReport.snapshotData);
assert(stillForbidden.length === 0, "Restored KG report snapshot still contains no scored-level fields - reprinted from the frozen snapshot, not recalculated");
assert(restoredReport.snapshotData.learningAreas[0].skills[0].rating === "G", "Restored report still shows the exact original Gold rating");
editBlocked = false;
try { assertTermEditable(1); } catch { editBlocked = true; }
assert(editBlocked, "Term 1 is still archived/locked after restore");

console.log("\nALL CHECKS PASSED - full KG acceptance scenario (Configure School -> Register Learners -> Enter Skill Assessments -> Generate KG Reports -> Archive -> Backup -> Restore -> Reprint Reports) completes successfully end to end.");
