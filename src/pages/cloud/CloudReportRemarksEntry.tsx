import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudReportRecordService } from "@services/cloud/ReportRecordService";
import { CloudAssessmentSessionService } from "@services/cloud/AssessmentSessionService";
import { KG_GENERAL_COMMENT_BANK } from "@/constants/kgCommentBank";
import { RemarkPicker } from "@/components/RemarkPicker";
import type { TermRow, ClassRow, LevelRow, StudentRow, ReportRecordRow, SchoolRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

interface ScoredDraft {
  days_present: string;
  conduct_remark: string;
  interest_remark: string;
  attitude_remark: string;
  class_teacher_remark: string;
  headteacher_remark: string;
  progression: string;
}

interface KgDraft {
  days_present: string;
  general_comment: string;
  class_teacher_name: string;
  head_teacher_name: string;
  progression: string;
}

function scoredDraftFromRecord(record: ReportRecordRow | undefined): ScoredDraft {
  return {
    days_present: record?.days_present != null ? String(record.days_present) : "",
    conduct_remark: record?.conduct_remark ?? "",
    interest_remark: record?.interest_remark ?? "",
    attitude_remark: record?.attitude_remark ?? "",
    class_teacher_remark: record?.class_teacher_remark ?? "",
    headteacher_remark: record?.headteacher_remark ?? "",
    progression: record?.progression ?? "",
  };
}

/** Class teacher's/headteacher's name fields default from the class's
 *  assigned teacher (Settings -> Classes) and the school's configured
 *  headteacher (Settings -> School profile) rather than starting blank
 *  - so unless a specific student's report needs a different signatory,
 *  nothing here needs retyping at all, only confirming. This is what
 *  was behind "why does the system demand these names" - it wasn't a
 *  requirement, they just weren't pre-filled from where they're
 *  already configured. */
function kgDraftFromRecord(record: ReportRecordRow | undefined, cls: ClassRow | null, school: SchoolRow | null): KgDraft {
  return {
    days_present: record?.days_present != null ? String(record.days_present) : "",
    general_comment: record?.general_comment ?? "",
    class_teacher_name: record?.class_teacher_name ?? cls?.class_teacher_name ?? "",
    head_teacher_name: record?.head_teacher_name ?? school?.head_teacher_name ?? "",
    progression: record?.progression ?? "",
  };
}

type SaveState = "idle" | "saving" | "saved" | "error";

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  return (
    <div className="d-flex align-items-center gap-2">
      <button type="button" className="btn btn-primary btn-sm" disabled={state === "saving"} onClick={onClick}>
        {state === "saving" ? "Saving…" : "Save"}
      </button>
      {state === "saved" && <span className="text-success small">Saved</span>}
      {state === "error" && <span className="text-danger small">Could not save</span>}
    </div>
  );
}

type Broadcast<D> = { version: number; draft: D } | null;

/** Validated database changes for a scored-level draft, or null if the days-present box is invalid. */
function scoredChanges(d: ScoredDraft): Record<string, string | number | null> | null {
  const daysPresentValue = d.days_present.trim() === "" ? null : Number(d.days_present);
  if (daysPresentValue !== null && (Number.isNaN(daysPresentValue) || daysPresentValue < 0)) return null;
  return {
    days_present: daysPresentValue,
    conduct_remark: d.conduct_remark.trim() === "" ? null : d.conduct_remark,
    interest_remark: d.interest_remark.trim() === "" ? null : d.interest_remark,
    attitude_remark: d.attitude_remark.trim() === "" ? null : d.attitude_remark,
    class_teacher_remark: d.class_teacher_remark.trim() === "" ? null : d.class_teacher_remark,
    headteacher_remark: d.headteacher_remark.trim() === "" ? null : d.headteacher_remark,
    progression: d.progression.trim() === "" ? null : d.progression,
  };
}

/** Same for a KG draft. */
function kgChanges(d: KgDraft): Record<string, string | number | null> | null {
  const daysPresentValue = d.days_present.trim() === "" ? null : Number(d.days_present);
  if (daysPresentValue !== null && (Number.isNaN(daysPresentValue) || daysPresentValue < 0)) return null;
  return {
    days_present: daysPresentValue,
    general_comment: d.general_comment.trim() === "" ? null : d.general_comment,
    class_teacher_name: d.class_teacher_name.trim() === "" ? null : d.class_teacher_name,
    head_teacher_name: d.head_teacher_name.trim() === "" ? null : d.head_teacher_name,
    progression: d.progression.trim() === "" ? null : d.progression,
  };
}

