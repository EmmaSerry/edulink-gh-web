import { useEffect, useMemo, useState } from "react";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudReportRecordService } from "@services/cloud/ReportRecordService";
import { CloudAssessmentSessionService } from "@services/cloud/AssessmentSessionService";
import type { TermRow, ClassRow, LevelRow, StudentRow, ReportRecordRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

type TextField =
  | "conduct_remark"
  | "interest_remark"
  | "attitude_remark"
  | "class_teacher_remark"
  | "headteacher_remark"
  | "progression";

/**
 * Attendance, conduct/interest/attitude remarks, and the promotion
 * decision - the non-score fields a report card needs alongside the
 * subject scores from Assessment Entry (see
 * ReportDataService.validateReportPrerequisites, which checks these
 * are filled before a report can be generated). Scoped to scored
 * levels for now, same reasoning as Assessment Entry - KG uses
 * different fields entirely (a General Progress Comment, not a
 * Class Teacher's Remark) and gets its own screen later.
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

  useEffect(() => {
    if (!classId || !term || !isScoredLevel) {
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
  }, [classId, term, isScoredLevel]);

  async function saveField(studentId: string, field: TextField | "days_present", raw: string) {
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

  const textFields: Array<{ key: TextField; label: string; placeholder?: string }> = [
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

      {classId && selectedLevel && !isScoredLevel && (
        <div className="alert alert-info">
          {selectedLevel.name} uses KG's General Progress Comment fields rather than these - that screen isn't built
          yet.
        </div>
      )}

      {classError && <div className="alert alert-danger">{classError}</div>}

      {classId && isScoredLevel && (
        <div className="actrs-card p-0">
          <div className="table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Student</th>
                  <th style={{ width: 110 }}>Days present</th>
                  {textFields.map((f) => (
                    <th key={f.key} style={{ minWidth: 180 }}>
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingClass && (
                  <tr>
                    <td colSpan={2 + textFields.length} className="text-center text-muted py-4">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingClass && students.length === 0 && (
                  <tr>
                    <td colSpan={2 + textFields.length} className="text-center text-muted py-4">
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
                        {textFields.map((f) => (
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
      {savingKey && <p className="text-muted small mt-2 mb-0">Saving…</p>}
    </div>
  );
}
