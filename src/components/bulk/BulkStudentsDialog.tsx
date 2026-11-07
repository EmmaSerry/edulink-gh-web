import { useEffect, useMemo, useRef, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudAcademicYearService } from "@services/cloud/AcademicYearService";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { BulkStudentService } from "@services/cloud/BulkStudentService";
import { downloadStudentTemplate } from "./studentTemplate";
import { readXlsx } from "./xlsxReader";
import { MAX_ROWS, checkRow, dupKey, isEmptyRow, type GoodRow, type RawRow } from "./studentRules";
import type { AcademicYearRow, ClassRow, LevelRow, TermRow } from "@/types/database";

/**
 * School admin: bulk student onboarding from the Excel template, opened from the
 * Students page. Download the template, fill it in, upload it, check the preview, import.
 * Part of the main EduLink GH school system only.
 */
interface Line {
  n: number; // spreadsheet row number
  raw: RawRow;
  state: "ok" | "dup" | "error";
  message: string;
  good?: GoodRow;
}
type Outcome = { n: number; name: string; ok: boolean; message: string };

const fmtDate = (iso: string) => iso.split("-").reverse().join("/");

export function BulkStudentsDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { profile } = useCloudAuth();
  const isSchoolAdmin = profile?.role === "school_admin" && !!profile.school_id;

  const [year, setYear] = useState<AcademicYearRow | null>(null);
  const [term, setTerm] = useState<TermRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [schoolName, setSchoolName] = useState("School");
  const [ready, setReady] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [fileName, setFileName] = useState("");
  const [lines, setLines] = useState<Line[] | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [includeDups, setIncludeDups] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Outcome[] | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSchoolAdmin) {
      setReady(true);
      return;
    }
    const sid = profile?.school_id;
    Promise.all([
      CloudAcademicYearService.getCurrent(sid),
      CloudTermService.getActive(sid),
      CloudLevelService.list(sid),
      CloudClassService.list(undefined, sid),
      CloudStudentService.list(),
      CloudSchoolService.getProfile().catch(() => null),
    ])
      .then(([y, t, lv, cl, st, sc]) => {
        setYear(y);
        setTerm(t);
        setLevels(lv);
        setClasses(cl);
        setExisting(new Set(st.map((s) => dupKey(String((s as unknown as Record<string, unknown>).first_name ?? ""), String((s as unknown as Record<string, unknown>).last_name ?? ""), String((s as unknown as Record<string, unknown>).date_of_birth ?? "").slice(0, 10)))));
        setSchoolName(((sc as unknown as { name?: string } | null)?.name ?? "School") || "School");
      })
      .catch((e) => setLoadErr(e instanceof Error ? e.message : "Could not load your school's setup."))
      .finally(() => setReady(true));
  }, [isSchoolAdmin, profile?.school_id]);

  // class label = its name, or "Level - name" if two levels share a class name
  const labelled = useMemo(() => {
    const count = new Map<string, number>();
    for (const c of classes) count.set(c.name.toLowerCase(), (count.get(c.name.toLowerCase()) ?? 0) + 1);
    return classes.map((c) => ({ c, label: (count.get(c.name.toLowerCase()) ?? 0) > 1 ? `${levels.find((l) => l.id === c.level_id)?.name ?? "Level"} - ${c.name}` : c.name }));
  }, [classes, levels]);
  const classLabels = labelled.map((x) => x.label);

  function downloadTemplate() {
    downloadStudentTemplate({ school: schoolName, year: year?.label ?? "", term: term?.term_name ?? "", classLabels });
  }

  async function onFile(file: File) {
    setFileErr(null);
    setLines(null);
    setResults(null);
    setFileName(file.name);
    try {
      const sheets = await readXlsx(await file.arrayBuffer());
      const sh = sheets.find((s) => s.name.toLowerCase() === "students");
      if (!sh) throw new Error('This is not the EduLink GH template: there is no "Students" sheet. Please download the template again.');
      const head = String(sh.rows[0]?.[0] ?? "").toLowerCase();
      if (!head.startsWith("first name")) throw new Error("The headings in row 1 have been changed. Please use the template as downloaded.");
      const seen = new Map<string, number>();
      const out: Line[] = [];
      // row 1 = headings, row 2 = the example (always ignored); learners start at row 3
      for (let i = 2; i < sh.rows.length && out.length < MAX_ROWS; i++) {
        const r = sh.rows[i] ?? [];
        const raw: RawRow = { first: r[0] ?? null, middle: r[1] ?? null, last: r[2] ?? null, gender: r[3] ?? null, dob: r[4] ?? null, cls: r[5] ?? null, gname: r[6] ?? null, rel: r[7] ?? null, phone: r[8] ?? null };
        if (isEmptyRow(raw)) continue;
        const res = checkRow(raw, classLabels);
        if (!res.ok) {
          out.push({ n: i + 1, raw, state: "error", message: res.error });
          continue;
        }
        const key = dupKey(res.value.first, res.value.last, res.value.dob);
        if (seen.has(key)) out.push({ n: i + 1, raw, state: "error", message: `Same learner as row ${seen.get(key)} in this file`, good: res.value });
        else if (existing.has(key)) {
          seen.set(key, i + 1);
          out.push({ n: i + 1, raw, state: "dup", message: "Already registered in your school", good: res.value });
        } else {
          seen.set(key, i + 1);
          out.push({ n: i + 1, raw, state: "ok", message: "Ready", good: res.value });
        }
      }
      if (out.length === 0) throw new Error("No learners found. Fill in the Students sheet from row 3 downwards.");
      setLines(out);
    } catch (e) {
      setFileErr(e instanceof Error ? e.message : "Could not read this file.");
    }
  }

  const counts = useMemo(() => {
    const l = lines ?? [];
    return { ok: l.filter((x) => x.state === "ok").length, dup: l.filter((x) => x.state === "dup").length, error: l.filter((x) => x.state === "error").length };
  }, [lines]);
  const toImport = (lines ?? []).filter((x) => x.good && (x.state === "ok" || (includeDups && x.state === "dup")));

  async function runImport() {
    if (!year || !term || !profile?.school_id) return;
    setBusy(true);
    setProgress(0);
    const out: Outcome[] = [];
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < toImport.length) {
        const ln = toImport[next++];
        const g = ln.good as GoodRow;
        const cl = labelled.find((x) => x.label === g.cls)?.c;
        const name = `${g.first} ${g.last}`;
        try {
          if (!cl) throw new Error("Class not found");
          await BulkStudentService.registerRow({
            schoolId: profile.school_id as string,
            firstName: g.first,
            middleName: g.middle,
            lastName: g.last,
            gender: g.gender,
            dateOfBirth: g.dob,
            academicYearId: year.id,
            termId: term.id,
            levelId: cl.level_id,
            classId: cl.id,
            guardianFullName: g.gname,
            guardianRelationship: g.rel,
            guardianPhone: g.phone,
          });
          out.push({ n: ln.n, name, ok: true, message: "Registered" });
        } catch (e) {
          out.push({ n: ln.n, name, ok: false, message: e instanceof Error ? e.message : "Failed" });
        }
        done++;
        setProgress(done);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    out.sort((a, b) => a.n - b.n);
    setResults(out);
    setBusy(false);
    setLines(null);
    if (out.some((r) => r.ok)) onImported();
  }

  const shell = (body: JSX.Element) => (
    <div className="modal d-block" style={{ background: "rgba(0,0,0,.6)", overflow: "auto" }} onClick={() => { if (!busy) onClose(); }}>
      <div className="modal-dialog modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content p-3">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h1 className="h4 mb-0">Bulk student onboarding</h1>
              <div className="small">{schoolName}{year ? ` · ${year.label}` : ""}{term ? ` · ${term.term_name}` : ""}</div>
            </div>
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy} onClick={onClose}>Close</button>
          </div>
          {body}
        </div>
      </div>
    </div>
  );

  if (!ready) return shell(<p className="text-muted">Loading…</p>);
  if (!isSchoolAdmin) return shell(<div className="alert alert-info">Bulk onboarding is for school admins. Please sign in with your school admin account.</div>);
  if (loadErr) return shell(<div className="alert alert-danger">{loadErr}</div>);
  if (!year || !term) return shell(<div className="alert alert-warning">Your school needs a current academic year and an active term before students can be registered (Settings &gt; Academic).</div>);

  const shown = (lines ?? []).filter((l) => !onlyProblems || l.state !== "ok");

  return shell(
    <div>
      <div className="row g-3 mb-3">
        <div className="col-lg-6">
          <div className="actrs-card p-3 h-100">
            <div className="fw-bold mb-1">Step 1: Download the template</div>
            <p className="small mb-2">An Excel file made for your school. It opens on a user guide, has drop-down lists for your classes, and checks every row as you type or paste.</p>
            {classLabels.length === 0 && <div className="alert alert-warning py-2 small">You have no classes yet. Add them under Settings &gt; Classes first.</div>}
            <button type="button" className="btn btn-primary" onClick={downloadTemplate}>
              <i className="bi bi-file-earmark-spreadsheet me-1" />Download Excel template
            </button>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="actrs-card p-3 h-100">
            <div className="fw-bold mb-1">Step 2: Upload the filled template</div>
            <p className="small mb-2">Up to {MAX_ROWS} learners per file. Row 2 (the example) is ignored. Nothing is saved until you press Import.</p>
            <input ref={inputRef} type="file" accept=".xlsx" className="form-control" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} />
            {fileErr && <div className="alert alert-danger py-2 small mt-2 mb-0">{fileErr}</div>}
          </div>
        </div>
      </div>

      {lines && (
        <div className="actrs-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <div className="fw-bold me-2">Step 3: Check and import ({fileName})</div>
            <span className="badge bg-success fs-6">{counts.ok} ready</span>
            {counts.dup > 0 && <span className="badge bg-warning text-dark fs-6">{counts.dup} already registered</span>}
            {counts.error > 0 && <span className="badge bg-danger fs-6">{counts.error} to fix</span>}
          </div>
          <div className="d-flex flex-wrap gap-3 align-items-center mb-2 small">
            <label className="d-flex gap-2 align-items-center"><input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />Show only rows with a problem</label>
            {counts.dup > 0 && <label className="d-flex gap-2 align-items-center"><input type="checkbox" checked={includeDups} onChange={(e) => setIncludeDups(e.target.checked)} />Register the "already registered" ones again anyway</label>}
          </div>
          <div className="table-responsive" style={{ maxHeight: 420, overflow: "auto" }}>
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr><th>Row</th><th>Name</th><th>Gender</th><th>Born</th><th>Class</th><th>Parent / guardian</th><th>Phone</th><th>Check</th></tr>
              </thead>
              <tbody>
                {shown.map((l) => (
                  <tr key={l.n} style={{ boxShadow: `inset 4px 0 0 ${l.state === "ok" ? "#198754" : l.state === "dup" ? "#f0a500" : "#dc3545"}` }}>
                    <td>{l.n}</td>
                    <td className="fw-semibold">{l.good ? `${l.good.first} ${l.good.middle} ${l.good.last}` : [l.raw.first, l.raw.last].filter(Boolean).join(" ") || "-"}</td>
                    <td>{l.good ? (l.good.gender === "M" ? "Male" : "Female") : String(l.raw.gender ?? "")}</td>
                    <td>{l.good ? fmtDate(l.good.dob) : String(l.raw.dob ?? "")}</td>
                    <td>{l.good?.cls ?? String(l.raw.cls ?? "")}</td>
                    <td>{l.good ? `${l.good.gname} (${l.good.rel})` : String(l.raw.gname ?? "")}</td>
                    <td>{l.good?.phone ?? String(l.raw.phone ?? "")}</td>
                    <td><span className={`badge ${l.state === "ok" ? "bg-success" : l.state === "dup" ? "bg-warning text-dark" : "bg-danger"}`}>{l.message}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {counts.error > 0 && <div className="small mt-2">Fix the red rows in your Excel file and upload it again, or import the ready ones now and add the rest later.</div>}
          <div className="d-flex flex-wrap gap-2 align-items-center mt-3">
            <button type="button" className="btn btn-success" disabled={busy || toImport.length === 0} onClick={runImport}>
              {busy ? `Importing ${progress} of ${toImport.length}…` : `Import ${toImport.length} learner${toImport.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" className="btn btn-outline-primary" disabled={busy} onClick={() => { setLines(null); setFileName(""); if (inputRef.current) inputRef.current.value = ""; }}>Cancel</button>
            {busy && (
              <div className="flex-grow-1" style={{ minWidth: 160 }}>
                <div className="progress"><div className="progress-bar" style={{ width: `${toImport.length ? (progress / toImport.length) * 100 : 0}%` }} /></div>
              </div>
            )}
          </div>
        </div>
      )}

      {results && (
        <div className="actrs-card p-3 mb-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
            <div className="fw-bold">Import finished</div>
            <span className="badge bg-success fs-6">{results.filter((r) => r.ok).length} registered</span>
            {results.some((r) => !r.ok) && <span className="badge bg-danger fs-6">{results.filter((r) => !r.ok).length} failed</span>}
          </div>
          {results.some((r) => !r.ok) && (
            <ul className="small">
              {results.filter((r) => !r.ok).map((r) => <li key={r.n}>Row {r.n} ({r.name}): {r.message}</li>)}
            </ul>
          )}
          <p className="small mb-2">Photos and other details can now be added from each learner's profile, or with Photo import.</p>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
            <button type="button" className="btn btn-outline-primary" onClick={() => { setResults(null); setFileName(""); if (inputRef.current) inputRef.current.value = ""; }}>Upload another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
