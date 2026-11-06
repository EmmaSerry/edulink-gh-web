import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CensusService } from "@services/cloud/CensusService";

/**
 * Public page where a school that is not yet on the district census sends its
 * own figures (no sign-in). Reached through the private link made by the
 * district admin: /census-submit/<token>. Everything sent waits for the
 * district admin to approve it (see STEP_census_submissions.sql).
 */

const CSS = `
.cs-page{min-height:100vh;background:linear-gradient(160deg,#0a1f44,#1c4fd0 55%,#5b3fd6);padding:18px 12px 60px;color:#10203f;font-family:"Segoe UI",Arial,sans-serif}
.cs-wrap{max-width:900px;margin:0 auto}
.cs-head{color:#fff;margin-bottom:14px}
.cs-head h1{font-size:1.7rem;font-weight:800;margin:0 0 4px}
.cs-head p{margin:0;font-size:1.05rem;color:#e6eeff}
.cs-card{background:#fff;border-radius:16px;padding:18px 18px 8px;margin-bottom:14px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.cs-card h2{font-size:1.15rem;font-weight:800;color:#0a1f44;margin:0 0 4px;padding-bottom:6px;border-bottom:3px solid #f0a500;display:inline-block}
.cs-hint{color:#33466b;font-size:.95rem;margin:6px 0 12px}
.cs-card label{display:block;font-weight:700;font-size:.95rem;margin-bottom:3px;color:#10203f}
.cs-card input,.cs-card select,.cs-card textarea{width:100%;border:1.5px solid #8aa0c8;border-radius:10px;padding:9px 11px;font-size:1rem;color:#10203f;background:#fff}
.cs-card input:focus,.cs-card select:focus{outline:3px solid rgba(28,111,235,.35);border-color:#1c6feb}
.cs-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px 14px;margin-bottom:12px}
.cs-cls{display:grid;grid-template-columns:110px 1fr 1fr 80px;gap:8px 10px;align-items:center;margin-bottom:12px}
.cs-cls .h{font-weight:800;font-size:.9rem;color:#33466b}
.cs-cls .t{font-weight:800;text-align:right;color:#0a1f44}
.cs-req{color:#c0182d}
.cs-btn{background:linear-gradient(120deg,#1c6feb,#5b3fd6);color:#fff;border:0;border-radius:12px;padding:13px 26px;font-size:1.1rem;font-weight:800;cursor:pointer}
.cs-btn:disabled{opacity:.6;cursor:wait}
.cs-err{background:#fde8ea;border:1.5px solid #c0182d;color:#7a0f1c;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-weight:600}
.cs-ok{background:#fff;border-radius:16px;padding:26px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.25)}
.cs-ref{display:inline-block;background:#eaf2fe;border:1.5px solid #8aa0c8;border-radius:10px;padding:6px 16px;font-size:1.4rem;font-weight:800;letter-spacing:.12em;color:#0a1f44;margin:8px 0}
.cs-sum{background:#eaf2fe;border-radius:12px;padding:10px 14px;margin-bottom:12px;font-weight:700;color:#0a1f44}
.cs-hp{position:absolute;left:-9999px;height:0;overflow:hidden}
@media(max-width:560px){.cs-cls{grid-template-columns:70px 1fr 1fr}.cs-cls .t{display:none}}
`;

const CLASSES: { key: string; label: string; grp: "nur" | "kg" | "pri" | "jhs" }[] = [
  { key: "nur", label: "Nursery / Creche", grp: "nur" },
  { key: "kg1", label: "KG1", grp: "kg" },
  { key: "kg2", label: "KG2", grp: "kg" },
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ key: `p${i}`, label: `B${i}`, grp: "pri" as const })),
  ...[1, 2, 3].map((i) => ({ key: `j${i}`, label: `JHS${i}`, grp: "jhs" as const })),
];

const LEVELS = [
  { v: "KG/PRIMARY ONLY", label: "KG / Primary only", show: ["nur", "kg", "pri"] },
  { v: "PRIMARY ONLY", label: "Primary only", show: ["pri"] },
  { v: "JHS ONLY", label: "JHS only", show: ["jhs"] },
  { v: "BASIC (KG, PRIMARY & JHS]", label: "Basic (KG, Primary and JHS)", show: ["nur", "kg", "pri", "jhs"] },
];

