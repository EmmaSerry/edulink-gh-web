import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  MockExamService,
  STATUS_LABEL,
  type AuditEntry,
  type MarkEntry,
  type MockFull,
  type MockStatus,
} from "@/services/cloud/MockExamService";
import {
  aggregateStatistics,
  bestCandidates,
  computeCandidateResult,
  gradeForMark,
  rankCandidates,
  subjectStatistics,
  summariseDataQuality,
  type CandidateResult,
} from "@/mock/mockEngine";

type Tab = "dashboard" | "entry" | "candidates" | "aggregate" | "subjects" | "quality" | "admin";

const DISCLAIMER =
  "Mock Aggregate: a school-level estimate from internal mock examinations. It is not an official WAEC result or prediction.";

function csvDownload(filename: string, rows: Array<Array<string | number | null>>) {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const pctText = (v: number | null) => (v === null ? "—" : `${v}%`);

export function CloudMockExamDetail() {
  const { mockId = "" } = useParams();
  const [data, setData] = useState<MockFull | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setData(await MockExamService.getFull(mockId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this mock.");
    } finally {
      setLoading(false);
    }
  }, [mockId]);
  useEffect(() => {
    void load();
  }, [load]);

  const derived = useMemo(() => {
    if (!data) return null;
    const { mock, subjects, candidates, marks } = data;
    const results = candidates.map((c) => computeCandidateResult(c, subjects, marks, mock.grading));
    const resultById = new Map(results.map((r) => [r.candidateId, r] as const));
    const ranks = rankCandidates(
      candidates.filter((c) => c.status === "registered").map((c) => ({ candidateId: c.id, classId: c.classId, status: resultById.get(c.id)!.status, aggregate: resultById.get(c.id)!.aggregate })),
      mock.grading.lowerIsBetter
    );
    const sitting = results.filter((r) => candidates.find((c) => c.id === r.candidateId)?.status === "registered");
    return {
      results,
      resultById,
      ranks,
      aggStats: aggregateStatistics(sitting, mock.targetAggregate, mock.grading.lowerIsBetter),
      best: bestCandidates(sitting, mock.grading.lowerIsBetter),
      subjStats: subjectStatistics(subjects, candidates, marks, mock.grading),
      dq: summariseDataQuality(subjects, candidates, marks, mock.grading, results),
    };
  }, [data]);

  if (loading) return <div className="text-muted">Loading…</div>;
  if (error && !data) return <div className="alert alert-danger">{error}</div>;
  if (!data || !derived) return null;

  const { mock } = data;
  const tabs: Array<[Tab, string]> = [
    ["dashboard", "Dashboard"],
    ["entry", "Marks entry"],
    ["candidates", "Candidate broadsheet"],
    ["aggregate", "Aggregate broadsheet"],
    ["subjects", "Subject analysis"],
    ["quality", "Data quality"],
    ["admin", "Status & audit"],
  ];

  return (
    <div>
      <div className="mb-2">
        <Link to="/mock-exams" className="small">
          ← All mocks
        </Link>
      </div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <div>
          <h4 className="mb-0">{mock.name}</h4>
          <div className="text-muted small">
            {mock.schoolName} · {mock.academicYearLabel} · {mock.grading.schemeName} (max {mock.grading.maxMark})
          </div>
        </div>
        <span className="badge text-bg-primary fs-6">{STATUS_LABEL[mock.status]}</span>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}
      <ul className="nav nav-tabs mb-3 flex-wrap">
        {tabs.map(([k, label]) => (
          <li className="nav-item" key={k}>
            <button className={`nav-link ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>
              {label}
            </button>
          </li>
        ))}
      </ul>

      {tab === "dashboard" && <Dashboard data={data} d={derived} />}
      {tab === "entry" && <MarksEntry data={data} reload={load} setError={setError} />}
      {tab === "candidates" && <CandidateBroadsheet data={data} d={derived} />}
      {tab === "aggregate" && <AggregateBroadsheet data={data} d={derived} />}
      {tab === "subjects" && <SubjectAnalysis data={data} d={derived} />}
      {tab === "quality" && <DataQuality data={data} d={derived} />}
      {tab === "admin" && <StatusAndAudit data={data} d={derived} reload={load} setError={setError} />}
    </div>
  );
}

interface Derived {
  results: CandidateResult[];
  resultById: Map<string, CandidateResult>;
  ranks: ReturnType<typeof rankCandidates>;
  aggStats: ReturnType<typeof aggregateStatistics>;
  best: CandidateResult[];
  subjStats: ReturnType<typeof subjectStatistics>;
  dq: ReturnType<typeof summariseDataQuality>;
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="col-6 col-md-3">
      <div className="card h-100">
        <div className="card-body py-3">
          <div className="text-muted small">{label}</div>
          <div className="fs-4 fw-bold">{value}</div>
          {sub && <div className="text-muted small">{sub}</div>}
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, d }: { data: MockFull; d: Derived }) {
  const { mock, candidates } = data;
  const sitting = candidates.filter((c) => c.status === "registered").length;
  const dist = new Map<number, number>();
  d.results.forEach((r) => {
    if (r.status === "complete" && r.aggregate !== null) {
      const bucket = Math.floor((r.aggregate - 6) / 6) * 6 + 6;
      dist.set(bucket, (dist.get(bucket) ?? 0) + 1);
    }
  });
  const buckets = [...dist.entries()].sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(1, ...buckets.map((b) => b[1]));
  const nameOf = (id: string) => candidates.find((c) => c.id === id)?.fullName ?? "";

  return (
    <div>
      <div className="row g-3 mb-3">
        <Stat label="Candidates sitting" value={sitting} sub={`${d.dq.excluded} excluded · ${d.dq.absentAll} absent all`} />
        <Stat label="With complete aggregate" value={`${d.aggStats.completeCount} / ${sitting}`} sub={pctText(sitting ? Math.round((d.aggStats.completeCount / sitting) * 1000) / 10 : null)} />
        <Stat label="Average aggregate" value={d.aggStats.average ?? "—"} sub={d.aggStats.completeCount ? `based on ${d.aggStats.completeCount} candidates` : "Insufficient data"} />
        <Stat label="Mark entry complete" value={pctText(d.dq.overallPctComplete)} sub={`${d.dq.totalAccountedMarks} of ${d.dq.totalExpectedMarks} records`} />
        <Stat label="Best aggregate" value={d.aggStats.best ?? "—"} sub={d.best.length ? d.best.map((b) => nameOf(b.candidateId)).join(", ") : "No complete aggregate yet"} />
        <Stat label="Weakest aggregate" value={d.aggStats.worst ?? "—"} />
        <Stat
          label={mock.targetAggregate !== null ? `Meeting target (≤${mock.targetAggregate})` : "Target"}
          value={d.aggStats.meetingTarget === null ? "Not set" : `${d.aggStats.meetingTarget} / ${d.aggStats.completeCount}`}
        />
        <Stat label="Subjects" value={data.subjects.length} />
      </div>

      {d.dq.issues.length > 0 && (
        <div className="alert alert-warning">
          <strong>Reliability notes</strong>
          <ul className="mb-0">
            {d.dq.issues.map((i, k) => (
              <li key={k}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">Aggregate distribution (complete aggregates only)</div>
            <div className="card-body">
              {buckets.length === 0 ? (
                <div className="text-muted">Insufficient data — no candidate has a complete aggregate yet.</div>
              ) : (
                buckets.map(([start, n]) => (
                  <div key={start} className="d-flex align-items-center gap-2 mb-1">
                    <div style={{ width: 70 }} className="small">
                      {start}–{start + 5}
                    </div>
                    <div className="flex-grow-1 bg-light rounded">
                      <div style={{ width: `${(n / maxCount) * 100}%`, background: "#2f6fed", height: 16, borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 30 }} className="small text-end">
                      {n}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card h-100">
            <div className="card-header">Subject average (% of maximum)</div>
            <div className="card-body">
              {d.subjStats.map((s) => (
                <div key={s.subjectId} className="d-flex align-items-center gap-2 mb-1">
                  <div style={{ width: 130 }} className="small text-truncate" title={s.name}>
                    {s.name}
                  </div>
                  <div className="flex-grow-1 bg-light rounded">
                    <div style={{ width: `${s.averagePct ?? 0}%`, background: "#198754", height: 16, borderRadius: 4 }} />
                  </div>
                  <div style={{ width: 90 }} className="small text-end">
                    {s.averagePct === null ? "No data" : `${s.averagePct.toFixed(1)}% (n=${s.validCount})`}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="small text-muted mt-3 mb-0">{DISCLAIMER}</p>
    </div>
  );
}

/* ------------------------------ Marks entry ------------------------------ */

function MarksEntry({ data, reload, setError }: { data: MockFull; reload: () => Promise<void>; setError: (s: string) => void }) {
  const { mock, subjects, candidates, marks } = data;
  const [classFilter, setClassFilter] = useState("");
  const [subjFilter, setSubjFilter] = useState("");
  const [cells, setCells] = useState<Record<string, string>>({});
  const [cellErr, setCellErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const key = (c: string, s: string) => `${c}|${s}`;
  const stored = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of marks) m.set(key(k.candidateId, k.subjectId), k.status === "absent" ? "A" : String(k.mark));
    return m;
  }, [marks]);

  const needsReason = mock.status === "entry_closed" || mock.status === "finalised";
  const locked = mock.status === "draft" || !data.canWrite || (needsReason && data.role === "teacher");
  const classes = [...new Set(candidates.map((c) => c.className))].sort();
  const shownSubjects = subjects.filter((s) => !subjFilter || s.id === subjFilter);
  const shown = candidates.filter((c) => c.status === "registered" && (!classFilter || c.className === classFilter));

  const valueOf = (c: string, s: string) => (cells[key(c, s)] !== undefined ? cells[key(c, s)] : (stored.get(key(c, s)) ?? ""));

  const validate = (v: string, max: number): string => {
    const t = v.trim();
    if (t === "" || /^a(bs(ent)?)?$/i.test(t)) return "";
    const n = Number(t);
    if (!Number.isFinite(n)) return "Not a number";
    if (n < 0 || n > max) return `0–${max}`;
    if (!mock.grading.allowDecimals && !Number.isInteger(n)) return "Whole numbers only";
    return "";
  };

  const dirty = Object.entries(cells).filter(([k, v]) => v !== (stored.get(k) ?? ""));
  const hasErrors = Object.values(cellErr).some(Boolean);

  const save = async () => {
    const entries: MarkEntry[] = dirty.map(([k, v]) => {
      const [candidateId, subjectId] = k.split("|");
      const t = v.trim();
      if (t === "") return { candidateId, subjectId, clear: true };
      if (/^a(bs(ent)?)?$/i.test(t)) return { candidateId, subjectId, absent: true };
      return { candidateId, subjectId, mark: Number(t) };
    });
    if (entries.length === 0) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      await MockExamService.saveMarks(mock.id, entries, needsReason ? reason : undefined);
      setCells({});
      setReason("");
      await reload();
      setSavedMsg(`Saved ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {mock.status === "draft" && <div className="alert alert-info">This mock is still a draft. Open it for entry on the “Status & audit” tab.</div>}
      {needsReason && !locked && <div className="alert alert-warning small">Entry is closed. Changes are corrections: a reason is required and every change is recorded in the audit history.</div>}
      <div className="d-flex flex-wrap gap-2 mb-2 align-items-end">
        <div>
          <label className="form-label small mb-0">Class</label>
          <select className="form-select form-select-sm" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label small mb-0">Subject</label>
          <select className="form-select form-select-sm" value={subjFilter} onChange={(e) => setSubjFilter(e.target.value)}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        {needsReason && !locked && (
          <div className="flex-grow-1">
            <label className="form-label small mb-0">Reason for correction</label>
            <input className="form-control form-control-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        )}
        <button className="btn btn-primary btn-sm" disabled={locked || saving || dirty.length === 0 || hasErrors || (needsReason && !reason.trim())} onClick={save}>
          {saving ? "Saving…" : `Save ${dirty.length || ""} change${dirty.length === 1 ? "" : "s"}`}
        </button>
        <button className="btn btn-outline-secondary btn-sm" disabled={dirty.length === 0} onClick={() => { setCells({}); setCellErr({}); }}>
          Discard
        </button>
      </div>
      <div className="small text-muted mb-2">
        Type a mark, or <strong>A</strong> for absent. Leave blank if not yet written. A mark of <strong>0</strong> is a real score. Nothing is saved until you press Save, and a save is all-or-nothing.
        {savedMsg && <span className="text-success ms-2">{savedMsg}</span>}
      </div>
      <div className="table-responsive" style={{ maxHeight: "65vh" }}>
        <table className="table table-sm table-bordered align-middle text-center">
          <thead className="table-light" style={{ position: "sticky", top: 0, zIndex: 1 }}>
            <tr>
              <th className="text-start">Candidate</th>
              {shownSubjects.map((s) => (
                <th key={s.id} style={{ minWidth: 90 }}>
                  {s.name}
                  <div className="small fw-normal text-muted">
                    /{s.maxMark}
                    {s.isCore ? " · core" : ""}
                  </div>
                </th>
              ))}
              <th>Done</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => {
              const done = shownSubjects.filter((s) => valueOf(c.id, s.id).trim() !== "").length;
              return (
                <tr key={c.id}>
                  <td className="text-start">
                    {c.fullName}
                    <div className="small text-muted">
                      {c.candidateNo} · {c.className}
                    </div>
                  </td>
                  {shownSubjects.map((s) => {
                    const k = key(c.id, s.id);
                    const v = valueOf(c.id, s.id);
                    const err = cellErr[k];
                    const changed = cells[k] !== undefined && cells[k] !== (stored.get(k) ?? "");
                    const n = Number(v);
                    const g = v.trim() !== "" && !/^a/i.test(v) && Number.isFinite(n) ? gradeForMark(n, s.maxMark, mock.grading) : null;
                    return (
                      <td key={s.id} className={changed ? "table-warning" : v === "" ? "table-light" : ""}>
                        <input
                          className={`form-control form-control-sm text-center ${err ? "is-invalid" : ""}`}
                          style={{ width: 70, margin: "0 auto" }}
                          disabled={locked}
                          value={v}
                          title={err}
                          onChange={(e) => {
                            setCells({ ...cells, [k]: e.target.value });
                            setCellErr({ ...cellErr, [k]: validate(e.target.value, s.maxMark) });
                          }}
                        />
                        <div className="small" style={{ minHeight: 16 }}>
                          {err ? <span className="text-danger">{err}</span> : /^a/i.test(v) ? <span className="text-muted">absent</span> : g ? <span className="text-muted">grade {g.label}</span> : ""}
                        </div>
                      </td>
                    );
                  })}
                  <td className="small">
                    {done}/{shownSubjects.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------ Broadsheets ------------------------------ */

function CandidateBroadsheet({ data, d }: { data: MockFull; d: Derived }) {
  const { mock, subjects, candidates, marks } = data;
  const [cls, setCls] = useState("");
  const [q, setQ] = useState("");
  const classes = [...new Set(candidates.map((c) => c.className))].sort();
  const markOf = new Map(marks.map((m) => [`${m.candidateId}|${m.subjectId}`, m] as const));

  const rows = candidates.filter((c) => (!cls || c.className === cls) && (!q || c.fullName.toLowerCase().includes(q.toLowerCase())));

  const exportCsv = () => {
    const head = ["Candidate No", "Name", "Class", ...subjects.flatMap((s) => [`${s.name} mark`, `${s.name} grade`])];
    csvDownload(`${mock.name}-candidate-broadsheet.csv`, [
      head,
      ...rows.map((c) => [
        c.candidateNo,
        c.fullName,
        c.className,
        ...subjects.flatMap((s) => {
          const m = markOf.get(`${c.id}|${s.id}`);
          const g = d.resultById.get(c.id)?.grades[s.id];
          return [m ? (m.status === "absent" ? "ABS" : m.mark) : "", g ? g.label : ""];
        }),
      ]),
    ]);
  };

  return (
    <div>
      <div className="d-flex flex-wrap gap-2 mb-2 align-items-end d-print-none">
        <select className="form-select form-select-sm w-auto" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className="form-control form-control-sm w-auto" placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-sm btn-outline-primary" onClick={exportCsv}>
          Export CSV
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered align-middle text-center">
          <thead className="table-light">
            <tr>
              <th>No.</th>
              <th className="text-start">Candidate</th>
              <th>Class</th>
              {subjects.map((s) => (
                <th key={s.id}>{s.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className={c.status !== "registered" ? "text-muted" : ""}>
                <td>{c.candidateNo}</td>
                <td className="text-start">
                  {c.fullName}
                  {c.status === "excluded" && <span className="badge text-bg-secondary ms-1">Excluded</span>}
                  {c.status === "absent_all" && <span className="badge text-bg-secondary ms-1">Absent</span>}
                </td>
                <td>{c.className}</td>
                {subjects.map((s) => {
                  const m = markOf.get(`${c.id}|${s.id}`);
                  const g = d.resultById.get(c.id)?.grades[s.id];
                  return (
                    <td key={s.id}>
                      {c.status !== "registered" ? "" : !m ? <span className="text-muted">—</span> : m.status === "absent" ? <span className="text-muted">ABS</span> : (
                        <>
                          {m.mark} <span className="badge text-bg-light border">{g?.label ?? "?"}</span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-muted">“—” = not yet entered · ABS = absent. A missing mark is never counted as zero. {DISCLAIMER}</p>
    </div>
  );
}

function AggregateBroadsheet({ data, d }: { data: MockFull; d: Derived }) {
  const { mock, candidates } = data;
  const [cls, setCls] = useState("");
  const classes = [...new Set(candidates.map((c) => c.className))].sort();
  const rows = candidates
    .filter((c) => c.status === "registered" && (!cls || c.className === cls))
    .map((c) => ({ c, r: d.resultById.get(c.id)!, rank: d.ranks.get(c.id) }))
    .sort((a, b) => {
      const ra = a.rank?.schoolRank ?? Number.POSITIVE_INFINITY;
      const rb = b.rank?.schoolRank ?? Number.POSITIVE_INFINITY;
      return ra !== rb ? ra - rb : a.c.fullName.localeCompare(b.c.fullName);
    });

  const exportCsv = () =>
    csvDownload(`${mock.name}-aggregate-broadsheet.csv`, [
      ["Position", "Class position", "Candidate No", "Name", "Class", "Mock Aggregate", "Status", "Counted subjects"],
      ...rows.map(({ c, r, rank }) => [
        rank?.schoolRank ?? "",
        rank?.classRank ?? "",
        c.candidateNo,
        c.fullName,
        c.className,
        r.aggregate,
        r.status,
        r.contributing.map((x) => `${x.name}:${x.grade}`).join("; "),
      ]),
    ]);

  return (
    <div>
      <div className="d-flex gap-2 mb-2 d-print-none">
        <select className="form-select form-select-sm w-auto" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button className="btn btn-sm btn-outline-primary" onClick={exportCsv}>
          Export CSV
        </button>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered align-middle">
          <thead className="table-light">
            <tr>
              <th>Position</th>
              <th>Class pos.</th>
              <th>Candidate</th>
              <th>Class</th>
              <th>Mock Aggregate</th>
              <th>Counted subjects (grade)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, r, rank }) => (
              <tr key={c.id}>
                <td>{rank?.schoolRank ?? "—"}{rank?.tied ? " (tied)" : ""}</td>
                <td>{rank?.classRank ?? "—"}</td>
                <td>{c.fullName}</td>
                <td>{c.className}</td>
                <td className="fw-bold">{r.aggregate ?? <span className="text-muted fw-normal">Incomplete</span>}</td>
                <td className="small">
                  {r.status === "complete" ? r.contributing.map((x) => `${x.name} (${x.grade})`).join(", ") : r.reasons.join(" ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-muted">
        Aggregate = four core subjects + best two non-core. Tied candidates share a position (1, 1, 3). Candidates without a complete aggregate are not ranked. {DISCLAIMER}
      </p>
    </div>
  );
}

function SubjectAnalysis({ data, d }: { data: MockFull; d: Derived }) {
  const { mock } = data;
  const grades = mock.grading.bands.map((b) => b.grade).sort((a, b) => a - b);
  return (
    <div className="table-responsive">
      <table className="table table-sm table-bordered text-center align-middle">
        <thead className="table-light">
          <tr>
            <th className="text-start">Subject</th>
            <th>Valid marks (n)</th>
            <th>Average</th>
            <th>Average %</th>
            <th>Highest</th>
            <th>Lowest</th>
            {grades.map((g) => (
              <th key={g}>G{g}</th>
            ))}
            <th>Meeting target</th>
          </tr>
        </thead>
        <tbody>
          {d.subjStats.map((s) => (
            <tr key={s.subjectId}>
              <td className="text-start">{s.name}</td>
              <td>{s.validCount}</td>
              <td>{s.average ?? "—"}</td>
              <td>{s.averagePct === null ? "—" : s.averagePct.toFixed(1)}</td>
              <td>{s.highest ?? "—"}</td>
              <td>{s.lowest ?? "—"}</td>
              {grades.map((g) => (
                <td key={g}>{s.gradeDistribution[g] ?? 0}</td>
              ))}
              <td>{s.targetPct === null ? "No target" : `${s.meetingTarget}/${s.validCount} (${pctText(s.pctMeetingTarget)})`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small text-muted">Every figure uses only candidates with a valid mark in that subject (n). Absent and not-yet-entered candidates are excluded, never counted as zero.</p>
    </div>
  );
}

function DataQuality({ data, d }: { data: MockFull; d: Derived }) {
  const { mock } = data;
  const exportCsv = () =>
    csvDownload(`${mock.name}-data-quality.csv`, [
      ["Subject", "Expected", "Valid", "Absent", "Outstanding", "Invalid", "% complete"],
      ...d.dq.subjects.map((s) => [s.name, s.expected, s.valid, s.absent, s.outstanding, s.invalid, s.pctComplete]),
    ]);
  const missing = data.candidates
    .filter((c) => c.status === "registered")
    .map((c) => ({ c, r: d.resultById.get(c.id)! }))
    .filter(({ r }) => r.status !== "complete");
  return (
    <div>
      <div className="d-flex justify-content-between mb-2">
        <div>
          Ready to finalise without exceptions:{" "}
          <span className={`badge text-bg-${d.dq.readyToFinalise && missing.length === 0 ? "success" : "warning"}`}>{d.dq.readyToFinalise && missing.length === 0 ? "Yes" : "No — review items below"}</span>
        </div>
        <button className="btn btn-sm btn-outline-primary" onClick={exportCsv}>
          Export CSV
        </button>
      </div>
      {d.dq.issues.length > 0 && (
        <ul className="list-unstyled">
          {d.dq.issues.map((i, k) => (
            <li key={k} className={`alert alert-${i.severity === "error" ? "danger" : i.severity === "warning" ? "warning" : "info"} py-2 mb-2`}>
              {i.message}
            </li>
          ))}
        </ul>
      )}
      <h6>Completeness by subject</h6>
      <div className="table-responsive mb-4">
        <table className="table table-sm table-bordered text-center">
          <thead className="table-light">
            <tr>
              <th className="text-start">Subject</th>
              <th>Expected</th>
              <th>Valid</th>
              <th>Absent</th>
              <th>Outstanding</th>
              <th>Invalid</th>
              <th>% complete</th>
            </tr>
          </thead>
          <tbody>
            {d.dq.subjects.map((s) => (
              <tr key={s.subjectId}>
                <td className="text-start">{s.name}</td>
                <td>{s.expected}</td>
                <td>{s.valid}</td>
                <td>{s.absent}</td>
                <td className={s.outstanding ? "table-warning" : ""}>{s.outstanding}</td>
                <td className={s.invalid ? "table-danger" : ""}>{s.invalid}</td>
                <td>{pctText(s.pctComplete)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h6>Candidates without a complete aggregate ({missing.length})</h6>
      {missing.length === 0 ? (
        <div className="text-muted">None.</div>
      ) : (
        <table className="table table-sm">
          <tbody>
            {missing.map(({ c, r }) => (
              <tr key={c.id}>
                <td>{c.fullName}</td>
                <td>{c.className}</td>
                <td className="small text-muted">{r.reasons.join(" ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {d.dq.exclusions.length > 0 && (
        <>
          <h6 className="mt-3">Excluded candidates</h6>
          <ul className="small">
            {d.dq.exclusions.map((e) => (
              <li key={e.candidateId}>
                {e.name} — {e.reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* --------------------------- Status & audit tab -------------------------- */

function StatusAndAudit({ data, d, reload, setError }: { data: MockFull; d: Derived; reload: () => Promise<void>; setError: (s: string) => void }) {
  const { mock } = data;
  const isAdmin = data.role === "school_admin" || data.role === "platform_admin";
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [exceptions, setExceptions] = useState<Array<{ reason: string; by: string | null; at: string; detail: Record<string, unknown> }>>([]);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [target, setTarget] = useState(mock.targetAggregate === null ? "" : String(mock.targetAggregate));
  const [subjectTargets, setSubjectTargets] = useState<Record<string, string>>(
    Object.fromEntries(data.subjects.map((s) => [s.id, s.targetPct === null || s.targetPct === undefined ? "" : String(s.targetPct)]))
  );

  useEffect(() => {
    if (data.role === "teacher") return;
    MockExamService.audit(mock.id).then(setAudit).catch(() => undefined);
    MockExamService.exceptions(mock.id).then(setExceptions).catch(() => undefined);
  }, [mock.id, data.role, mock.status]);

  const go = async (status: MockStatus, needReason = false) => {
    if (needReason && !reason.trim()) {
      setError("Give a reason first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await MockExamService.setStatus(mock.id, status, reason || undefined, ack);
      setReason("");
      setAck(false);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^DATA_QUALITY:\s*/, "") : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  };

  const saveTargets = async () => {
    setBusy(true);
    setError("");
    try {
      await MockExamService.updateDetails(
        mock.id,
        target.trim() === "" ? null : Number(target),
        mock.notes ?? "",
        data.subjects.map((s) => ({ subjectId: s.id, targetPct: subjectTargets[s.id]?.trim() ? Number(subjectTargets[s.id]) : null }))
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save targets.");
    } finally {
      setBusy(false);
    }
  };

  const outstanding = d.dq.totalExpectedMarks - d.dq.totalAccountedMarks;
  const incomplete = data.candidates.filter((c) => c.status === "registered" && d.resultById.get(c.id)?.status !== "complete").length;

  return (
    <div>
      {isAdmin && (
        <div className="card mb-3">
          <div className="card-body">
            <h6>Status: {STATUS_LABEL[mock.status]}</h6>
            <div className="mb-2 small text-muted">
              Before finalising: {outstanding} mark(s) outstanding, {incomplete} candidate(s) without a complete aggregate.
            </div>
            <div className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label small mb-0">Reason (needed to reopen, or to finalise with exceptions)</label>
                <input className="form-control form-control-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              {(outstanding > 0 || incomplete > 0) && (
                <div className="col-md-4">
                  <div className="form-check">
                    <input id="ack" type="checkbox" className="form-check-input" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                    <label htmlFor="ack" className="form-check-label small">
                      I acknowledge the missing data and want to finalise anyway (recorded in the audit history)
                    </label>
                  </div>
                </div>
              )}
              <div className="col d-flex gap-2 flex-wrap">
                {mock.status === "draft" && (
                  <button className="btn btn-success btn-sm" disabled={busy} onClick={() => go("open")}>
                    Open for marks entry
                  </button>
                )}
                {mock.status === "open" && (
                  <>
                    <button className="btn btn-warning btn-sm" disabled={busy} onClick={() => go("entry_closed")}>
                      Close entry
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => go("draft", true)}>
                      Back to draft
                    </button>
                  </>
                )}
                {mock.status === "entry_closed" && (
                  <>
                    <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => go("finalised")}>
                      Finalise
                    </button>
                    <button className="btn btn-outline-secondary btn-sm" disabled={busy} onClick={() => go("open", true)}>
                      Reopen entry
                    </button>
                  </>
                )}
                {mock.status === "finalised" && (
                  <button className="btn btn-outline-danger btn-sm" disabled={busy} onClick={() => go("entry_closed", true)}>
                    Reopen (with reason)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdmin && mock.status !== "finalised" && (
        <div className="card mb-3">
          <div className="card-body">
            <h6>Targets</h6>
            <div className="row g-2 align-items-end">
              <div className="col-md-3">
                <label className="form-label small mb-0">Target aggregate</label>
                <input type="number" className="form-control form-control-sm" value={target} onChange={(e) => setTarget(e.target.value)} />
              </div>
              {data.subjects.map((s) => (
                <div className="col-md-2" key={s.id}>
                  <label className="form-label small mb-0 text-truncate d-block">{s.name} target %</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={subjectTargets[s.id] ?? ""}
                    onChange={(e) => setSubjectTargets({ ...subjectTargets, [s.id]: e.target.value })}
                  />
                </div>
              ))}
              <div className="col-auto">
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={saveTargets}>
                  Save targets
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {exceptions.length > 0 && (
        <div className="card mb-3">
          <div className="card-body">
            <h6>Acknowledged exceptions</h6>
            <ul className="small mb-0">
              {exceptions.map((x, i) => (
                <li key={i}>
                  {new Date(x.at).toLocaleString()} — {x.by ?? "Unknown"}: {x.reason} ({JSON.stringify(x.detail)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {data.role !== "teacher" && (
        <div className="card">
          <div className="card-body">
            <h6>Audit history</h6>
            {audit.length === 0 ? (
              <div className="text-muted small">Nothing recorded yet.</div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: 360 }}>
                <table className="table table-sm small">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Who</th>
                      <th>Action</th>
                      <th>What</th>
                      <th>Before → after</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td>{new Date(a.at).toLocaleString()}</td>
                        <td>{a.by ?? "—"}</td>
                        <td>{a.action}{a.recalculated ? " (recalculated)" : ""}</td>
                        <td>{a.entity}</td>
                        <td>
                          {a.oldValue ? JSON.stringify(a.oldValue) : "—"} → {a.newValue ? JSON.stringify(a.newValue) : "—"}
                        </td>
                        <td>{a.reason ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
