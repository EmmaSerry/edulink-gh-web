import { useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudReportRecordService } from "@services/cloud/ReportRecordService";
import { CloudAssessmentSessionService } from "@services/cloud/AssessmentSessionService";
import { KG_GENERAL_COMMENT_BANK } from "@/constants/kgCommentBank";
import type { TermRow, ClassRow, LevelRow, StudentRow, ReportRecordRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

type ScoredTextField =
  | "conduct_remark"
  | "interest_remark"
  | "attitude_remark"
  | "class_teacher_remark"
  | "headteacher_remark"
  | "progression";

type KgTextField = "general_comment" | "class_teacher_name" | "head_teacher_name" | "progression";

/**
 * Attendance, plus the free-text fields a report card needs alongside
 * either the subject scores (scored levels) or the skill ratings (KG) -
 * see ReportDataService.validateReportPrerequisites, which checks
 * these are filled before a report can be generated.
 *
 * Two distinct field sets share this one screen because the two
 * report layouts do: a scored level's report shows Conduct/Interest/
 * Attitude/Class Teacher's/Headteacher's remarks plus a promotion
 * decision, while KG's official form has exactly one "GENERAL
 * COMMENTS" box (see ReportSnapshotKgRemarks) plus its own teacher/
 * headteacher name lines and, for KG2, a "PROGRESSION:" line. Both
 * field sets live on the same report_records row per student/term
 * (edulink_gh_phase0f_remarks_templates.sql) - only which fields this
 * screen shows and saves changes with the level's assessment mode.
 */
export function CloudReportRemarksEntry() {
  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<Map<string, ReportRecordRow>>(new Map());
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { profile } = useCloudAuth();

  useEffect(() => {
    let cancelled = false;
    Promise.all([CloudTermService.getActive(profile?.school_id), CloudClassService.list(undefined, profile?.school_id), CloudLevelService.list(profile?.school_id)])
      .then(([activeTerm, classRows, levelRows]) => {
        if (cancelled) return;
        setTerm(activeTerm);
        setClasses(CloudClassService.forRole(classRows, profile));
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
      setSessionId(null);
      setStudents([]);
      setRecords(new Map());
      return;
    }
    let cancelled = false;
    setLoadingClass(true);
    setClassError(null);
    Promise.all([
      CloudAssessmentSessionService.getOrCreate(classId, term.id),
      CloudEnrollmentService.getRoster(term.id, classId),
      CloudReportRecordService.getForTerm(term.id),
      CloudStudentService.list(),
    ])
      .then(([session, roster, reportRows, allStudents]) => {
        if (cancelled) return;
        setSessionId(session.id);
        const studentIds = roster.map((e) => e.student_id);
        setStudents(
          allStudents
            .filter((s) => studentIds.includes(s.id))
            .sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)))
        );
        const map = new Map<string, ReportRecordRow>();
        for (const rec of reportRows) {
          if (studentIds.includes(rec.student_id)) map.set(rec.student_id, rec);
        }
        setRecords(map);
      })
      .catch((err) => !cancelled && setClassError(err instanceof Error ? err.message : "Could not load this class."))
      .finally(() => !cancelled && setLoadingClass(false));
    return () => {
      cancelled = true;
    };
  }, [classId, term, selectedLevel]);

  async function saveField(studentId: string, field: ScoredTextField | KgTextField | "days_present", raw: string) {
    if (!term || !sessionId) return;
    const key = `${studentId}:${field}`;
    let value: string | number | null;
    if (field === "days_present") {
      value = raw.trim() === "" ? null : Number(raw);
      if (value !== null && (Number.isNaN(value) || value < 0)) {
        setClassError("Days present must be a non-negative number.");
        return;
      }
    } else {
      value = raw.trim() === "" ? null : raw;
    }

    setSavingKey(key);
    setClassError(null);
    try {
      const updated = await CloudReportRecordService.upsertFields(studentId, term.id, { [field]: value }, sessionId);
      setRecords((prev) => {
        const next = new Map(prev);
        next.set(studentId, updated);
        return next;
      });
    } catch (err) {
      setClassError(err instanceof Error ? err.message : "Could not save this field.");
    } finally {
      setSavingKey(null);
    }
  }

  if (loadingContext) return <p className="text-muted">Loading…</p>;
  if (contextError) return <div className="alert alert-danger">{contextError}</div>;
  if (!term) return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;

  const scoredTextFields: Array<{ key: ScoredTextField; label: string; placeholder?: string }> = [
    { key: "class_teacher_remark", label: "Class teacher's remark" },
    { key: "conduct_remark", label: "Conduct" },
    { key: "interest_remark", label: "Interest" },
    { key: "attitude_remark", label: "Attitude" },
    { key: "headteacher_remark", label: "Headteacher's remark" },
    { key: "progression", label: "Promoted to", placeholder: "e.g. Basic 6" },
  ];

  return (
    <div>
      <h1 className="h4 mb-1">Remarks &amp; attendance</h1>
      <p className="text-muted mb-4">{term.term_name}</p>

      <div className="actrs-card p-3 mb-4">
        <label className="form-label small">Class</label>
        <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)} style={{ maxWidth: 420 }}>
          <option value="">Select a class…</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {classError && <div className="alert alert-danger">{classError}</div>}

      {classId && isScoredLevel && (
        <div className="actrs-card p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Student</th>
                  <th style={{ width: 110 }}>Days present</th>
                  {scoredTextFields.map((f) => (
                    <th key={f.key} style={{ minWidth: 180 }}>
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingClass && (
                  <tr>
                    <td colSpan={2 + scoredTextFields.length} className="text-center text-muted py-4">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingClass && students.length === 0 && (
                  <tr>
                    <td colSpan={2 + scoredTextFields.length} className="text-center text-muted py-4">
                      No students are currently enrolled in this class for this term.
                    </td>
                  </tr>
                )}
                {!loadingClass &&
                  students.map((student) => {
                    const record = records.get(student.id);
                    return (
                      <tr key={student.id}>
                        <td className="fw-medium">{fullNameOf(student)}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm"
                            defaultValue={record?.days_present ?? ""}
                            key={`${student.id}:days:${record?.days_present}`}
                            onBlur={(e) => saveField(student.id, "days_present", e.target.value)}
                          />
                        </td>
                        {scoredTextFields.map((f) => (
                          <td key={f.key}>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              placeholder={f.placeholder}
                              defaultValue={record?.[f.key] ?? ""}
                              key={`${student.id}:${f.key}:${record?.[f.key]}`}
                              onBlur={(e) => saveField(student.id, f.key, e.target.value)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {classId && isSkillLevel && (
        <div className="actrs-card p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Student</th>
                  <th style={{ width: 100 }}>Days present</th>
                  <th style={{ minWidth: 320 }}>General comments</th>
                  <th style={{ minWidth: 170 }}>Class teacher's name</th>
                  <th style={{ minWidth: 170 }}>Headteacher's name</th>
                  <th style={{ minWidth: 150 }}>Progression</th>
                </tr>
              </thead>
              <tbody>
                {loadingClass && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingClass && students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No students are currently enrolled in this class for this term.
                    </td>
                  </tr>
                )}
                {!loadingClass &&
                  students.map((student) => {
                    const record = records.get(student.id);
                    return (
                      <tr key={student.id}>
                        <td className="fw-medium">{fullNameOf(student)}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm"
                            defaultValue={record?.days_present ?? ""}
                            key={`${student.id}:days:${record?.days_present}`}
                            onBlur={(e) => saveField(student.id, "days_present", e.target.value)}
                          />
                        </td>
                        <td style={{ minWidth: 320 }}>
                          <select
                            className="form-select form-select-sm mb-1"
                            defaultValue=""
                            onChange={(e) => {
                              if (!e.target.value) return;
                              const textarea = document.getElementById(
                                `general-comment-${student.id}`
                              ) as HTMLTextAreaElement | null;
                              if (textarea) {
                                textarea.value = e.target.value;
                                saveField(student.id, "general_comment", e.target.value);
                              }
                              e.target.value = "";
                            }}
                          >
                            <option value="">Quick-fill a comment…</option>
                            {KG_GENERAL_COMMENT_BANK.map((phrase) => (
                              <option key={phrase} value={phrase}>
                                {phrase}
                              </option>
                            ))}
                          </select>
                          <textarea
                            id={`general-comment-${student.id}`}
                            className="form-control form-control-sm"
                            rows={2}
                            placeholder="General comments on the learner's progress this term…"
                            defaultValue={record?.general_comment ?? ""}
                            key={`${student.id}:general_comment:${record?.general_comment}`}
                            onBlur={(e) => saveField(student.id, "general_comment", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            defaultValue={record?.class_teacher_name ?? ""}
                            key={`${student.id}:class_teacher_name:${record?.class_teacher_name}`}
                            onBlur={(e) => saveField(student.id, "class_teacher_name", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            defaultValue={record?.head_teacher_name ?? ""}
                            key={`${student.id}:head_teacher_name:${record?.head_teacher_name}`}
                            onBlur={(e) => saveField(student.id, "head_teacher_name", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. KG2"
                            defaultValue={record?.progression ?? ""}
                            key={`${student.id}:progression:${record?.progression}`}
                            onBlur={(e) => saveField(student.id, "progression", e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {savingKey && <p className="text-muted small mt-2 mb-0">Saving…</p>}
    </div>
  );
}
