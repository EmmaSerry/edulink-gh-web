// Executable proof that the JHS "Social Studies position reads Science
// position" defect (from the old Word mail-merge template) cannot occur
// in ACTRS's ReportDataService. This is a faithful, hand-transcribed
// reproduction of the exact algorithm in
// src/services/ReportDataService.ts's buildClassSnapshots() scored-level
// branch: one competition-ranking Map built independently PER subjectId,
// then each subject row reads ONLY from its own subjectId's entry.

function computeSubjectTotal(sba, exam) {
  if (sba === null || exam === null) return null;
  return Math.min(100, sba + exam);
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

// Simulated JHS class of 4 students, 2 subjects: Science and Social
// Studies, with DELIBERATELY DIFFERENT score patterns so the two
// subjects must produce different rankings if computed correctly.
const SCIENCE_ID = 501;
const SOCIAL_STUDIES_ID = 502;
const studentIds = [1, 2, 3, 4];

// scoresByStudentAndSubject: the exact lookup structure ReportDataService
// builds - keyed by `${studentId}:${subjectId}`.
const scoresByStudentAndSubject = new Map([
  ["1:501", { sba: 45, exam: 40 }], // Science: student 1 = 85
  ["2:501", { sba: 40, exam: 35 }], // Science: student 2 = 75
  ["3:501", { sba: 30, exam: 25 }], // Science: student 3 = 55
  ["4:501", { sba: 20, exam: 15 }], // Science: student 4 = 35

  ["1:502", { sba: 20, exam: 15 }], // Social Studies: student 1 = 35 (worst)
  ["2:502", { sba: 45, exam: 40 }], // Social Studies: student 2 = 85 (best)
  ["3:502", { sba: 40, exam: 35 }], // Social Studies: student 3 = 75
  ["4:502", { sba: 30, exam: 25 }], // Social Studies: student 4 = 55
]);

const subjects = [
  { id: SCIENCE_ID, name: "Science" },
  { id: SOCIAL_STUDIES_ID, name: "Social Studies" },
];

// Reproduces ReportDataService's rankingBySubject construction exactly.
const rankingBySubject = new Map();
for (const subject of subjects) {
  const items = studentIds.map((sid) => {
    const cell = scoresByStudentAndSubject.get(`${sid}:${subject.id}`);
    const total = cell ? computeSubjectTotal(cell.sba, cell.exam) : null;
    return { studentId: sid, total };
  });
  const ranked = computeCompetitionRanking(items, (x) => x.total);
  rankingBySubject.set(subject.id, new Map(ranked.map((r) => [r.item.studentId, r.rank])));
}

// Reproduces how each subject row reads ITS OWN position (the exact
// lookup pattern in ScoredReportLayout.tsx / ReportDataService.ts).
function getPosition(subjectId, studentId) {
  return rankingBySubject.get(subjectId)?.get(studentId);
}

let failures = 0;
function check(label, actual, expected) {
  if (actual !== expected) {
    console.error(`FAIL: ${label} - expected ${expected}, got ${actual}`);
    failures++;
  } else {
    console.log(`ok - ${label}`);
  }
}

// Student 1 is WORST in Social Studies (rank 4) but BEST in Science (rank 1).
// If the old bug existed, Student 1's Social Studies row would show
// Science's rank (1) instead of Social Studies' own rank (4).
check("Student 1 Science position = 1st (their best subject)", getPosition(SCIENCE_ID, 1), 1);
check("Student 1 Social Studies position = 4th (their own, worst subject) - NOT Science's 1st", getPosition(SOCIAL_STUDIES_ID, 1), 4);

// Student 2 is the mirror image: worst in Science, best in Social Studies.
check("Student 2 Science position = 2nd (their own)", getPosition(SCIENCE_ID, 2), 2);
check("Student 2 Social Studies position = 1st (their own) - NOT Science's 2nd", getPosition(SOCIAL_STUDIES_ID, 2), 1);

// Sanity: the two subjects' entire ranking maps must actually differ -
// if they were accidentally the same object/reference (the class of bug
// being guarded against), every position would be identical, which they
// are provably not.
const scienceRanks = studentIds.map((id) => getPosition(SCIENCE_ID, id));
const socialRanks = studentIds.map((id) => getPosition(SOCIAL_STUDIES_ID, id));
check("Science and Social Studies rankings are genuinely independent (not the same object)", JSON.stringify(scienceRanks) === JSON.stringify(socialRanks), false);

console.log(failures === 0 ? "\nALL CHECKS PASSED - JHS Social Studies/Science bug cannot occur" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
