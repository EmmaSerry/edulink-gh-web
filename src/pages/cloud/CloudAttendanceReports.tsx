import { useCallback, useEffect, useMemo, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { rest } from "@/lib/supabaseClient";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudClassService } from "@services/cloud/ClassService";
import {
  CloudAttendanceReportService,
  downloadCsv,
  rate,
  type AttPeriod,
  type AttScope,
  type BreakdownRow,
  type Insights,
  type PeriodRow,
  type RawRow,
} from "@services/cloud/AttendanceReportService";
import { todayISO } from "@services/cloud/DailyAttendanceService";
import type { TermRow } from "@/types/database";

interface Opt {
  id: string;
  name: string;
  district_id?: string | null;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DOW = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function pct(v: number | null): string {
  return v === null ? "-" : `${v}%`;
}

function RateBar({ value, color = "#2f9e5b" }: { value: number | null; color?: string }) {
  return (
    <div style={{ background: "rgba(128,128,128,.2)", borderRadius: 4, height: 8, width: "100%" }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: value !== null && value < 80 ? "#c8424f" : color, height: 8, borderRadius: 4 }} />
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="col-6 col-md-3 col-xl-2">
      <div className="actrs-card p-3 h-100 text-center">
        <div className="h4 mb-0">{value}</div>
        <div className="small text-muted">{label}</div>
        {sub && <div className="small text-muted">{sub}</div>}
      </div>
    </div>
  );
}

/**
 * Attendance reports: raw registers, daily / weekly / monthly / termly summaries, male and female breakdowns, and
 * decision-support analysis, for a class, a school or a district (whatever the signed-in role may see).
 */
