import { useEffect, useMemo, useState } from "react";
import { CensusService, type FeeAccount, type FeePayment } from "@services/cloud/CensusService";
import { downloadCsv } from "@/lib/csvExport";
import { downloadTablePdf } from "@components/census/pdfWriter";
import { downloadFeeWorkbook } from "@components/census/censusWorkbook";
import { downloadXlsx } from "@components/census/xlsxWriter";
import { escHtml, openPrint } from "@components/census/censusPrint";
import { Aurora, CensusFx, Count } from "@components/census/censusFx";
import { ChartCard, COLORS, Donut, LineChart, StackedHBars } from "@components/census/CensusCharts";
import { fmt, g, titleCase, type CensusRow } from "@components/census/censusModel";

/**
 * Sports affiliation fee accounts (Super Admin only).
 * One rate: the amount per pupil each school collects (Primary + JHS; KG and
 * Nursery/Creche are not counted). A circuit owes the district the sum of its
 * schools' fees. Extra accounts (a 13th circuit) can be made from chosen schools.
 */
const money = (v: number) => "GH₵ " + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const r2 = (v: number) => Math.round(v * 100) / 100;
const N = (r: CensusRow, k: string) => g(r.n as Record<string, number>, k);
const priOf = (r: CensusRow) => N(r, "pri_b") + N(r, "pri_g");
const jhsOf = (r: CensusRow) => N(r, "jhs_b") + N(r, "jhs_g");
const pupilsOf = (r: CensusRow) => priOf(r) + jhsOf(r);
const num = (s: string) => {
  const v = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(v) && v > 0 ? v : 0;
};
// The private schools the Super Admin listed (they form the 13th group)
const PRIVATE_NAMES = [
  "ANKASIE EBENEZER PREP", "ANKASIE ODILIA BASIC SCHOOL", "DOMINASE PEACE", "HOLY MOUNT EDUCATIONAL COMPLEX",
  "JOYLIFE INT SCHOOL", "NEW NATION PREPARATORY SCHOOL", "QUEEN BEATRIX INTERNATIONAL SCHOOL",
];
const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const today = () => new Date().toISOString().slice(0, 10);

interface Acct {
  key: string;
  name: string;
  custom: FeeAccount | null;
  schools: CensusRow[];
  enrol: number;
  payable: number;
  paid: number;
  balance: number;
  status: "paid" | "owing" | "none";
}