const STAFF = [
  { k: "kg", label: "KG", grp: "kg" },
  { k: "pri", label: "Primary", grp: "pri" },
  { k: "jhs", label: "JHS", grp: "jhs" },
];

type Texts = Record<string, string>;
type Nums = Record<string, string>;

function NumInput({ value, onChange, label }: { value: string | undefined; onChange: (v: string) => void; label: string }) {
  return (
    <input
      inputMode="numeric"
      aria-label={label}
      placeholder="0"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
    />
  );
}

export function CensusSubmitPage() {
  const { token = "" } = useParams();
  const [info, setInfo] = useState<{ ok: boolean; district?: string; circuits?: string[] } | null>(null);
  const [t, setT] = useState<Texts>({});
  const [n, setN] = useState<Nums>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [trap, setTrap] = useState("");

  useEffect(() => {
    CensusService.publicInfo(token)
      .then(setInfo)
      .catch(() => setInfo({ ok: false }));
  }, [token]);

  const setText = (k: string, v: string) => setT((p) => ({ ...p, [k]: v }));
  const setNum = (k: string, v: string) => setN((p) => ({ ...p, [k]: v }));
  const num = (k: string) => Number(n[k] || 0);

  const level = LEVELS.find((l) => l.v === t.school_level);
  const show = (grp: string) => !!level && level.show.includes(grp);

  const totals = useMemo(() => {
    const sum = (grp: string, sex: "b" | "g") => CLASSES.filter((c) => c.grp === grp).reduce((s, c) => s + Number(n[`${c.key}_${sex}`] || 0), 0);
    const kgB = sum("kg", "b"), kgG = sum("kg", "g"), pB = sum("pri", "b"), pG = sum("pri", "g"), jB = sum("jhs", "b"), jG = sum("jhs", "g");
    return { kgB, kgG, pB, pG, jB, jG, all: kgB + kgG + pB + pG + jB + jG };
  }, [n]);

  const clsRow = (c: (typeof CLASSES)[number]) => (
    <div className="cs-cls" key={c.key}>
      <div style={{ fontWeight: 700 }}>{c.label}</div>
      <NumInput label={`${c.label} boys`} value={n[`${c.key}_b`]} onChange={(v) => setNum(`${c.key}_b`, v)} />
      <NumInput label={`${c.label} girls`} value={n[`${c.key}_g`]} onChange={(v) => setNum(`${c.key}_g`, v)} />
      <div className="t">{num(`${c.key}_b`) + num(`${c.key}_g`)}</div>
    </div>
  );

  const text = (k: string, label: string, opts: { req?: boolean; type?: string; ph?: string } = {}) => (
    <div>
      <label>{label}{opts.req && <span className="cs-req"> *</span>}</label>
      <input type={opts.type ?? "text"} value={t[k] ?? ""} placeholder={opts.ph} onChange={(e) => setText(k, e.target.value)} />
    </div>
  );

  async function submit(e: { preventDefault: () => void }) {
    e.preventDefault();
    setErr(null);
    const need: [string, string][] = [
      ["name", "Name of school"], ["circuit", "Circuit"], ["head_name", "Name of head teacher"], ["head_phone", "Head teacher's phone number"],
      ["school_type", "School type"], ["school_level", "School level"], ["feeding", "School feeding programme"],
    ];
    const missing = need.filter(([k]) => !(t[k] ?? "").trim()).map(([, l]) => l);
    if (missing.length) {
      setErr("Please fill in: " + missing.join(", ") + ".");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (totals.all === 0) {
      setErr("Please enter the number of boys and girls in each class.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    for (const s of STAFF) {
      if (!show(s.grp)) continue;
      if (num(`tt_${s.k}_m`) > num(`t_${s.k}_m`) || num(`tt_${s.k}_f`) > num(`t_${s.k}_f`)) {
        setErr(`Trained ${s.label} teachers cannot be more than all ${s.label} teachers.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    }
    if (trap) return;
    setBusy(true);
    try {
      const keep: Record<string, string> = {};
      for (const [k, v] of Object.entries(n)) if (v !== "") keep[k] = v;
      const ref = await CensusService.publicSubmit(token, { ...t, n: keep });
      setDone(ref);
      window.scrollTo({ top: 0 });
    } catch (ex) {
      const m = ex instanceof Error ? ex.message : "Something went wrong. Please try again.";
      setErr(m.replace("ALREADY_CAPTURED:", "").trim());
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  }

  const frame = (body: JSX.Element) => (
    <div className="cs-page">
      <style>{CSS}</style>
      <div className="cs-wrap">{body}</div>
    </div>
  );

  if (info === null) return frame(<div className="cs-head"><p>Loading…</p></div>);
  if (!info.ok)
    return frame(
      <div className="cs-ok">
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>This link is not active</h1>
        <p>Please ask the District Education Office for a new school census link.</p>
      </div>,
    );

  if (done)
    return frame(
      <div className="cs-ok">
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#0a7a3d" }}>Thank you. Your data has been received.</h1>
        <p>The District Education Office will check it and add your school to the district census.</p>
        <div>Your reference number</div>
        <div className="cs-ref">{done}</div>
        <p style={{ color: "#33466b" }}>Keep this number in case the office needs to contact you.</p>
        <button type="button" className="cs-btn" onClick={() => { setDone(null); setT({}); setN({}); }}>Send data for another school</button>
      </div>,
    );

  return frame(
    <>
      <div className="cs-head">
        <h1>School census form</h1>
        <p>Ghana Education Service, {info.district}. For schools not yet on the district census. Enrolment and statistics 2026/2027.</p>
      </div>
      <form onSubmit={submit} noValidate>
        {err && <div className="cs-err">{err}</div>}
        <div className="cs-hp" aria-hidden="true"><label>Leave empty<input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} /></label></div>

        <div className="cs-card">
          <h2>1. The school</h2>
          <div className="cs-hint">Fields marked * must be filled in.</div>
          <div className="cs-grid">
            {text("name", "Name of school", { req: true, ph: "e.g. ACHICHIRE D/A BASIC" })}
            {text("community", "Location of school (community)")}
            {text("emis_code", "EMIS code")}
            {text("gps", "School GPS address", { ph: "WW-XXXX-XXXX" })}
            {text("established", "Date established", { type: "date" })}
            <div>
              <label>Circuit<span className="cs-req"> *</span></label>
              <select value={t.circuit ?? ""} onChange={(e) => setText("circuit", e.target.value)}>
                <option value="">Choose…</option>
                {(info.circuits ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label>School type<span className="cs-req"> *</span></label>
              <select value={t.school_type ?? ""} onChange={(e) => setText("school_type", e.target.value)}>
                <option value="">Choose…</option>
                <option value="PUBLIC">Public</option>
                <option value="PRIVATE">Private</option>
              </select>
            </div>
            <div>
              <label>School level<span className="cs-req"> *</span></label>
              <select value={t.school_level ?? ""} onChange={(e) => setText("school_level", e.target.value)}>
                <option value="">Choose…</option>
                {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label>Is the school on the school feeding programme?<span className="cs-req"> *</span></label>
              <select value={t.feeding ?? ""} onChange={(e) => setText("feeding", e.target.value)}>
                <option value="">Choose…</option>
                <option value="YES">Yes</option>
                <option value="NO">No</option>
              </select>
            </div>
            {text("school_email", "Institutional email of the school", { type: "email" })}
          </div>
        </div>

        <div className="cs-card">
          <h2>2. Head teacher</h2>
          <div className="cs-hint">Only the contact details the district needs. Please do not enter Ghana Card, bank or date-of-birth details.</div>
          <div className="cs-grid">
            {text("head_name", "Name of head teacher", { req: true })}
            <div>
              <label>Sex</label>
              <select value={t.head_sex ?? ""} onChange={(e) => setText("head_sex", e.target.value)}>
                <option value="">Choose…</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            {text("head_phone", "Contact number of head teacher", { req: true, type: "tel" })}
            {text("head_email", "Email of head teacher", { type: "email" })}
          </div>
        </div>

        {level && (
          <>
            <div className="cs-card">
              <h2>3. Pupils (boys and girls in each class)</h2>
              <div className="cs-hint">Enter 0 where a class has no pupils.</div>
              <div className="cs-cls"><div className="h">Class</div><div className="h">Boys</div><div className="h">Girls</div><div className="h" style={{ textAlign: "right" }}>Total</div></div>
              {CLASSES.filter((c) => show(c.grp)).map(clsRow)}
              <div className="cs-sum">
                {show("kg") && <>KG: {totals.kgB + totals.kgG} &nbsp;</>}
                {show("pri") && <>Primary: {totals.pB + totals.pG} &nbsp;</>}
                {show("jhs") && <>JHS: {totals.jB + totals.jG} &nbsp;</>}
                | All pupils (without Nursery/Creche): {totals.all}
              </div>
            </div>

            <div className="cs-card">
              <h2>4. Teachers</h2>
              <div className="cs-hint">Trained teachers are those with a teaching qualification. They cannot be more than all teachers.</div>
              {STAFF.filter((s) => show(s.grp)).map((s) => (
                <div key={s.k} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, color: "#0a1f44", marginBottom: 4 }}>{s.label}</div>
                  <div className="cs-grid">
                    <div><label>Male teachers</label><NumInput label={`${s.label} male teachers`} value={n[`t_${s.k}_m`]} onChange={(v) => setNum(`t_${s.k}_m`, v)} /></div>
                    <div><label>Female teachers</label><NumInput label={`${s.label} female teachers`} value={n[`t_${s.k}_f`]} onChange={(v) => setNum(`t_${s.k}_f`, v)} /></div>
                    <div><label>Male trained teachers</label><NumInput label={`${s.label} male trained`} value={n[`tt_${s.k}_m`]} onChange={(v) => setNum(`tt_${s.k}_m`, v)} /></div>
                    <div><label>Female trained teachers</label><NumInput label={`${s.label} female trained`} value={n[`tt_${s.k}_f`]} onChange={(v) => setNum(`tt_${s.k}_f`, v)} /></div>
                  </div>
                </div>
              ))}
              <div className="cs-grid">
                {([["nss_m", "Male NSS personnel"], ["nss_f", "Female NSS personnel"], ["cta_m", "Male community teaching assistants"], ["cta_f", "Female community teaching assistants"], ["pupil_teachers", "Pupil teachers"]] as [string, string][]).map(([k, l]) => (
                  <div key={k}><label>{l}</label><NumInput label={l} value={n[k]} onChange={(v) => setNum(k, v)} /></div>
                ))}
              </div>
            </div>

            <div className="cs-card">
              <h2>5. Classrooms and furniture</h2>
              <div className="cs-grid">
                {([
                  ["room_kg", "Classrooms for KG", "kg"], ["room_pri", "Classrooms for Primary", "pri"], ["room_jhs", "Classrooms for JHS", "jhs"],
                  ["desk_hex", "Hexagonal desks (KG)", "kg"], ["desk_dual", "Dual desks (Primary)", "pri"], ["desk_mono", "Mono desks (JHS)", "jhs"],
                  ["chairs", "Teachers' chairs", ""], ["tables", "Teachers' tables", ""], ["indiscipline", "Number of indiscipline issues in the school", ""],
                ] as [string, string, string][])
                  .filter(([, , g]) => !g || show(g))
                  .map(([k, l]) => (
                    <div key={k}><label>{l}</label><NumInput label={l} value={n[k]} onChange={(v) => setNum(k, v)} /></div>
                  ))}
              </div>
            </div>
          </>
        )}

        {!level && <div className="cs-card"><div className="cs-hint" style={{ fontWeight: 700 }}>Choose the school level above to continue with pupils, teachers and classrooms.</div></div>}

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button type="submit" className="cs-btn" disabled={busy}>{busy ? "Sending…" : "Submit school data"}</button>
        </div>
      </form>
    </>,
  );
}
