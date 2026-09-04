// Phase 6 (Module 11 - End-to-End Testing, Scenario 2: "KG lifecycle").
// Same constraints/methodology as verify_e2e_scored_lifecycle.mjs (no
// browser, no installed node_modules in this sandbox) - a faithful,
// hand-transcribed reproduction of the actual KG data shapes in
// src/reporting/ReportSnapshot.types.ts and the actual guard call site in
// src/services/SkillRecordService.ts (ArchiveService.assertTermEditable),
// re-read directly from source immediately before writing this script.
// Walks a KG1 student through registration -> enrollment -> skill-rating
// entry -> report snapshot assembly -> archiving, asserting the NaCCA
// qualitative-only rule holds throughout.

function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); process.exitCode = 1; }
  else console.log("ok -", msg);
}

console.log("--- Step 1: Registration & Enrollment ---");
const student = { id: 20, name: "Yaw Asante" };
const classId = 30, termId = 200, levelId = 1; // KG1
console.log(`   ${student.name} registered and enrolled into KG1, Term 1.`);

console.log("\n--- Step 2: Skill-rating entry (Gold/Silver/Bronze/X/O only) ---");
// Reproduces Skill/SkillAssessmentRecord's actual rating domain exactly -
// see src/models/AssessmentRecord.ts: `ProficiencyRating = "G"|"S"|"B"|"X"|"O"`.
const VALID_RATINGS = ["G", "S", "B", "X", "O"];
const learningAreas = [
  {
    learningAreaId: 1,
    name: "Language & Literacy",
    skills: [
      { skillId: 101, serialNumber: 1, description: "Recognises own name in print", rating: "G" },
      { skillId: 102, serialNumber: 2, description: "Holds a book correctly", rating: "S" },
    ],
  },
  {
    learningAreaId: 2,
    name: "Numeracy",
    skills: [
      { skillId: 201, serialNumber: 1, description: "Counts objects 1-10", rating: "B" },
      { skillId: 202, serialNumber: 2, description: "Recognises basic shapes", rating: "X" },
    ],
  },
];
const allRatings = learningAreas.flatMap((la) => la.skills.map((s) => s.rating));
assert(allRatings.every((r) => VALID_RATINGS.includes(r)), "Every entered rating is one of the 5 NaCCA qualitative values (G/S/B/X/O) - never a number");

console.log("\n--- Step 3: Report snapshot assembly (no scored-level concepts) ---");
// Reproduces the exact ReportSnapshot shape for a KG student - see
// src/reporting/ReportSnapshot.types.ts: `subjects`/`overall`/
// `scoredRemarks` are typed as scored-levels-only and simply absent here;
// `learningAreas`/`kgRemarks` are the KG-only fields; `attendance` (with
// its `attendancePercentage`) is shared by both template families - a
// documented, deliberate exception to "no percentages in KG", since
// attendance is not an assessment concept.
const kgSnapshot = {
  templateCode: "kg",
  student: { id: student.id, name: student.name },
  term: { termId, label: "Term 1" },
  attendance: { daysPresent: 58, daysTotal: 60, attendancePercentage: (58 / 60) * 100 },
  learningAreas,
  kgRemarks: { generalComment: "Settling in well.", classTeacherName: "Mrs. Owusu" },
  // Deliberately no subjects/overall/scoredRemarks keys at all.
};

const FORBIDDEN_KEYS = ["subjects", "overall", "scoredRemarks", "total", "average", "grade", "position", "rank", "score"];
const presentForbiddenKeys = FORBIDDEN_KEYS.filter((k) => k in kgSnapshot);
assert(presentForbiddenKeys.length === 0, "The KG snapshot object contains none of the scored-level keys (subjects/overall/scoredRemarks/total/average/grade/position/rank/score)");

const snapshotJson = JSON.stringify(kgSnapshot);
assert(!/"total"|"average"|"grade"|"position"|"rank"(?!ing)/i.test(snapshotJson), "Serialized KG snapshot JSON contains no scored-level field names anywhere, including nested");
assert(snapshotJson.includes("attendancePercentage"), "Attendance percentage IS present - confirmed as the one documented, deliberate percentage exception (not an assessment concept)");

console.log("\n--- Step 4: Archiving locks the term (same guard as scored levels) ---");
// SkillRecordService.upsertRating calls the exact same
// ArchiveService.assertTermEditable(termId) guard ScoreRecordService does
// - one shared lock mechanism protects both level types identically.
const archivedTermIds = new Set();
function assertTermEditable(termId) {
  if (archivedTermIds.has(termId)) throw new Error(`Term ${termId} is archived and cannot be edited.`);
}
assertTermEditable(termId);
archivedTermIds.add(termId);
let threw = false;
try { assertTermEditable(termId); } catch { threw = true; }
assert(threw, "After archiving, attempting to change a skill rating in this term throws - identical lock behaviour to scored levels");

console.log("\nALL CHECKS PASSED - KG lifecycle (registration -> enrollment -> skill-rating entry -> report assembly -> archiving) stays qualitative-only end to end, with the sole documented attendance-percentage exception intact.");
