import { useEffect, useMemo, useState } from "react";
import { CensusService, type FeeRates } from "@services/cloud/CensusService";
import { downloadCsv } from "@/lib/csvExport";
import { downloadXlsx } from "./xlsxWriter";
import { escHtml, openPrint } from "./censusPrint";
import { fmt, g, titleCase, type CensusRow } from "./censusModel";

/**
 * Sports affiliation fees (Super Admin only). Amount per pupil x pupils from
 * Primary and JHS (KG and Nursery/Creche are NOT counted).
 *  - Each school pays its circuit (school by school)
 *  - Each circuit pays the district (circuit by circuit)
 *  - Or any group of schools you tick pays the district as one group
 */
type Mode = "school" | "circuit" | "group";
type Cell = string | number;

const money = (v: number) => "GH₵ " + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pupilsOf = (r: CensusRow) => g(r.n as Record<string, number>, "pri_b") + g(r.n as Record<string, number>, "pri_g") + g(r.n as Record<string, number>, "jhs_b") + g(r.n as Record<string, number>, "jhs_g");
const priOf = (r: CensusRow) => g(r.n as Record<string, number>, "pri_b") + g(r.n as Record<string, number>, "pri_g");
const jhsOf = (r: CensusRow) => g(r.n as Record<string, number>, "jhs_b") + g(r.n as Record<string, number>, "jhs_g");
const num = (s: string): number => {
  const v = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(v) && v >= 0 ? v : 0;
};