export function CloudSportsFeeAccounts() {
  const [rows, setRows] = useState<CensusRow[] | null>(null);
  const [accounts, setAccounts] = useState<FeeAccount[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [fee, setFee] = useState({ sports: "", culture: "", region: "" });
  const [savedRate, setSavedRate] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [payDate, setPayDate] = useState(today());
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [lineFor, setLineFor] = useState("");
  const [editor, setEditor] = useState<{ id: string | null; name: string; ids: Set<string>; exclusive: boolean } | null>(null);
  const [pick, setPick] = useState("");
  const [assign, setAssign] = useState<Map<string, string>>(new Map());
  const [adder, setAdder] = useState<{ key: string; ids: Set<string>; find: string } | null>(null);

  async function load() {
    try {
      const [r, a, p, fr, as] = await Promise.all([CensusService.list(), CensusService.feeAccounts(), CensusService.feePayments(), CensusService.feeRate(), CensusService.feeAssignments()]);
      setAssign(new Map(as.map((x) => [x.school_id, x.account_key])));
      setRows(r);
      setAccounts(a);
      setPayments(p);
      setSavedRate(fr?.circuit_rate ?? 0);
      // an amount saved before the three-part split counts as "Sports"
      const sp = fr && !fr.sports_rate && !fr.culture_rate && !fr.region_rate ? fr.circuit_rate : fr?.sports_rate ?? 0;
      setFee((cur) => (cur.sports === "" && cur.culture === "" && cur.region === "" ? { sports: String(sp), culture: String(fr?.culture_rate ?? 0), region: String(fr?.region_rate ?? 0) } : cur));
    } catch (e) {
      setErr((e instanceof Error ? e.message : "Could not load.") + " If this mentions a missing table, run STEP_census_fees.sql in Supabase.");
    }
  }
  useEffect(() => {
    void load();
  }, []);

  const sportsN = num(fee.sports);
  const cultureN = num(fee.culture);
  const regionN = num(fee.region);
  const rateN = r2(sportsN + cultureN + regionN);
  const feeNote = `Sports ${sportsN.toFixed(2)} + Culture ${cultureN.toFixed(2)} + Region ${regionN.toFixed(2)} = GH₵ ${rateN.toFixed(2)} per pupil`;
  const districtId = rows?.[0]?.district_id ?? "";

  const list: Acct[] = useMemo(() => {
    if (!rows) return [];
    const away = new Map<string, string>();
    for (const a of accounts) if (a.exclusive) for (const id of a.school_ids) if (!away.has(id)) away.set(id, a.id);
    const paidBy = new Map<string, number>();
    for (const p of payments) paidBy.set(p.account_key, (paidBy.get(p.account_key) ?? 0) + Number(p.amount));
    const mk = (key: string, name: string, custom: FeeAccount | null, schools: CensusRow[]): Acct => {
      const enrol = schools.reduce((s, r) => s + pupilsOf(r), 0);
      const payable = r2(enrol * rateN);
      const paid = r2(paidBy.get(key) ?? 0);
      const balance = r2(payable - paid);
      return { key, name, custom, schools, enrol, payable, paid, balance, status: payable <= 0 && paid <= 0 ? "none" : balance <= 0 ? "paid" : "owing" };
    };
    const circuits = Array.from(new Set(rows.map((r) => r.circuit ?? "").filter(Boolean))).sort();
    // where a school pays: your own choice first, then an extra group, then its own circuit
    const home = (r: CensusRow) => assign.get(r.id) ?? (away.has(r.id) ? "a:" + away.get(r.id) : "c:" + (r.circuit ?? ""));
    const a1 = circuits.map((c) => mk("c:" + c, titleCase(c), null, rows.filter((r) => home(r) === "c:" + c)));
    const a2 = accounts.map((a) => mk("a:" + a.id, a.name, a, rows.filter((r) => (assign.has(r.id) ? assign.get(r.id) === "a:" + a.id : a.school_ids.includes(r.id)))));
    return [...a1, ...a2];
  }, [rows, accounts, payments, rateN, assign]);

  const tot = useMemo(() => {
    const enrol = list.reduce((s, a) => s + a.enrol, 0);
    const payable = r2(list.reduce((s, a) => s + a.payable, 0));
    const paid = r2(list.reduce((s, a) => s + a.paid, 0));
    return { enrol, payable, paid, balance: r2(payable - paid), done: list.filter((a) => a.status === "paid").length };
  }, [list]);

  const linePts = useMemo(() => {
    const ps = payments.filter((p) => !lineFor || p.account_key === lineFor);
    const byDay = new Map<string, number>();
    for (const p of ps) byDay.set(p.paid_on, (byDay.get(p.paid_on) ?? 0) + Number(p.amount));
    let cum = 0;
    return Array.from(byDay.keys()).sort().map((d) => {
      cum += byDay.get(d) ?? 0;
      return { label: new Date(d + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" }), value: r2(cum), lines: [`Paid on this day: ${money(byDay.get(d) ?? 0)}`] };
    });
  }, [payments, lineFor]);

  async function guard(fn: () => Promise<void>, ok?: string) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      if (ok) setMsg(ok);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const saveRate = () => guard(async () => { await CensusService.setFeeRate(districtId, sportsN, cultureN, regionN); setSavedRate(rateN); }, "Fee per pupil saved.");
  const addPayment = (a: Acct) =>
    guard(async () => {
      const amt = num(entry[a.key] ?? "");
      if (amt <= 0) throw new Error("Enter an amount above zero.");
      await CensusService.addFeePayment(districtId, a.key, amt, payDate || today(), "");
      setEntry((p) => ({ ...p, [a.key]: "" }));
      setPayments(await CensusService.feePayments());
    }, "Payment recorded.");
  const delPayment = (id: string) =>
    guard(async () => {
      if (!window.confirm("Delete this payment record?")) return;
      await CensusService.deleteFeePayment(id);
      setPayments(await CensusService.feePayments());
    });
  const moveSchools = (ids: string[], key: string | null, ok?: string) =>
    guard(async () => {
      await CensusService.assignFee(districtId, ids, key);
      setAssign(new Map((await CensusService.feeAssignments()).map((x) => [x.school_id, x.account_key])));
      setAdder(null);
    }, ok);
  const hasPrivate = accounts.some((a) => /private/i.test(a.name));
  const createPrivate = () =>
    guard(async () => {
      const want = new Set(PRIVATE_NAMES.map(norm));
      const ids = (rows ?? []).filter((r) => want.has(norm(r.name))).map((r) => r.id);
      if (ids.length === 0) throw new Error("None of the listed private schools were found in the census.");
      await CensusService.saveFeeAccount(null, districtId, "Private Schools", ids, true);
      setAccounts(await CensusService.feeAccounts());
    }, "Private Schools group created.");
  function exportWorkbook() {
    if (!hasPrivate && !window.confirm("The Private Schools group has not been created yet, so the workbook will have only the circuits. Continue?")) return;
    downloadFeeWorkbook({
      groups: list.map((a) => ({ name: a.name, schools: a.schools, paid: a.paid })),
      sports: sportsN,
      culture: cultureN,
      region: regionN,
      district: "Wassa Amenfi Central District",
      filename: "Wassa Amenfi Central - Schools by group and fees.xlsx",
    });
  }
  const saveEditor = () =>
    guard(async () => {
      if (!editor) return;
      await CensusService.saveFeeAccount(editor.id, districtId, editor.name, Array.from(editor.ids), editor.exclusive);
      setAccounts(await CensusService.feeAccounts());
      setEditor(null);
    }, "Account saved.");
  const delAccount = (a: FeeAccount) =>
    guard(async () => {
      if (!window.confirm(`Delete "${a.name}" and its payment records? Its schools go back to their circuits.`)) return;
      await CensusService.deleteFeeAccount(a.id);
      const [ac, pm] = await Promise.all([CensusService.feeAccounts(), CensusService.feePayments()]);
      setAccounts(ac);
      setPayments(pm);
      setOpenKey(null);
    });

  const headers = ["Name", "Schools", "Total enrolment", "Amount payable (GH₵)", "Amount paid (GH₵)", "Outstanding balance (GH₵)", "Status"];
  const body = list.map((a) => [a.name, a.schools.length, a.enrol, a.payable, a.paid, a.balance, a.status === "paid" ? "Paid" : a.status === "owing" ? "Owing" : "No fee"]);
  const totalRow = ["TOTAL", list.reduce((s, a) => s + a.schools.length, 0), tot.enrol, tot.payable, tot.paid, tot.balance, `${tot.done} of ${list.length} paid`];
  const sub = `Fee per pupil: ${feeNote} (Primary + JHS pupils; KG and Nursery/Creche excluded). As at ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}.`;
  const base = "Wassa Amenfi Central - Sports fee accounts";

  function printSummary() {
    const tr = [...body, totalRow]
      .map((r, i, arr) => `<tr${i === arr.length - 1 ? ' style="font-weight:800;background:#eef3fb"' : ""}>${r.map((c, ci) => `<td${ci >= 1 && ci <= 5 ? ' style="text-align:right"' : ""}>${escHtml(typeof c === "number" ? (ci >= 3 ? money(c) : fmt(c)) : String(c))}</td>`).join("")}</tr>`)
      .join("");
    openPrint({
      title: "Sports affiliation fee accounts",
      subtitle: sub,
      chips: [`Sports GH₵ ${sportsN.toFixed(2)}`, `Culture GH₵ ${cultureN.toFixed(2)}`, `Region GH₵ ${regionN.toFixed(2)}`, `Total GH₵ ${rateN.toFixed(2)} per pupil`, `${list.length} accounts`],
      kpis: [{ label: "Total enrolment", value: fmt(tot.enrol) }, { label: "Payable", value: money(tot.payable) }, { label: "Paid", value: money(tot.paid) }, { label: "Outstanding", value: money(tot.balance) }],
      bodyHtml: `<table><thead><tr>${headers.map((h, i) => `<th${i >= 1 && i <= 5 ? ' style="text-align:right"' : ""}>${escHtml(h)}</th>`).join("")}</tr></thead><tbody>${tr}</tbody></table>`,
      landscape: true,
    });
  }

  function printAccount(a: Acct) {
    const tr = a.schools
      .slice()
      .sort((x, y) => x.name.localeCompare(y.name))
      .map((r) => `<tr><td>${escHtml(r.name)}</td><td style="text-align:right">${fmt(priOf(r))}</td><td style="text-align:right">${fmt(jhsOf(r))}</td><td style="text-align:right">${fmt(pupilsOf(r))}</td><td style="text-align:right">${money(r2(pupilsOf(r) * sportsN))}</td><td style="text-align:right">${money(r2(pupilsOf(r) * cultureN))}</td><td style="text-align:right">${money(r2(pupilsOf(r) * regionN))}</td><td style="text-align:right">${money(r2(pupilsOf(r) * rateN))}</td></tr>`)
      .join("");
    const total = `<tr style="font-weight:800;background:#eef3fb"><td>TOTAL (${a.schools.length} schools)</td><td style="text-align:right">${fmt(a.schools.reduce((s, r) => s + priOf(r), 0))}</td><td style="text-align:right">${fmt(a.schools.reduce((s, r) => s + jhsOf(r), 0))}</td><td style="text-align:right">${fmt(a.enrol)}</td><td style="text-align:right">${money(r2(a.enrol * sportsN))}</td><td style="text-align:right">${money(r2(a.enrol * cultureN))}</td><td style="text-align:right">${money(r2(a.enrol * regionN))}</td><td style="text-align:right">${money(a.payable)}</td></tr>`;
    openPrint({
      title: `${a.name}: sports fees, school by school`,
      subtitle: sub,
      chips: [`Sports GH₵ ${sportsN.toFixed(2)}`, `Culture GH₵ ${cultureN.toFixed(2)}`, `Region GH₵ ${regionN.toFixed(2)}`, `Total GH₵ ${rateN.toFixed(2)} per pupil`, `Paid: ${money(a.paid)}`, `Outstanding: ${money(Math.max(0, a.balance))}`],
      kpis: [{ label: "Schools", value: fmt(a.schools.length) }, { label: "Total enrolment", value: fmt(a.enrol) }, { label: "Amount payable", value: money(a.payable) }, { label: "Outstanding", value: money(Math.max(0, a.balance)) }],
      bodyHtml: `<table><thead><tr><th>School</th><th style="text-align:right">Primary pupils</th><th style="text-align:right">JHS pupils</th><th style="text-align:right">Pupils counted</th><th style="text-align:right">Sports (GH₵)</th><th style="text-align:right">Culture (GH₵)</th><th style="text-align:right">Region (GH₵)</th><th style="text-align:right">Total fee (GH₵)</th></tr></thead><tbody>${tr}${total}</tbody></table>`,
      landscape: true,
    });
  }

  if (err && !rows) return <div className="alert alert-danger">{err}</div>;
  if (!rows) return <p className="text-muted">Loading…</p>;

  const pickList = rows.filter((r) => !pick.trim() || (r.name + " " + (r.circuit ?? "")).toLowerCase().includes(pick.trim().toLowerCase()));

  return (
    <div className="cx-wrap">
      <CensusFx />
      <Aurora />
      <div className="cx-hero d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-1">Sports fee accounts</h1>
          <div className="small">Each circuit owes the district the sum of its schools' fees (amount per pupil x pupils in Primary and JHS). Record what each circuit has paid and watch the balance.</div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-warning btn-sm fw-bold" onClick={exportWorkbook}>
            <i className="bi bi-file-earmark-excel me-1" />Download Excel workbook (all groups)
          </button>
          {!hasPrivate && (
            <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={createPrivate}>
              <i className="bi bi-building me-1" />Create Private Schools group
            </button>
          )}
          <button type="button" className="btn btn-light btn-sm" onClick={() => setEditor({ id: null, name: "", ids: new Set(), exclusive: true })}>
            <i className="bi bi-plus-circle me-1" />Add a circuit / group
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger">{err}</div>}
      {msg && <div className="alert alert-success py-2">{msg}</div>}

      <div className="actrs-card cx-glass p-3 mb-3">
        <div className="cx-title mb-2">Fee per pupil (GH₵)</div>
        <div className="row g-2 align-items-end">
          {([["sports", "Sports"], ["culture", "Culture"], ["region", "Region"]] as ["sports" | "culture" | "region", string][]).map(([k, l]) => (
            <div className="col-6 col-md-2" key={k}>
              <label className="small fw-semibold">{l}</label>
              <input className="form-control form-control-sm" inputMode="decimal" value={fee[k]} onChange={(e) => setFee({ ...fee, [k]: e.target.value.replace(/[^0-9.]/g, "") })} />
            </div>
          ))}
          <div className="col-6 col-md-2">
            <label className="small fw-semibold">Total per pupil</label>
            <div className="fw-bold fs-5">{money(rateN)}</div>
          </div>
          <div className="col-12 col-md-4 d-flex align-items-end gap-2">
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={saveRate}>Save fee</button>
            {rateN !== savedRate && <span className="small fw-semibold">Not saved yet</span>}
          </div>
        </div>
        <div className="row g-2 mt-1">
          <div className="col-md-4">
            <label className="small fw-semibold">Date for payments you record</label>
            <input type="date" className="form-control form-control-sm" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="row g-3 mb-3">
        {[
          { l: "Total enrolment counted", v: tot.enrol, c: "#1c6feb", d: 0, money: false },
          { l: "Total payable (GH₵)", v: tot.payable, c: "#7a5cfa", d: 2, money: false },
          { l: "Total paid (GH₵)", v: tot.paid, c: "#0a7d5a", d: 2, money: false },
          { l: "Outstanding (GH₵)", v: tot.balance, c: "#dc3545", d: 2, money: false },
        ].map((k, i) => (
          <div className="col-6 col-xl-3" key={k.l}>
            <div className="actrs-card cx-glass cx-kpi cx-rise p-3 h-100" style={{ ["--i" as string]: i, ["--glow" as string]: k.c }}>
              <div className="small fw-semibold">{k.l}</div>
              <div className="fs-3"><Count value={k.v} decimals={k.d} /></div>
              <div className="small">{i === 2 && tot.payable > 0 ? `${((tot.paid / tot.payable) * 100).toFixed(1)}% collected` : i === 3 ? `${tot.done} of ${list.length} accounts fully paid` : " "}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="actrs-card p-3 mb-3 cx-rise">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <div className="cx-title">Accounts</div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => downloadCsv(`${base}.csv`, headers, [...body, totalRow])}>CSV</button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => downloadXlsx(`${base}.xlsx`, { sheetName: "Sports fee accounts", title: "Sports affiliation fee accounts", subtitle: sub, headers, rows: body, total: totalRow, numericFrom: 1 })}>Excel</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => downloadTablePdf({ filename: `${base}.pdf`, title: "Sports affiliation fee accounts", subtitle: sub, chips: [`Sports GH₵ ${sportsN.toFixed(2)}`, `Culture GH₵ ${cultureN.toFixed(2)}`, `Region GH₵ ${regionN.toFixed(2)}`, `Total GH₵ ${rateN.toFixed(2)} per pupil`], headers, rows: body, total: totalRow, numericFrom: 1 })}><i className="bi bi-file-earmark-pdf me-1" />Download PDF</button>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={printSummary}><i className="bi bi-printer me-1" />Print</button>
          </div>
        </div>
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th>Name</th>
                <th className="text-end">Total enrolment</th>
                <th className="text-end">Amount payable</th>
                <th style={{ minWidth: 230 }}>Amount paid</th>
                <th className="text-end">Outstanding balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => {
                const pctPaid = a.payable > 0 ? Math.min(100, (a.paid / a.payable) * 100) : 0;
                const col = a.status === "paid" ? "#198754" : a.status === "owing" ? "#dc3545" : "#6c757d";
                const isOpen = openKey === a.key;
                return (
                  <tr key={a.key} style={{ cursor: "pointer", boxShadow: `inset 5px 0 0 ${col}` }} onClick={() => setOpenKey(isOpen ? null : a.key)}>
                    <td>
                      <div className="fw-bold">{a.name}{a.custom && <span className="badge bg-info ms-2">extra group</span>}</div>
                      <div className="small">{a.schools.length} schools</div>
                      <div style={{ height: 6, borderRadius: 4, background: "rgba(127,127,127,.25)", marginTop: 4 }}>
                        <div style={{ height: 6, borderRadius: 4, width: `${pctPaid}%`, background: col, transition: "width 1.1s cubic-bezier(.2,.8,.2,1)", boxShadow: `0 0 8px ${col}` }} />
                      </div>
                    </td>
                    <td className="text-end">{fmt(a.enrol)}</td>
                    <td className="text-end">{money(a.payable)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="fw-semibold mb-1">{money(a.paid)}</div>
                      <div className="d-flex gap-1">
                        <input className="form-control form-control-sm" style={{ maxWidth: 120 }} inputMode="decimal" placeholder="Enter amount" value={entry[a.key] ?? ""} onChange={(e) => setEntry((p) => ({ ...p, [a.key]: e.target.value.replace(/[^0-9.]/g, "") }))} onKeyDown={(e) => { if (e.key === "Enter") void addPayment(a); }} />
                        <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => addPayment(a)}>Add</button>
                      </div>
                    </td>
                    <td className="text-end fw-bold" style={{ color: a.balance > 0 ? "#dc3545" : "inherit" }}>{money(Math.max(0, a.balance))}{a.balance < 0 && <div className="small">overpaid {money(-a.balance)}</div>}</td>
                    <td>
                      <span className={`badge fs-6 ${a.status === "paid" ? "bg-success" : a.status === "owing" ? "bg-danger cx-owing" : "bg-secondary"}`}>{a.status === "paid" ? "Paid" : a.status === "owing" ? "Owing" : "No fee"}</span>
                    </td>
                  </tr>
                );
              })}
              <tr className="fw-bold">
                <td>TOTAL</td>
                <td className="text-end">{fmt(tot.enrol)}</td>
                <td className="text-end">{money(tot.payable)}</td>
                <td>{money(tot.paid)}</td>
                <td className="text-end">{money(tot.balance)}</td>
                <td>{tot.done} of {list.length} paid</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="small mt-2">Click a row to see its schools (school by school) and payment history.</div>
      </div>

      {openKey && (() => {
        const a = list.find((x) => x.key === openKey);
        if (!a) return null;
        const ps = payments.filter((p) => p.account_key === a.key).slice().reverse();
        return (
          <div className="actrs-card cx-glass p-3 mb-3 cx-rise">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <div className="cx-title">{a.name}: school by school</div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-success btn-sm" onClick={() => setAdder({ key: a.key, ids: new Set(), find: "" })}><i className="bi bi-plus-circle me-1" />Add schools</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => printAccount(a)}><i className="bi bi-printer me-1" />Print / PDF</button>
                {a.custom && (
                  <>
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => a.custom && setEditor({ id: a.custom.id, name: a.custom.name, ids: new Set(a.custom.school_ids), exclusive: a.custom.exclusive })}>Edit group</button>
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => a.custom && delAccount(a.custom)}>Delete group</button>
                  </>
                )}
              </div>
            </div>
            <div className="row g-3">
              <div className="col-lg-7">
                <div className="table-responsive" style={{ maxHeight: 340, overflow: "auto" }}>
                  <table className="table table-sm align-middle mb-0">
                    <thead><tr><th>School</th><th className="text-end">Primary</th><th className="text-end">JHS</th><th className="text-end">Pupils counted</th><th className="text-end">Fee</th><th>Move or remove</th></tr></thead>
                    <tbody>
                      {a.schools.slice().sort((x, y) => x.name.localeCompare(y.name)).map((r) => (
                        <tr key={r.id}><td>{r.name}</td><td className="text-end">{fmt(priOf(r))}</td><td className="text-end">{fmt(jhsOf(r))}</td><td className="text-end">{fmt(pupilsOf(r))}</td><td className="text-end">{money(r2(pupilsOf(r) * rateN))}</td>
                          <td>
                            <select className="form-select form-select-sm" style={{ minWidth: 150 }} value="" disabled={busy} onChange={(e) => { if (e.target.value) void moveSchools([r.id], e.target.value === "__home" ? null : e.target.value, "School moved."); }}>
                              <option value="">Choose…</option>
                              <option value="none">Not taking part (remove)</option>
                              {r.circuit && a.key !== "c:" + r.circuit && <option value="__home">Back to {titleCase(r.circuit)}</option>}
                              {list.filter((x) => x.key !== a.key).map((x) => <option key={x.key} value={x.key}>Move to {x.name}</option>)}
                            </select>
                          </td></tr>
                      ))}
                      <tr className="fw-bold"><td>Total</td><td /><td /><td className="text-end">{fmt(a.enrol)}</td><td className="text-end">{money(a.payable)}</td><td /></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="col-lg-5">
                <div className="fw-bold mb-1">Payments received</div>
                {ps.length === 0 ? <div className="small">Nothing recorded yet.</div> : (
                  <table className="table table-sm align-middle mb-0">
                    <tbody>
                      {ps.map((p) => (
                        <tr key={p.id}>
                          <td>{new Date(p.paid_on + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</td>
                          <td className="text-end fw-semibold">{money(Number(p.amount))}</td>
                          <td className="text-end"><button type="button" className="btn btn-sm btn-outline-primary py-0" onClick={() => delPayment(p.id)}>Delete</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="row g-3 mb-3">
        <div className="col-lg-4">
          <ChartCard i={1} title="Paid and outstanding">
            <Donut
              data={[
                { label: "Paid", value: Math.min(tot.paid, tot.payable), color: "#198754", detail: [`Amount: ${money(tot.paid)}`] },
                { label: "Outstanding", value: Math.max(0, tot.balance), color: "#dc3545", detail: [`Amount: ${money(Math.max(0, tot.balance))}`] },
              ]}
              centerTop={tot.payable > 0 ? `${Math.round((Math.min(tot.paid, tot.payable) / tot.payable) * 100)}%` : "0%"}
              centerBottom="collected"
            />
          </ChartCard>
        </div>
        <div className="col-lg-8">
          <ChartCard i={2} title="Paid and outstanding, by account (GH₵)">
            <StackedHBars
              labels={["Paid", "Outstanding"]}
              colors={["#198754", "#dc3545"]}
              items={list.map((a) => ({ label: a.name, a: Math.min(a.paid, a.payable), b: Math.max(0, a.balance) }))}
            />
          </ChartCard>
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12">
          <ChartCard i={3} title="Money collected over time (running total, GH₵)">
            <div className="mb-2" style={{ maxWidth: 320 }}>
              <select className="form-select form-select-sm" value={lineFor} onChange={(e) => setLineFor(e.target.value)}>
                <option value="">All accounts together</option>
                {list.map((a) => <option key={a.key} value={a.key}>{a.name}</option>)}
              </select>
            </div>
            <LineChart points={linePts} color={COLORS.public} money />
          </ChartCard>
        </div>
      </div>
      <div className="row g-3 mb-3">
        <div className="col-12">
          <ChartCard i={4} title="Enrolment counted for the fee, by account">
            <StackedHBars
              labels={["Primary", "JHS"]}
              colors={[COLORS.a, COLORS.b]}
              items={list.map((a) => ({ label: a.name, a: a.schools.reduce((s, r) => s + priOf(r), 0), b: a.schools.reduce((s, r) => s + jhsOf(r), 0) }))}
            />
          </ChartCard>
        </div>
      </div>

      {(() => {
        const out = rows.filter((r) => assign.get(r.id) === "none");
        if (out.length === 0) return null;
        return (
          <div className="actrs-card cx-glass p-3 mb-3 cx-rise">
            <div className="cx-title mb-2">Schools not taking part ({out.length})</div>
            <div className="small mb-2">These schools are left out of every account. Put them back in their own circuit or add them to another account.</div>
            <div className="row g-2">
              {out.map((r) => (
                <div key={r.id} className="col-md-6 d-flex align-items-center gap-2">
                  <span className="flex-grow-1 small">{r.name} <span className="text-muted">({titleCase(r.circuit)}, {fmt(pupilsOf(r))})</span></span>
                  <select className="form-select form-select-sm" style={{ maxWidth: 170 }} value="" disabled={busy} onChange={(e) => { if (e.target.value) void moveSchools([r.id], e.target.value === "__home" ? null : e.target.value, "School added back."); }}>
                    <option value="">Add back…</option>
                    <option value="__home">Own circuit</option>
                    {list.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {adder && (() => {
        const target = list.find((x) => x.key === adder.key);
        const here = new Set((target?.schools ?? []).map((r) => r.id));
        const nameOf = (r: CensusRow) => (assign.get(r.id) === "none" ? "not taking part" : list.find((x) => x.schools.some((s2) => s2.id === r.id))?.name ?? "-");
        const cand = rows.filter((r) => !here.has(r.id) && (!adder.find.trim() || (r.name + " " + (r.circuit ?? "")).toLowerCase().includes(adder.find.trim().toLowerCase())));
        return (
          <div className="modal d-block" style={{ background: "rgba(0,0,0,.55)", overflow: "auto" }} onClick={() => setAdder(null)}>
            <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
              <div className="modal-content p-3">
                <h5 className="fw-bold">Add schools to {target?.name}</h5>
                <div className="small mb-2">Ticked schools leave their present account and pay through {target?.name}.</div>
                <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                  <input className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder="Find a school…" value={adder.find} onChange={(e) => setAdder({ ...adder, find: e.target.value })} />
                  <span className="small fw-semibold">{adder.ids.size} ticked</span>
                </div>
                <div style={{ maxHeight: 340, overflow: "auto" }} className="row g-1 mb-3">
                  {cand.map((r) => (
                    <label key={r.id} className="col-md-6 d-flex align-items-center gap-2 small" style={{ cursor: "pointer" }}>
                      <input type="checkbox" checked={adder.ids.has(r.id)} onChange={() => { const n = new Set(adder.ids); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setAdder({ ...adder, ids: n }); }} />
                      <span>{r.name} <span className="text-muted">(now in {nameOf(r)}, {fmt(pupilsOf(r))})</span></span>
                    </label>
                  ))}
                </div>
                <div className="d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-outline-primary" onClick={() => setAdder(null)}>Cancel</button>
                  <button type="button" className="btn btn-primary" disabled={busy || adder.ids.size === 0} onClick={() => moveSchools(Array.from(adder.ids), adder.key, "Schools added.")}>Add {adder.ids.size} school(s)</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {editor && (
        <div className="modal d-block" style={{ background: "rgba(0,0,0,.55)", overflow: "auto" }} onClick={() => setEditor(null)}>
          <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content p-3">
              <h5 className="fw-bold">{editor.id ? "Edit" : "Add"} a circuit / group of schools</h5>
              <div className="mb-2">
                <label className="small fw-semibold">Name (for example "Circuit 13")</label>
                <input className="form-control" value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} />
              </div>
              <label className="d-flex align-items-center gap-2 small mb-2">
                <input type="checkbox" checked={editor.exclusive} onChange={(e) => setEditor({ ...editor, exclusive: e.target.checked })} />
                Count these schools here only (take them out of their present circuits so nobody pays twice)
              </label>
              <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                <input className="form-control form-control-sm" style={{ maxWidth: 260 }} placeholder="Find a school…" value={pick} onChange={(e) => setPick(e.target.value)} />
                <span className="small fw-semibold">{editor.ids.size} schools ticked, {fmt(rows.filter((r) => editor.ids.has(r.id)).reduce((s, r) => s + pupilsOf(r), 0))} pupils</span>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditor({ ...editor, ids: new Set([...editor.ids, ...pickList.map((r) => r.id)]) })}>Tick shown</button>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditor({ ...editor, ids: new Set() })}>Untick all</button>
              </div>
              <div style={{ maxHeight: 300, overflow: "auto" }} className="row g-1 mb-3">
                {pickList.map((r) => (
                  <label key={r.id} className="col-md-6 d-flex align-items-center gap-2 small" style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={editor.ids.has(r.id)} onChange={() => { const n = new Set(editor.ids); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setEditor({ ...editor, ids: n }); }} />
                    <span>{r.name} <span className="text-muted">({titleCase(r.circuit)}, {fmt(pupilsOf(r))})</span></span>
                  </label>
                ))}
              </div>
              <div className="d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-outline-primary" onClick={() => setEditor(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={saveEditor}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
