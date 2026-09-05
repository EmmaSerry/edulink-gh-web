import { useEffect, useMemo, useState } from "react";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudSubjectService } from "@services/cloud/SubjectService";
import { CloudLearningAreaService } from "@services/cloud/LearningAreaService";
import { CloudSkillService } from "@services/cloud/SkillService";
import { CloudSkillAssessmentService } from "@services/cloud/SkillAssessmentService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudScoreRecordService } from "@services/cloud/ScoreRecordService";
import { CloudAssessmentSessionService } from "@services/cloud/AssessmentSessionService";
import type {
  TermRow,
  ClassRow,
  LevelRow,
  SubjectRow,
  LearningAreaRow,
  SkillRow,
  SkillRating,
  StudentRow,
  AssessmentSessionRow,
  AssessmentSessionStatus,
} from "@/types/database";

const STATUS_LABEL: Record<AssessmentSessionStatus, string> = {
  DRAFT: "Draft",
  COMPLETED: "Completed",
  VERIFIED: "Verified",
  FINALIZED: "Finalized",
};

const STATUS_BADGE: Record<AssessmentSessionStatus, string> = {
  DRAFT: "text-bg-secondary",
  COMPLETED: "text-bg-info",
  VERIFIED: "text-bg-warning",
  FINALIZED: "text-bg-success",
};

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

/**
 * Assessment entry, covering both assessment modes a level can use:
 *
 * - "scored" levels (Lower Primary, Upper Primary, JHS): a Subject
 *   picker plus an SBA/Exam score table, one subject at a time.
 * - "skill-checklist" levels (KG1/KG2): a Learning Area picker
 *   cascading to a Skill picker, plus a G/S/B/X/O rating + comment
 *   table for the selected skill, one skill at a time - the NaCCA
 *   Kindergarten Learner Report Form's rating scale.
 *
 * Deliberately one-subject/skill-at-a-time rather than a single giant
 * all-subjects grid: it's a smaller, safer version of this screen to
 * ship and verify, and matches how a teacher marking one thing at a
 * time actually works. A combined grid can replace this once this
 * simpler version has been used for real.
 *
 * Report generation requires the session to reach FINALIZED (see
 * ReportDataService.validateReportPrerequisites), so entry is only
 * editable while the session is still in DRAFT - once moved forward,
 * re-opening to DRAFT (an admin-only action) is required to edit again,
 * exactly matching the lifecycle enforced server-side by
 * change_assessment_status().
 */
