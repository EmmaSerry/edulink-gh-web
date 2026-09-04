import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import { FormField } from "@components/FormField";
import type { Enrollment } from "@models/Enrollment";
import { getFullName, type Student } from "@models/Student";
import type { ReportRecord } from "@models/Report";
import { REMARKS_CATEGORY_LABELS, type RemarksCategory } from "@models/RemarksBank";
import { RemarksBankService } from "@services/RemarksBankService";
import { ReportRecordService } from "@services/ReportRecordService";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { Card } from "@components/Card";

interface Props {
  termId: number;
  levelId: number;
  sessionId: number;
  roster: Enrollment[];
  readOnly: boolean;
  performedBy: string;
  assessmentMode: "scored" | "skill-checklist";
  onSaved: () => void;
}

type ScoredField = "conductRemark" | "interestRemark" | "attitudeRemark" | "classTeacherRemark" | "headteacherRemark";
type KgField = "generalComment" | "areasForImprovement" | "teacherRecommendation";

const SCORED_FIELD_CATEGORY: Record<ScoredField, RemarksCategory> = {
  conductRemark: "CONDUCT",
  interestRemark: "INTEREST",
  attitudeRemark: "ATTITUDE",
  classTeacherRemark: "TEACHER_REMARKS",
  headteacherRemark: "HEADTEACHER_REMARKS",
};
const SCORED_FIELD_ORDER: ScoredField[] = [
  "conductRemark",
  "interestRemark",
  "attitudeRemark",
  "classTeacherRemark",
  "headteacherRemark",
];
const KG_FIELD_LABELS: Record<KgField, string> = {
  generalComment: "General Progress Comment",
  areasForImprovement: "Areas for Improvement",
  teacherRecommendation: "Teacher Recommendation",
};
const KG_FIELD_ORDER: KgField[] = ["generalComment", "areasForImprovement", "teacherRecommendation"];

const DEBOUNCE_MS = 700;

/** Module 10 - Teacher Remarks. Scored levels pick from the Remarks Bank
 *  (Phase 1) per category, with a free-text override always available;
 *  KG uses three free-text narrative fields only, per the NaCCA tool -
 *  no picklist, no scores. One student is edited at a time with
 *  Previous/Next navigation, since five remark fields per row would make
 *  a table-per-student layout unreadable. */
