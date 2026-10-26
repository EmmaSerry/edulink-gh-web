import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudStudentService } from "@services/cloud/StudentService";
import {
  CloudDailyAttendanceService,
  todayISO,
  type AttendanceStatus,
  type AttendanceSummaryRow,
  type SchoolDayRow,
} from "@services/cloud/DailyAttendanceService";
import type { TermRow, ClassRow, StudentRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

const STATUSES: { key: AttendanceStatus; label: string; short: string; cls: string }[] = [
  { key: "present", label: "Present", short: "P", cls: "success" },
  { key: "late", label: "Late", short: "L", cls: "warning" },
  { key: "absent", label: "Absent", short: "A", cls: "danger" },
  { key: "excused", label: "Excused", short: "E", cls: "info" },
];

function niceDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function isWeekend(iso: string): boolean {
  const day = new Date(`${iso}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

/**
 * Daily attendance register. A class teacher (or school admin) marks each
 * learner Present / Late / Absent / Excused for a school day. Present + Late
 * count as days present, and the totals flow into each learner's report card
 * automatically (Remarks & attendance -> Days present).
 */
export function CloudDailyAttendance() {
  const { profile } = useCloudAuth();
  const isAdmin = !!profile && ["school_admin", "district_admin", "platform_admin"].includes(profile.role);

  const [term, setTerm] = useState<TermRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);

  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState<"register" | "summary">("register");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus | "">>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loadingDay, setLoadingDay] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [summary, setSummary] = useState<AttendanceSummaryRow[]>([]);
  const [overview, setOverview] = useState<SchoolDayRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([CloudTermService.getActive(profile?.school_id), CloudClassService.list(undefined, profile?.school_id)])
      .then(([t, c]) => {
        if (cancelled) return;
        setTerm(t);
        setClasses(CloudClassService.forRole(c, profile));
      })
      .catch((e) => !cancelled && setCtxError(e instanceof Error ? e.message : "Could not load."))
      .finally(() => !cancelled && setLoadingCtx(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A teacher with exactly one class gets it selected automatically.
  useEffect(() => {
    if (!classId && classes.length === 1) setClassId(classes[0].id);
  }, [classes, classId]);

  const loadOverview = useCallback(async () => {
    if (!isAdmin || !term || !profile?.school_id) return;
    try {
      setOverview(await CloudDailyAttendanceService.schoolDay(profile.school_id, term.id, date));
    } catch {
      setOverview([]);
    }
  }, [isAdmin, term, profile?.school_id, date]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const loadDay = useCallback(async () => {
    if (!term || !classId) {
      setStudents([]);
      setMarks({});
      return;
    }
    setLoadingDay(true);
    setMsg(null);
    try {
      const roster = await CloudEnrollmentService.getRoster(term.id, classId);
      const ids = roster.map((e) => e.student_id);
      const [studs, entries] = await Promise.all([
        CloudStudentService.listByIds(ids),
        CloudDailyAttendanceService.getDay(classId, date),
      ]);
      studs.sort((a, b) => fullNameOf(a).localeCompare(fullNameOf(b)));
      setStudents(studs);
      const m: Record<string, AttendanceStatus | ""> = {};
      const n: Record<string, string> = {};
      for (const e of entries) {
        m[e.student_id] = e.status;
        if (e.note) n[e.student_id] = e.note;
      }
      setMarks(m);
      setNotes(n);
      setDirty(false);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not load this class." });
    } finally {
      setLoadingDay(false);
    }
  }, [term, classId, date]);

  useEffect(() => {
    void loadDay();
  }, [loadDay]);

  const loadSummary = useCallback(async () => {
    if (!term || !classId) return;
    try {
      setSummary(await CloudDailyAttendanceService.summary(classId, term.id));
    } catch {
      setSummary([]);
    }
  }, [term, classId]);

  useEffect(() => {
    if (tab === "summary") void loadSummary();
  }, [tab, loadSummary]);

  function mark(id: string, s: AttendanceStatus) {
    setMarks((m) => ({ ...m, [id]: m[id] === s ? "" : s }));
    setDirty(true);
    setMsg(null);
  }

  function markAll(s: AttendanceStatus) {
    const m: Record<string, AttendanceStatus | ""> = {};
    for (const st of students) m[st.id] = s;
    setMarks(m);
    setDirty(true);
    setMsg(null);
  }

  async function save() {
    if (!term || !classId) return;
    setSaving(true);
    setMsg(null);
    try {
      const rows = students.map((s) => ({ student_id: s.id, status: marks[s.id] ?? "", note: notes[s.id] ?? "" }));
      const n = await CloudDailyAttendanceService.saveDay(classId, term.id, date, rows);
      setDirty(false);
      setMsg({ ok: true, text: `Register saved for ${n} learner(s). Days present on the report cards are updated.` });
      void loadOverview();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const s of students) {
      const v = marks[s.id];
      if (v) c[v] += 1;
      else c.unmarked += 1;
    }
    return c;
  }, [students, marks]);

  const summaryById = useMemo(() => new Map(summary.map((r) => [r.student_id, r])), [summary]);
  const selectedClass = classes.find((c) => c.id === classId) ?? null;

  if (loadingCtx) return <p className="text-muted">Loading…</p>;
  if (ctxError) return <div className="alert alert-danger">{ctxError}</div>;
  if (!term) return <div className="alert alert-warning">Your school doesn't have an active term set up yet.</div>;

  return (
    <div>
      <h1 className="h4 mb-1">Daily attendance</h1>
      <p className="text-muted mb-3">
        {term.term_name}. Mark each learner for the day. Present and Late count as days present on the report card.
      </p>

      {isAdmin && overview.length > 0 && (
        <div className="actrs-card p-3 mb-3">
          <div className="fw-semibold mb-2">School today: {niceDate(date)}</div>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="text-end">Learners</th>
                  <th className="text-end">Marked</th>
                  <th className="text-end">Present</th>
                  <th className="text-end">Absent</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overview.map((r) => (
                  <tr key={r.class_id}>
                    <td>{r.class_name}</td>
                    <td className="text-end">{r.enrolled}</td>
                    <td className="text-end">{r.marked}</td>
                    <td className="text-end text-success">{r.present}</td>
                    <td className="text-end text-danger">{r.absent}</td>
                    <td>
                      {r.enrolled > 0 && r.marked === 0 && <span className="badge text-bg-warning">Not marked</span>}
                      {r.enrolled > 0 && r.marked > 0 && r.marked < r.enrolled && (
                        <span className="badge text-bg-secondary">Partly marked</span>
                      )}
                      {r.enrolled > 0 && r.marked >= r.enrolled && <span className="badge text-bg-success">Done</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="actrs-card p-3 mb-3">
        <div className="row g-3 align-items-end">
          <div className="col-md-5">
            <label className="form-label small mb-1">Class</label>
            <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small mb-1">Date</label>
            <input
              type="date"
              className="form-control"
              value={date}
              max={todayISO()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </div>
          <div className="col-md-3">
            <button className="btn btn-outline-secondary w-100" onClick={() => setDate(todayISO())}>
              Today
            </button>
          </div>
        </div>
        {isWeekend(date) && <div className="small text-warning mt-2">This date is a weekend. Only mark it if school was open.</div>}
      </div>

      {classId && (
        <>
          <ul className="nav nav-tabs mb-3">
            <li className="nav-item">
              <button className={`nav-link ${tab === "register" ? "active" : ""}`} onClick={() => setTab("register")}>
                Register
              </button>
            </li>
            <li className="nav-item">
              <button className={`nav-link ${tab === "summary" ? "active" : ""}`} onClick={() => setTab("summary")}>
                Term summary
              </button>
            </li>
          </ul>

          {msg && <div className={`alert ${msg.ok ? "alert-success" : "alert-danger"} py-2`}>{msg.text}</div>}

          {tab === "register" && (
            <div className="actrs-card p-0">
              <div className="p-3 d-flex flex-wrap align-items-center gap-2 border-bottom">
                <div className="fw-semibold me-auto">
                  {selectedClass?.name} · {niceDate(date)}
                </div>
                <button className="btn btn-sm btn-outline-success" disabled={loadingDay} onClick={() => markAll("present")}>
                  Mark everyone present
                </button>
                <button className="btn btn-sm btn-primary" disabled={saving || !dirty} onClick={save}>
                  {saving ? "Saving…" : "Save register"}
                </button>
              </div>
              <div className="px-3 py-2 small text-muted border-bottom">
                Present {counts.present} · Late {counts.late} · Absent {counts.absent} · Excused {counts.excused} · Not
                marked {counts.unmarked}
                {dirty && <span className="text-warning ms-2">Unsaved changes</span>}
              </div>
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Learner</th>
                      <th style={{ minWidth: 260 }}>Status</th>
                      <th style={{ minWidth: 180 }}>Note (optional)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingDay && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          Loading…
                        </td>
                      </tr>
                    )}
                    {!loadingDay && students.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-muted py-4">
                          No learners are enrolled in this class for this term.
                        </td>
                      </tr>
                    )}
                    {!loadingDay &&
                      students.map((s, i) => (
                        <tr key={s.id}>
                          <td className="text-muted">{i + 1}</td>
                          <td className="fw-medium">{fullNameOf(s)}</td>
                          <td>
                            <div className="btn-group btn-group-sm" role="group">
                              {STATUSES.map((st) => (
                                <button
                                  key={st.key}
                                  type="button"
                                  title={st.label}
                                  className={`btn ${marks[s.id] === st.key ? `btn-${st.cls}` : `btn-outline-${st.cls}`}`}
                                  style={{ minWidth: 64 }}
                                  onClick={() => mark(s.id, st.key)}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              placeholder={marks[s.id] === "absent" || marks[s.id] === "excused" ? "Reason" : ""}
                              value={notes[s.id] ?? ""}
                              onChange={(e) => {
                                setNotes((n) => ({ ...n, [s.id]: e.target.value }));
                                setDirty(true);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "summary" && (
            <div className="actrs-card p-0">
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th>Learner</th>
                      <th className="text-end">Present</th>
                      <th className="text-end">Late</th>
                      <th className="text-end">Absent</th>
                      <th className="text-end">Excused</th>
                      <th className="text-end">Days marked</th>
                      <th className="text-end">Days present</th>
                      <th className="text-end">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => {
                      const r = summaryById.get(s.id);
                      const counted = r ? r.present + r.late : 0;
                      const rate = r && r.days_marked > 0 ? Math.round((counted / r.days_marked) * 100) : null;
                      return (
                        <tr key={s.id}>
                          <td className="fw-medium">{fullNameOf(s)}</td>
                          <td className="text-end">{r?.present ?? 0}</td>
                          <td className="text-end">{r?.late ?? 0}</td>
                          <td className="text-end">{r?.absent ?? 0}</td>
                          <td className="text-end">{r?.excused ?? 0}</td>
                          <td className="text-end">{r?.days_marked ?? 0}</td>
                          <td className="text-end fw-bold">{counted}</td>
                          <td className={`text-end ${rate !== null && rate < 80 ? "text-danger" : ""}`}>
                            {rate === null ? "-" : `${rate}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="small text-muted p-3 mb-0 border-top">
                "Days present" here is what flows to the report card. Report cards compare it with the term's total
                school days set under Settings.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