export function CloudAssessmentWorkspace() {
  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [session, setSession] = useState<AssessmentSessionRow | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [scores, setScores] = useState<Map<string, { sba: number | null; exam: number | null }>>(new Map());

  const [learningAreas, setLearningAreas] = useState<LearningAreaRow[]>([]);
  const [learningAreaId, setLearningAreaId] = useState("");
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [skillId, setSkillId] = useState("");
  const [ratings, setRatings] = useState<Map<string, { rating: SkillRating | null; comment: string | null }>>(
    new Map()
  );

  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([CloudTermService.getActive(), CloudClassService.list(), CloudLevelService.list()])
      .then(([activeTerm, classRows, levelRows]) => {
        if (cancelled) return;
        setTerm(activeTerm);
        setClasses(classRows);
        setLevels(levelRows);
      })
      .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load setup data."))
      .finally(() => !cancelled && setLoadingContext(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedClass = useMemo(() => classes.find((c) => c.id === classId) ?? null, [classes, classId]);
  const selectedLevel = useMemo(
    () => levels.find((l) => l.id === selectedClass?.level_id) ?? null,
    [levels, selectedClass]
  );
  const isScoredLevel = selectedLevel?.assessment_mode === "scored";
  const isSkillLevel = selectedLevel?.assessment_mode === "skill-checklist";

  useEffect(() => {
    if (!classId || !term || !selectedLevel) {
      setSession(null);
      setSubjects([]);
      setSubjectId("");
      setStudents([]);
      setScores(new Map());
      setLearningAreas([]);
      setLearningAreaId("");
      setSkills([]);
      setSkillId("");
      setRatings(new Map());
      return;
    }
    let cancelled = false;
    setLoadingClass(true);
    setClassError(null);

    const rosterPromise = Promise.all([
      CloudAssessmentSessionService.getOrCreate(classId, term.id),
      CloudEnrollmentService.getRoster(term.id, classId),
      CloudStudentService.list(),
    ]);

    if (isScoredLevel) {
      Promise.all([rosterPromise, CloudSubjectService.listForLevel(selectedLevel.id), CloudScoreRecordService.getForTerm(term.id)])
        .then(async ([[sessionRow, roster, allStudents], subjectRows, allScores]) => {
          if (cancelled) return;
          setSession(sessionRow);
          setSubjects(subjectRows);
          setSubjectId((current) => (subjectRows.some((s) => s.id === current) ? current : subjectRows[0]?.id ?? ""));
          setLearningAreas([]);
          setLearningAreaId("");
          setSkills([]);
          setSkillId("");
          setRatings(new Map());

          const studentIds = roster.map((e) => e.student_id);
          const rosterStudents = allStudents
            .filter((s) => studentIds.includes(s.id))
            .sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)));
          if (cancelled) return;
          setStudents(rosterStudents);

          const scoreMap = new Map<string, { sba: number | null; exam: number | null }>();
          for (const rec of allScores) {
            if (!studentIds.includes(rec.student_id)) continue;
            scoreMap.set(`${rec.student_id}:${rec.subject_id}`, { sba: rec.sba_score, exam: rec.exam_score });
          }
          setScores(scoreMap);
        })
        .catch((err) => !cancelled && setClassError(err instanceof Error ? err.message : "Could not load this class."))
        .finally(() => !cancelled && setLoadingClass(false));
    } else if (isSkillLevel) {
      Promise.all([
        rosterPromise,
        CloudLearningAreaService.listForLevel(selectedLevel.id),
        CloudSkillAssessmentService.getForTerm(term.id),
      ])
        .then(async ([[sessionRow, roster, allStudents], areaRows, allRatings]) => {
          if (cancelled) return;
          setSession(sessionRow);
          setSubjects([]);
          setSubjectId("");
          setScores(new Map());
          setLearningAreas(areaRows);
          setLearningAreaId((current) => (areaRows.some((a) => a.id === current) ? current : areaRows[0]?.id ?? ""));

          const studentIds = roster.map((e) => e.student_id);
          const rosterStudents = allStudents
            .filter((s) => studentIds.includes(s.id))
            .sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)));
          if (cancelled) return;
          setStudents(rosterStudents);

          const ratingMap = new Map<string, { rating: SkillRating | null; comment: string | null }>();
          for (const rec of allRatings) {
            if (!studentIds.includes(rec.student_id)) continue;
            ratingMap.set(`${rec.student_id}:${rec.skill_id}`, { rating: rec.rating, comment: rec.comment });
          }
          setRatings(ratingMap);
        })
        .catch((err) => !cancelled && setClassError(err instanceof Error ? err.message : "Could not load this class."))
        .finally(() => !cancelled && setLoadingClass(false));
    } else {
      setLoadingClass(false);
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, term, selectedLevel, isScoredLevel, isSkillLevel]);

  // Skills cascade from the chosen learning area - loaded separately so
  // switching learning areas doesn't have to re-fetch the whole roster.
  useEffect(() => {
    if (!isSkillLevel || !selectedLevel || !learningAreaId) {
      setSkills([]);
      setSkillId("");
      return;
    }
    let cancelled = false;
    CloudSkillService.listForLevelAndArea(selectedLevel.id, learningAreaId)
      .then((rows) => {
        if (cancelled) return;
        setSkills(rows);
        setSkillId((current) => (rows.some((s) => s.id === current) ? current : rows[0]?.id ?? ""));
      })
      .catch((err) => !cancelled && setClassError(err instanceof Error ? err.message : "Could not load skills."));
    return () => {
      cancelled = true;
    };
  }, [isSkillLevel, selectedLevel, learningAreaId]);

  async function handleScoreBlur(studentId: string, field: "sba" | "exam", raw: string) {
    if (!term || !session || !subjectId) return;
    const key = `${studentId}:${subjectId}`;
    const value = raw.trim() === "" ? null : Number(raw);
    if (value !== null && (Number.isNaN(value) || value < 0 || value > 50)) {
      setClassError("Scores must be a number from 0 to 50.");
      return;
    }
    const previous = scores.get(key) ?? { sba: null, exam: null };
    if (previous[field] === value) return;

    setSavingKey(`${key}:${field}`);
    setClassError(null);
    try {
      const updated = await CloudScoreRecordService.upsertField(
        studentId,
        term.id,
        subjectId,
        field === "sba" ? "sbaScore" : "examScore",
        value,
        session.id
      );
      setScores((prev) => {
        const next = new Map(prev);
        next.set(key, { sba: updated.sba_score, exam: updated.exam_score });
        return next;
      });
    } catch (err) {
      setClassError(err instanceof Error ? err.message : "Could not save this score.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveSkillRating(studentId: string, rating: SkillRating | null, comment: string | null) {
    if (!term || !session || !skillId) return;
    const key = `${studentId}:${skillId}`;
    setSavingKey(`${key}:rating`);
    setClassError(null);
    try {
      const updated = await CloudSkillAssessmentService.upsertRating(
        studentId,
        term.id,
        skillId,
        rating,
        comment,
        session.id
      );
      setRatings((prev) => {
        const next = new Map(prev);
        next.set(key, { rating: updated.rating, comment: updated.comment });
        return next;
      });
    } catch (err) {
      setClassError(err instanceof Error ? err.message : "Could not save this rating.");
    } finally {
      setSavingKey(null);
    }
  }

  function handleRatingSelect(studentId: string, raw: string) {
    const key = `${studentId}:${skillId}`;
    const existing = ratings.get(key) ?? { rating: null, comment: null };
    const rating = (raw === "" ? null : raw) as SkillRating | null;
    if (existing.rating === rating) return;
    void saveSkillRating(studentId, rating, existing.comment);
  }

  function handleCommentBlur(studentId: string, raw: string) {
    const key = `${studentId}:${skillId}`;
    const existing = ratings.get(key) ?? { rating: null, comment: null };
    const comment = raw.trim() === "" ? null : raw.trim();
    if (existing.comment === comment) return;
    void saveSkillRating(studentId, existing.rating, comment);
  }

  async function handleStatusChange(newStatus: AssessmentSessionStatus) {
    if (!session) return;
    setStatusBusy(true);
    setClassError(null);
    try {
      const updated = await CloudAssessmentSessionService.changeStatus(session.id, session.status, newStatus);
      setSession(updated);
    } catch (err) {
      setClassError(err instanceof Error ? err.message : "Could not change the assessment status.");
    } finally {
      setStatusBusy(false);
    }
  }

  if (loadingContext) return <p className="text-muted">Loading…</p>;
  if (contextError) return <div className="alert alert-danger">{contextError}</div>;
  if (!term) {
    return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;
  }

  const editable = session?.status === "DRAFT";

  return (
    <div>
      <h1 className="h4 mb-1">Assessment entry</h1>
      <p className="text-muted mb-4">{term.term_name}</p>

      <div className="actrs-card p-3 mb-4">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label small">Class</label>
            <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {isSkillLevel ? (
            <>
              <div className="col-md-4">
                <label className="form-label small">Learning area</label>
                <select
                  className="form-select"
                  value={learningAreaId}
                  onChange={(e) => setLearningAreaId(e.target.value)}
                  disabled={learningAreas.length === 0}
                >
                  {learningAreas.length === 0 && <option value="">No learning areas for this level</option>}
                  {learningAreas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">Skill</label>
                <select
                  className="form-select"
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  disabled={skills.length === 0}
                >
                  {skills.length === 0 && <option value="">No skills</option>}
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.serial_number != null ? `${s.serial_number}. ` : ""}
                      {s.description}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="col-md-5">
              <label className="form-label small">Subject</label>
              <select
                className="form-select"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={!isScoredLevel || subjects.length === 0}
              >
                {subjects.length === 0 && <option value="">No subjects for this level</option>}
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {classId && isScoredLevel && (
        <>
          {classError && <div className="alert alert-danger">{classError}</div>}

          {session && (
            <div className="actrs-card p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Assessment status:</span>
                <span className={`badge ${STATUS_BADGE[session.status]}`}>{STATUS_LABEL[session.status]}</span>
              </div>
              <div className="d-flex gap-2">
                {CloudAssessmentSessionService.nextStatusOptions(session.status).map((next) => (
                  <button
                    key={next}
                    className={`btn btn-sm ${next === "DRAFT" ? "btn-outline-secondary" : "btn-primary"}`}
                    disabled={statusBusy}
                    onClick={() => handleStatusChange(next)}
                  >
                    {next === "DRAFT" ? "Reopen to draft" : `Mark as ${STATUS_LABEL[next]}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!editable && session && (
            <div className="alert alert-warning py-2 small">
              Scores are locked while this assessment is {STATUS_LABEL[session.status].toLowerCase()}. Reopen it to
              draft to make changes.
            </div>
          )}

          <div className="actrs-card p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th style={{ width: 140 }}>SBA (50)</th>
                    <th style={{ width: 140 }}>Exam (50)</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingClass && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loadingClass && students.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No students are currently enrolled in this class for this term.
                      </td>
                    </tr>
                  )}
                  {!loadingClass &&
                    students.map((student) => {
                      const key = `${student.id}:${subjectId}`;
                      const cell = scores.get(key) ?? { sba: null, exam: null };
                      return (
                        <tr key={student.id}>
                          <td className="fw-medium">{fullNameOf(student)}</td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              className="form-control form-control-sm"
                              defaultValue={cell.sba ?? ""}
                              key={`${key}:sba:${cell.sba}`}
                              disabled={!editable || !subjectId}
                              onBlur={(e) => handleScoreBlur(student.id, "sba", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={50}
                              className="form-control form-control-sm"
                              defaultValue={cell.exam ?? ""}
                              key={`${key}:exam:${cell.exam}`}
                              disabled={!editable || !subjectId}
                              onBlur={(e) => handleScoreBlur(student.id, "exam", e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          {savingKey && <p className="text-muted small mt-2 mb-0">Saving…</p>}
        </>
      )}

      {classId && isSkillLevel && (
        <>
          {classError && <div className="alert alert-danger">{classError}</div>}

          {session && (
            <div className="actrs-card p-3 mb-4 d-flex align-items-center justify-content-between flex-wrap gap-3">
              <div className="d-flex align-items-center gap-2">
                <span className="text-muted small">Assessment status:</span>
                <span className={`badge ${STATUS_BADGE[session.status]}`}>{STATUS_LABEL[session.status]}</span>
              </div>
              <div className="d-flex gap-2">
                {CloudAssessmentSessionService.nextStatusOptions(session.status).map((next) => (
                  <button
                    key={next}
                    className={`btn btn-sm ${next === "DRAFT" ? "btn-outline-secondary" : "btn-primary"}`}
                    disabled={statusBusy}
                    onClick={() => handleStatusChange(next)}
                  >
                    {next === "DRAFT" ? "Reopen to draft" : `Mark as ${STATUS_LABEL[next]}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!editable && session && (
            <div className="alert alert-warning py-2 small">
              Ratings are locked while this assessment is {STATUS_LABEL[session.status].toLowerCase()}. Reopen it to
              draft to make changes.
            </div>
          )}

          <div className="actrs-card p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th style={{ width: 220 }}>Rating</th>
                    <th>Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingClass && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loadingClass && students.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        No students are currently enrolled in this class for this term.
                      </td>
                    </tr>
                  )}
                  {!loadingClass && students.length > 0 && !skillId && (
                    <tr>
                      <td colSpan={3} className="text-center text-muted py-4">
                        Select a learning area and skill above to enter ratings.
                      </td>
                    </tr>
                  )}
                  {!loadingClass &&
                    skillId &&
                    students.map((student) => {
                      const key = `${student.id}:${skillId}`;
                      const cell = ratings.get(key) ?? { rating: null, comment: null };
                      return (
                        <tr key={student.id}>
                          <td className="fw-medium">{fullNameOf(student)}</td>
                          <td>
                            <select
                              className="form-select form-select-sm"
                              defaultValue={cell.rating ?? ""}
                              key={`${key}:rating:${cell.rating}`}
                              disabled={!editable}
                              onChange={(e) => handleRatingSelect(student.id, e.target.value)}
                            >
                              <option value="">Not rated</option>
                              <option value="G">G — Gold (exceeds expectation)</option>
                              <option value="S">S — Silver (meets expectation)</option>
                              <option value="B">B — Bronze (approaching expectation)</option>
                              <option value="X">X — Not assessed</option>
                              <option value="O">O — Absent</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              defaultValue={cell.comment ?? ""}
                              key={`${key}:comment:${cell.comment}`}
                              disabled={!editable}
                              onBlur={(e) => handleCommentBlur(student.id, e.target.value)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
          {savingKey && <p className="text-muted small mt-2 mb-0">Saving…</p>}
        </>
      )}
    </div>
  );
}