export function TeacherRemarksPanel({ termId, levelId, sessionId, roster, readOnly, performedBy, assessmentMode, onSaved }: Props) {
  void levelId;

  const studentIds = useMemo(() => roster.map((e) => e.studentId).sort((a, b) => a - b), [roster]);
  const studentIdsKey = studentIds.join(",");

  const students = useLiveQuery(async () => {
    const list = await db.students.bulkGet(studentIds);
    return list
      .filter((s): s is Student => !!s)
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentIdsKey]);

  const term = useLiveQuery(() => db.terms.get(termId), [termId]);
  const remarksBank = useLiveQuery(() => RemarksBankService.getAll(), []);
  const bankByCategory = useMemo(() => {
    const map = new Map<RemarksCategory, string[]>();
    for (const entry of remarksBank ?? []) {
      if (!entry.isActive) continue;
      const list = map.get(entry.category) ?? [];
      list.push(entry.text);
      map.set(entry.category, list);
    }
    return map;
  }, [remarksBank]);

  const recordsRef = useRef<Map<number, ReportRecord>>(new Map());
  const [recordsVersion, setRecordsVersion] = useState(0);
  const [ready, setReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingArgs = useRef<Map<string, { studentId: number; changes: Partial<ReportRecord> }>>(new Map());
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!students || students.length === 0) return;
      const relevantIds = new Set(students.map((s) => s.id!));
      const all = await ReportRecordService.getForTerm(termId);
      const map = new Map<number, ReportRecord>();
      for (const rec of all) {
        if (!relevantIds.has(rec.studentId)) continue;
        map.set(rec.studentId, rec);
      }
      if (!cancelled) {
        recordsRef.current = map;
        setRecordsVersion((v) => v + 1);
        setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [students, termId]);

  async function flushOne(key: string) {
    const args = pendingArgs.current.get(key);
    if (!args) return;
    timers.current.delete(key);
    pendingArgs.current.delete(key);
    try {
      await ReportRecordService.upsertFields(args.studentId, termId, args.changes, sessionId, performedBy);
      onSaved();
    } finally {
      setPendingCount((c) => Math.max(0, c - 1));
    }
  }

  useEffect(() => {
    return () => {
      for (const [key, timer] of timers.current) {
        clearTimeout(timer);
        void flushOne(key);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(
    studentId: number,
    field: ScoredField | KgField | "daysPresent" | "progression",
    value: string | number | undefined,
  ) {
    const prev = recordsRef.current.get(studentId) ?? ({ studentId, termId } as Partial<ReportRecord>);
    const next = { ...prev, [field]: value } as ReportRecord;
    recordsRef.current.set(studentId, next);
    setRecordsVersion((v) => v + 1);

    const key = `${studentId}:${field}`;
    const changes = { [field]: value } as Partial<ReportRecord>;
    pendingArgs.current.set(key, { studentId, changes });
    const existing = timers.current.get(key);
    if (existing) clearTimeout(existing);
    else setPendingCount((c) => c + 1);
    const timer = setTimeout(() => void flushOne(key), DEBOUNCE_MS);
    timers.current.set(key, timer);
  }

  const loading = !students || !remarksBank || !ready;
  if (loading) return <LoadingSpinner label="Loading remarks…" />;
  if (students!.length === 0) return null;

  const student = students![Math.min(selectedIndex, students!.length - 1)];
  const record = recordsRef.current.get(student.id!);
  void recordsVersion;

  // Reflects everything report generation actually requires from this
  // panel (see ReportDataService.validateReportPrerequisites) - not just
  // the main remark - so the checkmark genuinely means "ready to
  // generate", not just "started".
  const isComplete = (s: Student) => {
    const rec = recordsRef.current.get(s.id!);
    if (!rec) return false;
    const hasMainRemark =
      assessmentMode === "skill-checklist" ? !!rec.generalComment?.trim() : !!rec.classTeacherRemark?.trim();
    const hasAttendance = rec.daysPresent !== undefined && rec.daysPresent !== null;
    const hasProgression = !!rec.progression?.trim();
    return hasMainRemark && hasAttendance && hasProgression;
  };

  return (
    <div className="row g-3">
      <div className="col-12 col-md-4 col-lg-3">
        <Card padded={false} className="overflow-hidden">
          <div className="p-2 border-bottom small text-muted d-flex justify-content-between">
            <span>Students</span>
            <span>{students!.filter(isComplete).length} / {students!.length} started</span>
          </div>
          <div style={{ maxHeight: 480, overflowY: "auto" }}>
            {students!.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`w-100 text-start btn btn-sm rounded-0 border-0 d-flex justify-content-between align-items-center ${
                  i === selectedIndex ? "btn-primary" : "btn-light"
                }`}
                onClick={() => setSelectedIndex(i)}
              >
                <span className="text-truncate">{getFullName(s)}</span>
                {isComplete(s) && <i className={`bi bi-check-circle-fill ${i === selectedIndex ? "text-white" : "text-success"}`} />}
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="col-12 col-md-8 col-lg-9">
        <Card>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h6 mb-0">{getFullName(student)}</h2>
            <div className="d-flex gap-2 align-items-center">
              {pendingCount > 0 ? (
                <span className="text-warning small"><i className="bi bi-cloud-arrow-up me-1" />Saving…</span>
              ) : (
                <span className="text-success small"><i className="bi bi-cloud-check me-1" />Saved</span>
              )}
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={selectedIndex === 0}
                onClick={() => setSelectedIndex((i) => Math.max(0, i - 1))}
              >
                <i className="bi bi-chevron-left" /> Previous
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                disabled={selectedIndex >= students!.length - 1}
                onClick={() => setSelectedIndex((i) => Math.min(students!.length - 1, i + 1))}
              >
                Next <i className="bi bi-chevron-right" />
              </button>
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 col-sm-6">
              <FormField
                label="Days present"
                hint={term ? `Out of ${term.totalSchoolDays} school day(s) this term` : "Total school days set under Academic Years/Terms"}
              >
                <input
                  type="number"
                  min={0}
                  max={term?.totalSchoolDays}
                  className="form-control form-control-sm"
                  disabled={readOnly}
                  value={record?.daysPresent ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setField(student.id!, "daysPresent", raw === "" ? undefined : Number(raw));
                  }}
                />
              </FormField>
            </div>
            <div className="col-12 col-sm-6">
              <FormField label={assessmentMode === "skill-checklist" ? "Progression" : "Promotion decision"}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  disabled={readOnly}
                  placeholder={
                    assessmentMode === "skill-checklist"
                      ? "e.g. Promoted to Kindergarten 2"
                      : "e.g. Promoted to Basic 4"
                  }
                  value={record?.progression ?? ""}
                  onChange={(e) => setField(student.id!, "progression", e.target.value)}
                />
              </FormField>
            </div>
          </div>

          {assessmentMode === "scored"
            ? SCORED_FIELD_ORDER.map((field) => (
                <RemarkField
                  key={field}
                  label={REMARKS_CATEGORY_LABELS[SCORED_FIELD_CATEGORY[field]]}
                  value={(record?.[field] as string) ?? ""}
                  bankOptions={bankByCategory.get(SCORED_FIELD_CATEGORY[field]) ?? []}
                  readOnly={readOnly}
                  onChange={(value) => setField(student.id!, field, value)}
                />
              ))
            : KG_FIELD_ORDER.map((field) => (
                <RemarkField
                  key={field}
                  label={KG_FIELD_LABELS[field]}
                  value={(record?.[field] as string) ?? ""}
                  bankOptions={[]}
                  readOnly={readOnly}
                  onChange={(value) => setField(student.id!, field, value)}
                />
              ))}
        </Card>
      </div>
    </div>
  );
}

function RemarkField({
  label,
  value,
  bankOptions,
  readOnly,
  onChange,
}: {
  label: string;
  value: string;
  bankOptions: string[];
  readOnly: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mb-3">
      <label className="form-label small fw-semibold">{label}</label>
      {bankOptions.length > 0 && (
        <select
          className="form-select form-select-sm mb-1"
          disabled={readOnly}
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        >
          <option value="">Insert from Remarks Bank…</option>
          {bankOptions.map((text) => (
            <option key={text} value={text}>
              {text}
            </option>
          ))}
        </select>
      )}
      <textarea
        className="form-control form-control-sm"
        rows={2}
        disabled={readOnly}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={bankOptions.length > 0 ? "Pick from the bank above, or type your own remark" : "Type a remark…"}
      />
    </div>
  );
}