export function CloudAttendanceReports() {
  const { profile } = useCloudAuth();
  const role = profile?.role ?? "";
  const isTeacher = role === "teacher";
  const isSchoolAdmin = role === "school_admin";
  const isDistrictAdmin = role === "district_admin";
  const isPlatform = role === "platform_admin";

  const [term, setTerm] = useState<TermRow | null>(null);
  const [districts, setDistricts] = useState<Opt[]>([]);
  const [schools, setSchools] = useState<Opt[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);

  const [level, setLevel] = useState<AttScope>(isTeacher ? "class" : isSchoolAdmin ? "school" : "district");
  const [districtId, setDistrictId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");

  const [from, setFrom] = useState(addDays(todayISO(), -29));
  const [to, setTo] = useState(todayISO());
  const [period, setPeriod] = useState<AttPeriod>("week");
  const [tab, setTab] = useState<"summary" | "breakdown" | "raw" | "insights">("summary");

  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownRow[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- who and what can be chosen ----
  useEffect(() => {
    void (async () => {
      try {
        if (profile?.school_id) setTerm(await CloudTermService.getActive(profile.school_id));
        if (isTeacher) {
          const c = await CloudClassService.list(undefined, profile?.school_id);
          const mine = CloudClassService.forRole(c, profile) as { id: string; name: string }[];
          setClasses(mine.map((x) => ({ id: x.id, name: x.name })));
          if (mine.length > 0) setClassId(mine[0].id);
        }
        if (isSchoolAdmin && profile?.school_id) setSchoolId(profile.school_id);
        if (isDistrictAdmin && profile?.district_id) setDistrictId(profile.district_id);
        if (isPlatform) setDistricts(await rest.select<Opt>("districts", { select: "id,name", order: "name.asc" }));
        if (isDistrictAdmin || isPlatform) {
          setSchools(await rest.select<Opt>("schools", { select: "id,name,district_id", order: "name.asc" }));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (isTeacher || !schoolId) {
      if (!isTeacher) setClasses([]);
      return;
    }
    void rest
      .select<Opt>("classes", { select: "id,name", filters: { school_id: `eq.${schoolId}` }, order: "name.asc" })
      .then(setClasses)
      .catch(() => setClasses([]));
  }, [schoolId, isTeacher]);

  const schoolsInDistrict = useMemo(
    () => (districtId ? schools.filter((s) => s.district_id === districtId) : schools),
    [schools, districtId]
  );

  const targetId = level === "class" ? classId : level === "school" ? schoolId : districtId;

  function preset(p: "today" | "7" | "30" | "month" | "term") {
    const t = todayISO();
    if (p === "today") {
      setFrom(t);
      setTo(t);
    } else if (p === "7") {
      setFrom(addDays(t, -6));
      setTo(t);
    } else if (p === "30") {
      setFrom(addDays(t, -29));
      setTo(t);
    } else if (p === "month") {
      setFrom(`${t.slice(0, 8)}01`);
      setTo(t);
    } else if (term?.opening_date) {
      setFrom(term.opening_date);
      const end = term.closing_date && term.closing_date < t ? term.closing_date : t;
      setTo(end);
    }
  }

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, b, i] = await Promise.all([
        CloudAttendanceReportService.period(level, targetId, from, to, period),
        CloudAttendanceReportService.breakdown(level, targetId, from, to),
        CloudAttendanceReportService.insights(level, targetId, from, to),
      ]);
      setPeriodRows(p);
      setBreakdown(b);
      setInsights(i);
      if (level === "class" && tab === "raw") setRawRows(await CloudAttendanceReportService.raw(targetId, from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the report.");
    } finally {
      setLoading(false);
    }
  }, [level, targetId, from, to, period, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  // ---- derived views ----
  const pivot = useMemo(() => {
    const map = new Map<string, { label: string; M: PeriodRow | null; F: PeriodRow | null }>();
    for (const r of periodRows) {
      const e = map.get(r.bucket) ?? { label: r.label, M: null, F: null };
      if (r.gender === "M") e.M = r;
      else e.F = r;
      map.set(r.bucket, e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [periodRows]);

  const rawMatrix = useMemo(() => {
    const dates = Array.from(new Set(rawRows.map((r) => r.attendance_date))).sort();
    const byStudent = new Map<string, { name: string; gender: string; marks: Record<string, string> }>();
    for (const r of rawRows) {
      const e = byStudent.get(r.student_id) ?? { name: r.student_name, gender: r.gender, marks: {} };
      e.marks[r.attendance_date] = r.status;
      byStudent.set(r.student_id, e);
    }
    return { dates, students: Array.from(byStudent.values()) };
  }, [rawRows]);

  const o = insights?.overall ?? null;
  const overallRate = o ? rate(o.counted, o.marked) : null;
  const mRate = o ? rate(o.m_counted, o.m_marked) : null;
  const fRate = o ? rate(o.f_counted, o.f_marked) : null;

  const observations = useMemo(() => {
    const out: string[] = [];
    if (!insights || !o || o.marked === 0) return out;
    if (overallRate !== null) {
      out.push(
        overallRate >= 95
          ? `Attendance is strong at ${overallRate}%.`
          : overallRate >= 90
            ? `Attendance is acceptable at ${overallRate}% but below the 95% target.`
            : `Attendance is low at ${overallRate}%. This needs attention.`
      );
    }
    if (mRate !== null && fRate !== null && Math.abs(mRate - fRate) >= 3) {
      out.push(`${mRate < fRate ? "Boys" : "Girls"} attend less (${Math.min(mRate, fRate)}% against ${Math.max(mRate, fRate)}%). Look at the reasons for the gap.`);
    }
    const wd = insights.weekday.filter((w) => w.marked > 0).map((w) => ({ ...w, r: (w.counted / w.marked) * 100 }));
    if (wd.length >= 3) {
      const worst = wd.reduce((a, b) => (a.r < b.r ? a : b));
      const best = wd.reduce((a, b) => (a.r > b.r ? a : b));
      if (best.r - worst.r >= 3) out.push(`${DOW[worst.dow]} is the weakest day (${worst.r.toFixed(1)}%); ${DOW[best.dow]} is the strongest (${best.r.toFixed(1)}%).`);
    }
    if (insights.weekly.length >= 3) {
      const w = insights.weekly.map((x) => (x.marked > 0 ? (x.counted / x.marked) * 100 : 0));
      const last = w[w.length - 1];
      const prev = w.slice(-4, -1).reduce((a, b) => a + b, 0) / Math.max(1, w.slice(-4, -1).length);
      if (last - prev <= -3) out.push(`Attendance fell in the latest week (${last.toFixed(1)}% against ${prev.toFixed(1)}% before).`);
      if (last - prev >= 3) out.push(`Attendance improved in the latest week (${last.toFixed(1)}% against ${prev.toFixed(1)}% before).`);
    }
    if (insights.chronic_count > 0 && o.learners > 0) {
      out.push(`${insights.chronic_count} learner(s) (${Math.round((insights.chronic_count / o.learners) * 100)}%) attend less than 80% of the time and may need follow-up.`);
    }
    if (insights.streaks.length > 0) out.push(`${insights.streaks.length} learner(s) have been absent for their last 3 marked days. Contact their parents or guardians.`);
    if (o.marked > 0 && o.late / o.marked >= 0.05) out.push(`Lateness is ${Math.round((o.late / o.marked) * 100)}% of marks. Consider a punctuality drive.`);
    const hi = insights.performance.find((p) => p.band === "95% and above");
    const lo = insights.performance.find((p) => p.band === "Below 80%");
    if (hi && lo && hi.avg_score - lo.avg_score >= 5) {
      out.push(`Learners attending 95% or more average ${hi.avg_score} marks against ${lo.avg_score} for those below 80%: attendance and performance move together.`);
    }
    return out;
  }, [insights, o, overallRate, mRate, fRate]);

  function exportSummary() {
    const rows: (string | number | null)[][] = [
      ["Period", "Male present", "Male late", "Male absent", "Male excused", "Female present", "Female late", "Female absent", "Female excused"],
    ];
    for (const [, e] of pivot) {
      rows.push([e.label, e.M?.present ?? 0, e.M?.late ?? 0, e.M?.absent ?? 0, e.M?.excused ?? 0, e.F?.present ?? 0, e.F?.late ?? 0, e.F?.absent ?? 0, e.F?.excused ?? 0]);
    }
    downloadCsv(`attendance-summary-${period}-${from}-to-${to}.csv`, rows);
  }

  function exportBreakdown() {
    const rows: (string | number | null)[][] = [
      [level === "class" ? "Learner" : level === "school" ? "Class" : "School", "Male learners", "Female learners", "Male rate %", "Female rate %", "Overall rate %", "Male absent", "Female absent"],
    ];
    for (const b of breakdown) {
      const mm = b.m_present + b.m_late + b.m_absent + b.m_excused;
      const ff = b.f_present + b.f_late + b.f_absent + b.f_excused;
      rows.push([b.unit_name, b.m_learners, b.f_learners, rate(b.m_present + b.m_late, mm), rate(b.f_present + b.f_late, ff), rate(b.m_present + b.m_late + b.f_present + b.f_late, mm + ff), b.m_absent + b.m_excused, b.f_absent + b.f_excused]);
    }
    downloadCsv(`attendance-breakdown-${from}-to-${to}.csv`, rows);
  }

  function exportRaw() {
    const rows: (string | number | null)[][] = [["Learner", "Gender", ...rawMatrix.dates]];
    for (const s of rawMatrix.students) rows.push([s.name, s.gender, ...rawMatrix.dates.map((d) => s.marks[d] ?? "")]);
    downloadCsv(`attendance-register-${from}-to-${to}.csv`, rows);
  }

  const STATUS_COLOR: Record<string, string> = { present: "#2f9e5b", late: "#d9a21b", absent: "#c8424f", excused: "#1f9aa8" };

  return (
    <div>
      <h1 className="h4 mb-1">Attendance reports</h1>
      <p className="text-muted mb-3">
        Raw registers, daily, weekly, monthly and termly summaries, male and female breakdowns, and analysis to support decisions.
        Present and Late count as attended.
      </p>

      <div className="actrs-card p-3 mb-3">
        <div className="row g-3">
          {!isTeacher && (
            <div className="col-md-3">
              <label className="form-label small mb-1">Report level</label>
              <select className="form-select" value={level} onChange={(e) => setLevel(e.target.value as AttScope)}>
                {(isDistrictAdmin || isPlatform) && <option value="district">District</option>}
                <option value="school">School</option>
                <option value="class">Class</option>
              </select>
            </div>
          )}
          {isPlatform && (
            <div className="col-md-3">
              <label className="form-label small mb-1">District</label>
              <select className="form-select" value={districtId} onChange={(e) => { setDistrictId(e.target.value); setSchoolId(""); setClassId(""); }}>
                <option value="">Select a district…</option>
                {districts.map((d) => (<option key={d.id} value={d.id}>{d.name}</option>))}
              </select>
            </div>
          )}
          {(isDistrictAdmin || isPlatform) && level !== "district" && (
            <div className="col-md-3">
              <label className="form-label small mb-1">School</label>
              <select className="form-select" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setClassId(""); }}>
                <option value="">Select a school…</option>
                {schoolsInDistrict.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
            </div>
          )}
          {level === "class" && (
            <div className="col-md-3">
              <label className="form-label small mb-1">Class</label>
              <select className="form-select" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">Select a class…</option>
                {classes.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          )}
        </div>
        <div className="row g-2 align-items-end mt-1">
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">From</label>
            <input type="date" className="form-control" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} />
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">To</label>
            <input type="date" className="form-control" value={to} min={from} max={todayISO()} onChange={(e) => e.target.value && setTo(e.target.value)} />
          </div>
          <div className="col-md-8 d-flex flex-wrap gap-1">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => preset("today")}>Today</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => preset("7")}>Last 7 days</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => preset("month")}>This month</button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => preset("30")}>Last 30 days</button>
            {term?.opening_date && <button className="btn btn-outline-secondary btn-sm" onClick={() => preset("term")}>This term</button>}
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {!targetId && <div className="alert alert-info">Choose what to report on.</div>}

      {targetId && (
        <>
          <div className="row g-2 mb-3">
            <Kpi label="Overall attendance" value={pct(overallRate)} />
            <Kpi label="Boys" value={pct(mRate)} sub={o ? `${o.m_marked} marks` : ""} />
            <Kpi label="Girls" value={pct(fRate)} sub={o ? `${o.f_marked} marks` : ""} />
            <Kpi label="Late" value={o && o.marked > 0 ? `${Math.round((o.late / o.marked) * 1000) / 10}%` : "-"} />
            <Kpi label="Learners marked" value={o ? String(o.learners) : "-"} />
            <Kpi label="Days marked" value={o ? String(o.dates) : "-"} />
          </div>

          <ul className="nav nav-tabs mb-3">
            {([["summary", "Summary"], ["breakdown", level === "class" ? "Per learner" : level === "school" ? "Per class" : "Per school"], ["raw", "Raw register"], ["insights", "Insights"]] as const).map(([k, l]) => (
              <li className="nav-item" key={k}>
                <button className={`nav-link ${tab === k ? "active" : ""}`} onClick={() => setTab(k)} disabled={k === "raw" && level !== "class"} title={k === "raw" && level !== "class" ? "Raw registers are shown one class at a time" : ""}>
                  {l}
                </button>
              </li>
            ))}
            {loading && <li className="nav-item ms-2 align-self-center small text-muted">Loading…</li>}
          </ul>

          {tab === "summary" && (
            <div className="actrs-card p-0">
              <div className="p-3 d-flex flex-wrap gap-2 align-items-center border-bottom">
                <span className="small text-muted">Group by</span>
                {(["day", "week", "month", "term"] as AttPeriod[]).map((p) => (
                  <button key={p} className={`btn btn-sm ${period === p ? "btn-primary" : "btn-outline-primary"}`} onClick={() => setPeriod(p)}>
                    {p === "day" ? "Daily" : p === "week" ? "Weekly" : p === "month" ? "Monthly" : "Termly"}
                  </button>
                ))}
                <button className="btn btn-sm btn-outline-secondary ms-auto" onClick={exportSummary}>Download CSV</button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Period</th>
                      <th colSpan={4} className="text-center">Boys</th>
                      <th colSpan={4} className="text-center">Girls</th>
                      <th colSpan={2} className="text-center">All</th>
                    </tr>
                    <tr>
                      <th className="text-end">Pres</th><th className="text-end">Late</th><th className="text-end">Abs</th><th className="text-end">Exc</th>
                      <th className="text-end">Pres</th><th className="text-end">Late</th><th className="text-end">Abs</th><th className="text-end">Exc</th>
                      <th className="text-end">Rate</th><th style={{ width: 90 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {pivot.length === 0 && (<tr><td colSpan={11} className="text-center text-muted py-4">No attendance recorded for this selection.</td></tr>)}
                    {pivot.map(([k, e]) => {
                      const m = e.M, f = e.F;
                      const counted = (m?.present ?? 0) + (m?.late ?? 0) + (f?.present ?? 0) + (f?.late ?? 0);
                      const marked = counted + (m?.absent ?? 0) + (m?.excused ?? 0) + (f?.absent ?? 0) + (f?.excused ?? 0);
                      const r = rate(counted, marked);
                      return (
                        <tr key={k}>
                          <td>{e.label}</td>
                          <td className="text-end">{m?.present ?? 0}</td><td className="text-end">{m?.late ?? 0}</td><td className="text-end">{m?.absent ?? 0}</td><td className="text-end">{m?.excused ?? 0}</td>
                          <td className="text-end">{f?.present ?? 0}</td><td className="text-end">{f?.late ?? 0}</td><td className="text-end">{f?.absent ?? 0}</td><td className="text-end">{f?.excused ?? 0}</td>
                          <td className="text-end fw-bold">{pct(r)}</td>
                          <td><RateBar value={r} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "breakdown" && (
            <div className="actrs-card p-0">
              <div className="p-3 d-flex border-bottom">
                <span className="small text-muted me-auto">Sorted by name. Rates below 80% are shown in red.</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={exportBreakdown}>Download CSV</button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0">
                  <thead>
                    <tr>
                      <th>{level === "class" ? "Learner" : level === "school" ? "Class" : "School"}</th>
                      {level !== "class" && <><th className="text-end">Boys</th><th className="text-end">Girls</th></>}
                      {level === "class" && <th>Sex</th>}
                      <th className="text-end">Boys rate</th>
                      <th className="text-end">Girls rate</th>
                      <th className="text-end">Absent days</th>
                      <th className="text-end">Rate</th>
                      <th style={{ width: 110 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {breakdown.length === 0 && (<tr><td colSpan={9} className="text-center text-muted py-4">No attendance recorded for this selection.</td></tr>)}
                    {breakdown.map((b) => {
                      const mm = b.m_present + b.m_late + b.m_absent + b.m_excused;
                      const ff = b.f_present + b.f_late + b.f_absent + b.f_excused;
                      const r = rate(b.m_present + b.m_late + b.f_present + b.f_late, mm + ff);
                      const mr = rate(b.m_present + b.m_late, mm);
                      const fr = rate(b.f_present + b.f_late, ff);
                      return (
                        <tr key={b.unit_id}>
                          <td>{b.unit_name}</td>
                          {level !== "class" && <><td className="text-end">{b.m_learners}</td><td className="text-end">{b.f_learners}</td></>}
                          {level === "class" && <td>{b.m_learners ? "M" : "F"}</td>}
                          <td className="text-end">{pct(mr)}</td>
                          <td className="text-end">{pct(fr)}</td>
                          <td className="text-end">{b.m_absent + b.m_excused + b.f_absent + b.f_excused}</td>
                          <td className={`text-end fw-bold ${r !== null && r < 80 ? "text-danger" : ""}`}>{pct(r)}</td>
                          <td><RateBar value={r} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "raw" && level === "class" && (
            <div className="actrs-card p-0">
              <div className="p-3 d-flex border-bottom">
                <span className="small text-muted me-auto">
                  P present, L late, A absent, E excused. Up to 124 days at a time.
                </span>
                <button className="btn btn-sm btn-outline-secondary" onClick={exportRaw}>Download CSV</button>
              </div>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0" style={{ fontSize: "0.8rem" }}>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, background: "var(--bs-body-bg, #fff)" }}>Learner</th>
                      {rawMatrix.dates.map((d) => (<th key={d} className="text-center" style={{ minWidth: 34 }}>{d.slice(8)}/{d.slice(5, 7)}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawMatrix.students.length === 0 && (<tr><td colSpan={rawMatrix.dates.length + 1} className="text-center text-muted py-4">No marks in this range.</td></tr>)}
                    {rawMatrix.students.map((s) => (
                      <tr key={s.name}>
                        <td style={{ position: "sticky", left: 0, background: "var(--bs-body-bg, #fff)", whiteSpace: "nowrap" }}>{s.name} <span className="text-muted">({s.gender})</span></td>
                        {rawMatrix.dates.map((d) => {
                          const st = s.marks[d];
                          return (
                            <td key={d} className="text-center fw-bold" style={{ color: st ? STATUS_COLOR[st] : "#9aa4b2" }}>
                              {st ? st.charAt(0).toUpperCase() : "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === "insights" && (
            <div className="row g-3">
              <div className="col-12">
                <div className="actrs-card p-3">
                  <h2 className="h6 fw-bold">What this means</h2>
                  {observations.length === 0 ? (
                    <p className="text-muted small mb-0">Not enough attendance has been recorded for this selection.</p>
                  ) : (
                    <ul className="mb-0">{observations.map((t) => (<li key={t}>{t}</li>))}</ul>
                  )}
                </div>
              </div>

              <div className="col-lg-6">
                <div className="actrs-card p-3 h-100">
                  <h2 className="h6 fw-bold">Attendance by day of the week</h2>
                  {(insights?.weekday ?? []).map((w) => {
                    const r = rate(w.counted, w.marked);
                    return (
                      <div key={w.dow} className="d-flex align-items-center gap-2 mb-1">
                        <div style={{ width: 90 }} className="small">{DOW[w.dow]}</div>
                        <div className="flex-grow-1"><RateBar value={r} color="#1f9aa8" /></div>
                        <div style={{ width: 52 }} className="small text-end">{pct(r)}</div>
                      </div>
                    );
                  })}
                  {(insights?.weekday ?? []).length === 0 && <p className="text-muted small mb-0">No data.</p>}
                </div>
              </div>

              <div className="col-lg-6">
                <div className="actrs-card p-3 h-100">
                  <h2 className="h6 fw-bold">Weekly trend (boys and girls)</h2>
                  {(insights?.weekly ?? []).map((w) => {
                    const r = rate(w.counted, w.marked);
                    return (
                      <div key={w.wkstart} className="mb-1">
                        <div className="d-flex justify-content-between small">
                          <span>Week of {w.wkstart.slice(8)}/{w.wkstart.slice(5, 7)}</span>
                          <span>{pct(r)} · boys {pct(rate(w.m_counted, w.m_marked))} · girls {pct(rate(w.f_counted, w.f_marked))}</span>
                        </div>
                        <RateBar value={r} color="#6b3fa0" />
                      </div>
                    );
                  })}
                  {(insights?.weekly ?? []).length === 0 && <p className="text-muted small mb-0">No data.</p>}
                </div>
              </div>

              <div className="col-lg-6">
                <div className="actrs-card p-3 h-100">
                  <h2 className="h6 fw-bold">Learners needing follow-up (under 80% attendance)</h2>
                  <p className="small text-muted">{insights?.chronic_count ?? 0} learner(s) in total. The 15 lowest are shown.</p>
                  <div className="table-responsive">
                    <table className="table table-sm mb-0">
                      <thead><tr><th>Learner</th><th>Class</th><th>Sex</th><th className="text-end">Absent</th><th className="text-end">Rate</th></tr></thead>
                      <tbody>
                        {(insights?.chronic ?? []).map((c) => (
                          <tr key={c.name + c.class}><td>{c.name}</td><td>{c.class}</td><td>{c.gender}</td><td className="text-end">{c.absent}</td><td className="text-end text-danger fw-bold">{c.rate}%</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="col-lg-6">
                <div className="actrs-card p-3 mb-3">
                  <h2 className="h6 fw-bold">Absent for their last 3 marked days</h2>
                  {(insights?.streaks ?? []).length === 0 ? (
                    <p className="text-muted small mb-0">None.</p>
                  ) : (
                    <ul className="mb-0 small">{insights?.streaks.map((s) => (<li key={s.name + s.class}>{s.name} ({s.class}, {s.gender})</li>))}</ul>
                  )}
                </div>
                <div className="actrs-card p-3">
                  <h2 className="h6 fw-bold">Attendance and performance</h2>
                  <p className="small text-muted">Average total score (SBA plus Exam, per subject) by attendance band.</p>
                  <table className="table table-sm mb-0">
                    <thead><tr><th>Attendance</th><th className="text-end">Learners</th><th className="text-end">Average score</th></tr></thead>
                    <tbody>
                      {(insights?.performance ?? []).map((p) => (<tr key={p.band}><td>{p.band}</td><td className="text-end">{p.learners}</td><td className="text-end fw-bold">{p.avg_score}</td></tr>))}
                      {(insights?.performance ?? []).length === 0 && (<tr><td colSpan={3} className="text-muted small">Needs scores to be entered for the same term.</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