export function CensusSportsFees({ rows, districtId }: { rows: CensusRow[]; districtId: string }) {
  const [cRate, setCRate] = useState("0");
  const [dRate, setDRate] = useState("0");
  const [ov, setOv] = useState<Record<string, { c: string; d: string }>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showOv, setShowOv] = useState(false);

  const [mode, setMode] = useState<Mode>("school");
  const [circuit, setCircuit] = useState("");
  const [type, setType] = useState("");
  const [find, setFind] = useState("");
  const [off, setOff] = useState<Set<string>>(new Set());
  const [groupRate, setGroupRate] = useState("");

  useEffect(() => {
    CensusService.feeRates()
      .then((r: FeeRates | null) => {
        if (!r) return;
        setCRate(String(r.circuit_rate));
        setDRate(String(r.district_rate));
        const o: Record<string, { c: string; d: string }> = {};
        for (const [k, v] of Object.entries(r.overrides ?? {})) o[k] = { c: v.c !== undefined ? String(v.c) : "", d: v.d !== undefined ? String(v.d) : "" };
        setOv(o);
      })
      .catch(() => setErr("Fee rates could not be loaded. Run STEP_census_fees.sql in Supabase first (see HOW_TO_APPLY)."));
  }, []);

  const circuits = useMemo(() => Array.from(new Set(rows.map((r) => r.circuit ?? "").filter(Boolean))).sort(), [rows]);

  const pool = useMemo(() => {
    const q = find.trim().toLowerCase();
    return rows.filter((r) => (!circuit || r.circuit === circuit) && (!type || r.school_type === type) && (!q || r.name.toLowerCase().includes(q)));
  }, [rows, circuit, type, find]);
  const chosen = useMemo(() => pool.filter((r) => !off.has(r.id)), [pool, off]);

  const rateC = (c: string | null) => (c && ov[c]?.c !== "" && ov[c]?.c !== undefined ? num(ov[c].c) : num(cRate));
  const rateD = (c: string | null) => (c && ov[c]?.d !== "" && ov[c]?.d !== undefined ? num(ov[c].d) : num(dRate));
  const gRate = groupRate.trim() === "" ? num(dRate) : num(groupRate);

  const table = useMemo(() => {
    let headers: string[] = [];
    let body: Cell[][] = [];
    let total: Cell[] = [];
    let title = "";
    let numericFrom = 2;
    if (mode === "school") {
      title = "Sports affiliation fees: schools to their circuit";
      headers = ["School", "Circuit", "Primary pupils", "JHS pupils", "Pupils counted", "Rate per pupil (GH₵)", "Fee payable to circuit (GH₵)"];
      const list = [...chosen].sort((a, b) => (a.circuit ?? "").localeCompare(b.circuit ?? "") || a.name.localeCompare(b.name));
      body = list.map((r) => [r.name, titleCase(r.circuit), priOf(r), jhsOf(r), pupilsOf(r), rateC(r.circuit), Math.round(pupilsOf(r) * rateC(r.circuit) * 100) / 100]);
      total = ["TOTAL", `${list.length} school(s)`, list.reduce((s, r) => s + priOf(r), 0), list.reduce((s, r) => s + jhsOf(r), 0), list.reduce((s, r) => s + pupilsOf(r), 0), "", Math.round(list.reduce((s, r) => s + pupilsOf(r) * rateC(r.circuit), 0) * 100) / 100];
    } else if (mode === "circuit") {
      title = "Sports affiliation fees: circuits to the district";
      headers = ["Circuit", "Schools", "Primary pupils", "JHS pupils", "Pupils counted", "Rate per pupil (GH₵)", "Fee payable to district (GH₵)"];
      numericFrom = 1;
      const by = new Map<string, CensusRow[]>();
      for (const r of chosen) by.set(r.circuit ?? "NOT STATED", [...(by.get(r.circuit ?? "NOT STATED") ?? []), r]);
      const keys = Array.from(by.keys()).sort();
      body = keys.map((k) => {
        const l = by.get(k) ?? [];
        const p = l.reduce((s, r) => s + pupilsOf(r), 0);
        return [titleCase(k), l.length, l.reduce((s, r) => s + priOf(r), 0), l.reduce((s, r) => s + jhsOf(r), 0), p, rateD(k), Math.round(p * rateD(k) * 100) / 100];
      });
      total = ["TOTAL", chosen.length, chosen.reduce((s, r) => s + priOf(r), 0), chosen.reduce((s, r) => s + jhsOf(r), 0), chosen.reduce((s, r) => s + pupilsOf(r), 0), "", Math.round(body.reduce((s, r) => s + (r[6] as number), 0) * 100) / 100];
    } else {
      title = "Sports affiliation fees: selected group of schools to the district";
      headers = ["School", "Circuit", "Primary pupils", "JHS pupils", "Pupils counted", "Rate per pupil (GH₵)", "Fee payable (GH₵)"];
      const list = [...chosen].sort((a, b) => a.name.localeCompare(b.name));
      body = list.map((r) => [r.name, titleCase(r.circuit), priOf(r), jhsOf(r), pupilsOf(r), gRate, Math.round(pupilsOf(r) * gRate * 100) / 100]);
      total = ["GROUP TOTAL", `${list.length} school(s)`, list.reduce((s, r) => s + priOf(r), 0), list.reduce((s, r) => s + jhsOf(r), 0), list.reduce((s, r) => s + pupilsOf(r), 0), gRate, Math.round(list.reduce((s, r) => s + pupilsOf(r) * gRate, 0) * 100) / 100];
    }
    return { title, headers, body, total, numericFrom };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, chosen, cRate, dRate, ov, gRate]);

  const scope = [circuit ? `${titleCase(circuit)} circuit` : "All circuits", type ? titleCase(type) : "Public and private", `${chosen.length} of ${pool.length} schools selected`].join(" | ");
  const sub = `${scope}. Pupils counted = Primary + JHS (KG and Nursery/Creche excluded).`;
  const fileBase = `${circuit ? titleCase(circuit) + " Circuit" : "Wassa Amenfi Central"} - ${table.title}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

  const fmtCell = (c: Cell, ci: number, isRate: boolean) => (typeof c === "number" ? (isRate || ci === table.headers.length - 1 ? money(c) : fmt(c)) : c);

  function cells(r: Cell[]): Cell[] {
    return r;
  }

  function printIt() {
    const head = table.headers.map((h, i) => `<th${i >= table.numericFrom ? ' style="text-align:right"' : ""}>${escHtml(h)}</th>`).join("");
    const trs = [...table.body, table.total]
      .map((r, ri, arr) => `<tr${ri === arr.length - 1 ? ' style="font-weight:800;background:#eef3fb"' : ""}>${r.map((c, ci) => `<td${ci >= table.numericFrom ? ' style="text-align:right"' : ""}>${escHtml(String(typeof c === "number" ? fmtCell(c, ci, ci === table.headers.length - 2) : c))}</td>`).join("")}</tr>`)
      .join("");
    openPrint({
      title: table.title,
      subtitle: sub,
      chips: [scope, mode === "group" ? `Group rate GH₵ ${gRate}` : ""].filter(Boolean),
      kpis: [
        { label: "Schools", value: fmt(chosen.length) },
        { label: "Pupils counted", value: fmt(chosen.reduce((s, r) => s + pupilsOf(r), 0)) },
        { label: "Total fee", value: money(table.total[6] as number) },
      ],
      bodyHtml: `<table><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table>`,
      landscape: true,
    });
  }

  async function saveRates() {
    setErr(null);
    setSaved(null);
    try {
      const o: FeeRates["overrides"] = {};
      for (const [k, v] of Object.entries(ov)) {
        if (v.c === "" && v.d === "") continue;
        o[k] = {};
        if (v.c !== "") o[k].c = num(v.c);
        if (v.d !== "") o[k].d = num(v.d);
      }
      await CensusService.saveFeeRates(districtId, num(cRate), num(dRate), o);
      setSaved("Rates saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save the rates.");
    }
  }

  const setO = (c: string, k: "c" | "d", v: string) => setOv((p) => ({ ...p, [c]: { c: p[c]?.c ?? "", d: p[c]?.d ?? "", [k]: v.replace(/[^0-9.]/g, "") } }));

  return (
    <div>
      {err && <div className="alert alert-danger">{err}</div>}

      <div className="actrs-card cx-glass p-3 mb-3">
        <div className="cx-title mb-2">1. Set the fees (amount per pupil, KG and Nursery/Creche excluded)</div>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label className="small fw-semibold">Each school pays its circuit (GH₵ per pupil)</label>
            <input className="form-control form-control-sm" inputMode="decimal" value={cRate} onChange={(e) => setCRate(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div className="col-md-4">
            <label className="small fw-semibold">Each circuit pays the district (GH₵ per pupil)</label>
            <input className="form-control form-control-sm" inputMode="decimal" value={dRate} onChange={(e) => setDRate(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
          <div className="col-md-4 d-flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={saveRates}>Save rates</button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowOv((v) => !v)}>{showOv ? "Hide" : "Different amount for a circuit"}</button>
          </div>
        </div>
        {saved && <div className="small mt-2 fw-semibold">{saved}</div>}
        {showOv && (
          <div className="table-responsive mt-3">
            <div className="small mb-1">Leave a box empty to use the amounts above.</div>
            <table className="table table-sm align-middle mb-0">
              <thead><tr><th>Circuit</th><th>School to circuit (GH₵)</th><th>Circuit to district (GH₵)</th></tr></thead>
              <tbody>
                {circuits.map((c) => (
                  <tr key={c}>
                    <td>{titleCase(c)}</td>
                    <td><input className="form-control form-control-sm" style={{ maxWidth: 140 }} inputMode="decimal" value={ov[c]?.c ?? ""} onChange={(e) => setO(c, "c", e.target.value)} placeholder={cRate} /></td>
                    <td><input className="form-control form-control-sm" style={{ maxWidth: 140 }} inputMode="decimal" value={ov[c]?.d ?? ""} onChange={(e) => setO(c, "d", e.target.value)} placeholder={dRate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="small mt-1">Press "Save rates" to keep these.</div>
          </div>
        )}
      </div>

      <div className="actrs-card cx-glass p-3 mb-3">
        <div className="cx-title mb-2">2. Choose the report and the schools</div>
        <div className="d-flex flex-wrap gap-2 mb-2">
          {([["school", "Schools pay circuit (school by school)"], ["circuit", "Circuits pay district (circuit by circuit)"], ["group", "Group of schools pays district"]] as [Mode, string][]).map(([m, l]) => (
            <span key={m} className={`cx-chip ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>{l}</span>
          ))}
        </div>
        {mode === "group" && (
          <div className="mb-2" style={{ maxWidth: 360 }}>
            <label className="small fw-semibold">Rate for this group (GH₵ per pupil). Empty = the district amount above</label>
            <input className="form-control form-control-sm" inputMode="decimal" value={groupRate} onChange={(e) => setGroupRate(e.target.value.replace(/[^0-9.]/g, ""))} placeholder={dRate} />
          </div>
        )}
        <div className="row g-2 mb-2">
          <div className="col-md-4">
            <select className="form-select form-select-sm" value={circuit} onChange={(e) => { setCircuit(e.target.value); setOff(new Set()); }}>
              <option value="">All circuits</option>
              {circuits.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Public and private</option>
              <option value="PUBLIC">Public only</option>
              <option value="PRIVATE">Private only</option>
            </select>
          </div>
          <div className="col-md-5">
            <input className="form-control form-control-sm" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a school in this list…" />
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <span className="small fw-semibold">{chosen.length} of {pool.length} schools ticked</span>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOff(new Set())}>Tick all</button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOff(new Set(pool.map((r) => r.id)))}>Untick all</button>
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setOff(new Set(pool.filter((r) => !off.has(r.id)).map((r) => r.id)))}>Swap ticks</button>
        </div>
        <div style={{ maxHeight: 230, overflow: "auto" }} className="row g-1">
          {pool.map((r) => (
            <label key={r.id} className="col-md-6 col-xl-4 d-flex align-items-center gap-2 small" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={!off.has(r.id)} onChange={() => setOff((p) => { const n = new Set(p); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
              <span>{r.name} <span className="text-muted">({fmt(pupilsOf(r))})</span></span>
            </label>
          ))}
        </div>
      </div>

      <div className="actrs-card p-3">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div>
            <div className="cx-title">{table.title}</div>
            <div className="small">{sub}</div>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => downloadCsv(`${fileBase}.csv`, table.headers, [...table.body, table.total].map(cells))}>CSV</button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => downloadXlsx(`${fileBase}.xlsx`, { sheetName: "Sports fees", title: table.title, subtitle: sub, headers: table.headers, rows: table.body, total: table.total, numericFrom: table.numericFrom })}>Excel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={printIt}><i className="bi bi-printer me-1" />Print / PDF</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead><tr>{table.headers.map((h, i) => <th key={h} className={i >= table.numericFrom ? "text-end" : ""}>{h}</th>)}</tr></thead>
            <tbody>
              {table.body.map((r, ri) => (
                <tr key={ri}>{r.map((c, ci) => <td key={ci} className={ci >= table.numericFrom ? "text-end" : ""}>{fmtCell(c, ci, ci === table.headers.length - 2)}</td>)}</tr>
              ))}
              {table.body.length === 0 && <tr><td colSpan={table.headers.length} className="text-center text-muted py-3">No schools ticked.</td></tr>}
              <tr className="fw-bold">{table.total.map((c, ci) => <td key={ci} className={ci >= table.numericFrom ? "text-end" : ""}>{typeof c === "number" ? fmtCell(c, ci, ci === table.headers.length - 2) : c}</td>)}</tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