function ScoredRow({
  student,
  record,
  isSource,
  broadcast,
  onDraft,
  onSave,
}: {
  student: StudentRow;
  record: ReportRecordRow | undefined;
  isSource: boolean;
  broadcast: Broadcast<ScoredDraft>;
  onDraft: (studentId: string, draft: ScoredDraft) => void;
  onSave: (studentId: string, changes: Record<string, string | number | null>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ScoredDraft>(() => scoredDraftFromRecord(record));
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    setDraft(scoredDraftFromRecord(record));
    setSaveState("idle");
  }, [record]);

  // Tell the page what this learner's current entries are (used by "copy to everyone" and "Save all").
  useEffect(() => {
    onDraft(student.id, draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // "Use one learner's entries for everyone": non-source learners take over the copied entries.
  useEffect(() => {
    if (!broadcast || isSource) return;
    setDraft(broadcast.draft);
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast?.version]);

  function set<K extends keyof ScoredDraft>(key: K, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaveState("idle");
  }

  async function handleSave() {
    const changes = scoredChanges(draft);
    if (!changes) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    try {
      await onSave(student.id, changes);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <tr>
      <td className="fw-medium">{fullNameOf(student)}</td>
      <td>
        <input
          type="number"
          min={0}
          className="form-control form-control-sm"
          value={draft.days_present}
          onChange={(e) => set("days_present", e.target.value)}
        />
      </td>
      <td style={{ minWidth: 270, verticalAlign: "top" }}>
        <RemarkPicker kind="class_teacher" value={draft.class_teacher_remark} onChange={(v) => set("class_teacher_remark", v)} />
      </td>
      <td style={{ minWidth: 270, verticalAlign: "top" }}>
        <RemarkPicker kind="conduct" value={draft.conduct_remark} onChange={(v) => set("conduct_remark", v)} />
      </td>
      <td style={{ minWidth: 270, verticalAlign: "top" }}>
        <RemarkPicker kind="interest" value={draft.interest_remark} onChange={(v) => set("interest_remark", v)} />
      </td>
      <td style={{ minWidth: 270, verticalAlign: "top" }}>
        <RemarkPicker kind="attitude" value={draft.attitude_remark} onChange={(v) => set("attitude_remark", v)} />
      </td>
      <td style={{ minWidth: 270, verticalAlign: "top" }}>
        <RemarkPicker kind="headteacher" value={draft.headteacher_remark} onChange={(v) => set("headteacher_remark", v)} />
      </td>
      <td>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="e.g. Basic 6"
          value={draft.progression}
          onChange={(e) => set("progression", e.target.value)}
        />
      </td>
      <td>
        <SaveButton state={saveState} onClick={handleSave} />
      </td>
    </tr>
  );
}

function KgRow({
  student,
  record,
  isSource,
  broadcast,
  onDraft,
  cls,
  school,
  onSave,
}: {
  student: StudentRow;
  record: ReportRecordRow | undefined;
  isSource: boolean;
  broadcast: Broadcast<KgDraft>;
  onDraft: (studentId: string, draft: KgDraft) => void;
  cls: ClassRow | null;
  school: SchoolRow | null;
  onSave: (studentId: string, changes: Record<string, string | number | null>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<KgDraft>(() => kgDraftFromRecord(record, cls, school));
  const [saveState, setSaveState] = useState<SaveState>("idle");

  useEffect(() => {
    setDraft(kgDraftFromRecord(record, cls, school));
    setSaveState("idle");
  }, [record, cls, school]);

  // Tell the page what this learner's current entries are (used by "copy to everyone" and "Save all").
  useEffect(() => {
    onDraft(student.id, draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // "Use one learner's entries for everyone": non-source learners take over the copied entries.
  useEffect(() => {
    if (!broadcast || isSource) return;
    setDraft(broadcast.draft);
    setSaveState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast?.version]);

  async function handleSave() {
    const changes = kgChanges(draft);
    if (!changes) {
      setSaveState("error");
      return;
    }
    setSaveState("saving");
    try {
      await onSave(student.id, changes);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  return (
    <tr>
      <td className="fw-medium">{fullNameOf(student)}</td>
      <td>
        <input
          type="number"
          min={0}
          className="form-control form-control-sm"
          value={draft.days_present}
          onChange={(e) => {
            setDraft((d) => ({ ...d, days_present: e.target.value }));
            setSaveState("idle");
          }}
        />
      </td>
      <td style={{ minWidth: 320 }}>
        <select
          className="form-select form-select-sm mb-1"
          value=""
          onChange={(e) => {
            if (!e.target.value) return;
            setDraft((d) => ({ ...d, general_comment: e.target.value }));
            setSaveState("idle");
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
          className="form-control form-control-sm"
          rows={2}
          placeholder="General comments on the learner's progress this term…"
          value={draft.general_comment}
          onChange={(e) => {
            setDraft((d) => ({ ...d, general_comment: e.target.value }));
            setSaveState("idle");
          }}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-control form-control-sm"
          value={draft.class_teacher_name}
          onChange={(e) => {
            setDraft((d) => ({ ...d, class_teacher_name: e.target.value }));
            setSaveState("idle");
          }}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-control form-control-sm"
          value={draft.head_teacher_name}
          onChange={(e) => {
            setDraft((d) => ({ ...d, head_teacher_name: e.target.value }));
            setSaveState("idle");
          }}
        />
      </td>
      <td>
        <input
          type="text"
          className="form-control form-control-sm"
          placeholder="e.g. KG2"
          value={draft.progression}
          onChange={(e) => {
            setDraft((d) => ({ ...d, progression: e.target.value }));
            setSaveState("idle");
          }}
        />
      </td>
      <td>
        <SaveButton state={saveState} onClick={handleSave} />
      </td>
    </tr>
  );
}

/**
 * Attendance, plus the free-text fields a report card needs alongside
 * either the subject scores (scored levels) or the skill ratings (KG) -
 * see ReportDataService.validateReportPrerequisites, which checks
 * these are filled before a report can be generated.
 *
 * Each row is its own local draft (see ScoredRow/KgRow above) with an
 * explicit Save button, rather than saving silently on blur - a
 * teacher filling in a long list of students wants to know each row
 * actually went through, not just trust that clicking away worked.
 * Both field sets - a scored level's Conduct/Interest/Attitude/Class
 * Teacher's/Headteacher's remarks plus a promotion decision, and KG's
 * single General Comments box plus its own teacher/headteacher name
 * lines - write to the same report_records row per student/term
 * (edulink_gh_phase0f_remarks_templates.sql). Every scored-level remark
 * field now offers the same "quick-fill from a comment bank, or just
 * type your own" pattern KG's General comments box already had - see
 * scoredRemarkCommentBanks.ts.
 */
export function CloudReportRemarksEntry() {
  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [records, setRecords] = useState<Map<string, ReportRecordRow>>(new Map());
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);

  const { profile } = useCloudAuth();

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      CloudTermService.getActive(profile?.school_id),
      CloudClassService.list(undefined, profile?.school_id),
      CloudLevelService.list(profile?.school_id),
      CloudSchoolService.getProfile(),
    ])
      .then(([activeTerm, classRows, levelRows, schoolRow]) => {
        if (cancelled) return;
        setTerm(activeTerm);
        setClasses(CloudClassService.forRole(classRows, profile));
        setLevels(levelRows);
        setSchool(schoolRow);
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

  // ---- "Use one learner's entries for everyone" + "Save all" ----
  const [applyAll, setApplyAll] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [broadcast, setBroadcast] = useState<{ version: number; draft: ScoredDraft | KgDraft } | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [saveAllMsg, setSaveAllMsg] = useState<string | null>(null);
  const draftsRef = useRef(new Map<string, ScoredDraft | KgDraft>());
  const versionRef = useRef(0);
  const applyAllRef = useRef(false);
  const sourceRef = useRef("");

  useEffect(() => {
    // New class selected: start fresh.
    applyAllRef.current = false;
    sourceRef.current = "";
    draftsRef.current = new Map();
    setApplyAll(false);
    setSourceId("");
    setBroadcast(null);
    setSaveAllMsg(null);
  }, [classId]);

  const handleDraft = useCallback((studentId: string, draft: ScoredDraft | KgDraft) => {
    draftsRef.current.set(studentId, draft);
    if (applyAllRef.current && studentId === sourceRef.current) {
      versionRef.current += 1;
      setBroadcast({ version: versionRef.current, draft });
    }
  }, []);

  function pushFrom(id: string) {
    const d = draftsRef.current.get(id);
    if (!d) return;
    versionRef.current += 1;
    setBroadcast({ version: versionRef.current, draft: d });
  }

  function toggleApplyAll(checked: boolean) {
    applyAllRef.current = checked;
    setApplyAll(checked);
    setSaveAllMsg(null);
    if (checked) {
      const id = sourceRef.current || students[0]?.id || "";
      sourceRef.current = id;
      setSourceId(id);
      pushFrom(id);
    }
  }

  function changeSource(id: string) {
    sourceRef.current = id;
    setSourceId(id);
    if (applyAllRef.current) pushFrom(id);
  }

  async function saveAll() {
    if (students.length === 0) return;
    setSavingAll(true);
    setSaveAllMsg(null);
    let saved = 0;
    let failed = 0;
    for (const s of students) {
      const d = draftsRef.current.get(s.id);
      if (!d) continue;
      const changes = isScoredLevel ? scoredChanges(d as ScoredDraft) : kgChanges(d as KgDraft);
      if (!changes) {
        failed += 1;
        continue;
      }
      try {
        await saveRow(s.id, changes);
        saved += 1;
      } catch {
        failed += 1;
      }
    }
    setSavingAll(false);
    setSaveAllMsg(`${saved} learner(s) saved${failed ? `, ${failed} could not be saved (check days present)` : ""}.`);
  }

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
    // Load only this class: the roster first (small), then just those
    // learners and their report rows - not the whole school.
    Promise.all([
      CloudAssessmentSessionService.getOrCreate(classId, term.id),
      CloudEnrollmentService.getRoster(term.id, classId),
    ])
      .then(async ([session, roster]) => {
        const ids = roster.map((e) => e.student_id);
        const [reportRows, allStudents] = await Promise.all([
          CloudReportRecordService.getForStudents(term.id, ids),
          CloudStudentService.listByIds(ids),
        ]);
        return [session, roster, reportRows, allStudents] as const;
      })
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

  async function saveRow(studentId: string, changes: Record<string, string | number | null>) {
    if (!term || !sessionId) return;
    const updated = await CloudReportRecordService.upsertFields(studentId, term.id, changes, sessionId);
    setRecords((prev) => {
      const next = new Map(prev);
      next.set(studentId, updated);
      return next;
    });
  }

  if (loadingContext) return <p className="text-muted">Loading…</p>;
  if (contextError) return <div className="alert alert-danger">{contextError}</div>;
  if (!term) return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;

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

      {classId && (isScoredLevel || isSkillLevel) && !loadingClass && students.length > 0 && (
        <div className="actrs-card p-3 mb-3">
          <div className="form-check">
            <input
              id="apply-all-learners"
              type="checkbox"
              className="form-check-input"
              checked={applyAll}
              onChange={(e) => toggleApplyAll(e.target.checked)}
            />
            <label htmlFor="apply-all-learners" className="form-check-label fw-medium">
              Use one learner's entries for every learner in this class
            </label>
          </div>
          {applyAll && (
            <div className="mt-2">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="small">Copy from:</span>
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 280 }}
                  value={sourceId}
                  onChange={(e) => changeSource(e.target.value)}
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {fullNameOf(s)}
                    </option>
                  ))}
                </select>
              </div>
              <p className="small text-muted mb-0 mt-1">
                Whatever you enter for this learner (attendance, remarks and everything else) is copied to all the
                others. Then change the few learners who differ - their changes stay until you edit the copied
                learner again. Nothing is saved until you press Save.
              </p>
            </div>
          )}
          <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={savingAll} onClick={saveAll}>
              {savingAll ? "Saving all learners…" : "Save all learners"}
            </button>
            {saveAllMsg && <span className="small text-muted">{saveAllMsg}</span>}
          </div>
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
                  <th style={{ minWidth: 270 }}>Class teacher's remark</th>
                  <th style={{ minWidth: 270 }}>Conduct</th>
                  <th style={{ minWidth: 270 }}>Interest</th>
                  <th style={{ minWidth: 270 }}>Attitude</th>
                  <th style={{ minWidth: 270 }}>Headteacher's remark</th>
                  <th style={{ minWidth: 150 }}>Promoted to</th>
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {loadingClass && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingClass && students.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted py-4">
                      No students are currently enrolled in this class for this term.
                    </td>
                  </tr>
                )}
                {!loadingClass &&
                  students.map((student) => (
                    <ScoredRow key={student.id} student={student} record={records.get(student.id)} isSource={applyAll && student.id === sourceId} broadcast={broadcast as { version: number; draft: ScoredDraft } | null} onDraft={handleDraft as (id: string, d: ScoredDraft) => void} onSave={saveRow} />
                  ))}
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
                  <th style={{ width: 120 }} />
                </tr>
              </thead>
              <tbody>
                {loadingClass && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loadingClass && students.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-muted py-4">
                      No students are currently enrolled in this class for this term.
                    </td>
                  </tr>
                )}
                {!loadingClass &&
                  students.map((student) => (
                    <KgRow
                      key={student.id}
                      student={student}
                      record={records.get(student.id)} isSource={applyAll && student.id === sourceId} broadcast={broadcast as { version: number; draft: KgDraft } | null} onDraft={handleDraft as (id: string, d: KgDraft) => void}
                      cls={selectedClass}
                      school={school}
                      onSave={saveRow}
                    />
                  ))}
              </tbody>
            </table>
          </div>
          {selectedClass && !selectedClass.class_teacher_name && (
            <p className="text-muted small p-3 mb-0 border-top">
              No class teacher is assigned to {selectedClass.name} yet - set one under Settings → Classes and it'll
              fill in here automatically for every student. Same for the headteacher's name, under Settings → School
              profile.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
