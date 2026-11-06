import { useEffect, useMemo, useState } from "react";
import { downloadCsv } from "@/lib/csvExport";
import { CensusService } from "@services/cloud/CensusService";
import { CensusSummary } from "@components/census/CensusSummary";
import { CensusSchoolModal } from "@components/census/CensusSchoolModal";
import { Aurora, CensusFx } from "@components/census/censusFx";
import { escHtml, openPrint } from "@components/census/censusPrint";
import {
  ALL_LEVELS, LEVEL_LABEL, aggregate, allLevelsOn, applyLevels, fmt, g, grand, jhsT, kgT, levelLabel, priT, ratio, rooms, rowTotal, searchText, teachers,
  levelsNote, titleCase, trained, type Agg, type CensusRow, type LevelKey, type LevelSel,
} from "@components/census/censusModel";

/**
 * District school census (Wassa Amenfi Central).
 *
 * Independent of the schools registered on EduLink GH: it reads its own table
 * (district_census_schools), loaded from the district's corrected spreadsheet.
 * Visible only to the Super Admin and the district admin of that district, who
 * can also edit it (enforced by the database, see STEP_district_census.sql).
 */

type Cell = string | number;

interface Col {
  label: string;
  /** Returns a number (summed/derived) - null shows as a dash. */
  f: (a: Agg) => number | null;
  decimals?: number;
}

/** Which level a column belongs to (so it can be hidden when that level is left out). */
function colLevel(label: string): LevelKey | null {
  if (/nursery/i.test(label)) return "nur";
  if (/\bKG/.test(label)) return "kg";
  if (/Primary|^B\d$/.test(label)) return "pri";
  if (/JHS/.test(label)) return "jhs";
  return null;
}

function enrolmentCols(withNursery: boolean, withGrandSplit: boolean): Col[] {
  const cols: Col[] = [
    { label: "KG Boys", f: (a) => g(a, "kg_b") },
    { label: "KG Girls", f: (a) => g(a, "kg_g") },
    { label: "Total KG", f: kgT },
    { label: "Primary Boys", f: (a) => g(a, "pri_b") },
    { label: "Primary Girls", f: (a) => g(a, "pri_g") },
    { label: "Total Primary", f: priT },
    { label: "JHS Boys", f: (a) => g(a, "jhs_b") },
    { label: "JHS Girls", f: (a) => g(a, "jhs_g") },
    { label: "Total JHS", f: jhsT },
    { label: "Grand Total", f: grand },
  ];
  if (withGrandSplit) {
    cols.push({ label: "Grand Total Boys", f: (a) => g(a, "kg_b") + g(a, "pri_b") + g(a, "jhs_b") });
    cols.push({ label: "Grand Total Girls", f: (a) => g(a, "kg_g") + g(a, "pri_g") + g(a, "jhs_g") });
    cols.push({ label: "Girls %", f: (a) => { const t = grand(a); return t ? ((g(a, "kg_g") + g(a, "pri_g") + g(a, "jhs_g")) / t) * 100 : null; }, decimals: 1 });
  }
  if (withNursery) {
    cols.push({ label: "Nursery/Creche Boys*", f: (a) => g(a, "nur_b") });
    cols.push({ label: "Nursery/Creche Girls*", f: (a) => g(a, "nur_g") });
    cols.push({ label: "Nursery/Creche Total*", f: (a) => g(a, "nur_b") + g(a, "nur_g") });
  }
  return cols;
}

const CLASS_COLS: Col[] = [
  { label: "Nursery/Creche", f: (a) => g(a, "nur_b") + g(a, "nur_g") },
  { label: "KG1", f: (a) => g(a, "kg1_b") + g(a, "kg1_g") },
  { label: "KG2", f: (a) => g(a, "kg2_b") + g(a, "kg2_g") },
  ...[1, 2, 3, 4, 5, 6].map((i): Col => ({ label: `B${i}`, f: (a) => g(a, `p${i}_b`) + g(a, `p${i}_g`) })),
  ...[1, 2, 3].map((i): Col => ({ label: `JHS${i}`, f: (a) => g(a, `j${i}_b`) + g(a, `j${i}_g`) })),
  { label: "Grand Total", f: grand },
];

const TEACHER_COLS: Col[] = [
  { label: "KG Male", f: (a) => g(a, "t_kg_m") },
  { label: "KG Female", f: (a) => g(a, "t_kg_f") },
  { label: "KG Trained", f: (a) => g(a, "tt_kg_m") + g(a, "tt_kg_f") },
  { label: "Primary Male", f: (a) => g(a, "t_pri_m") },
  { label: "Primary Female", f: (a) => g(a, "t_pri_f") },
  { label: "Primary Trained", f: (a) => g(a, "tt_pri_m") + g(a, "tt_pri_f") },
  { label: "JHS Male", f: (a) => g(a, "t_jhs_m") },
  { label: "JHS Female", f: (a) => g(a, "t_jhs_f") },
  { label: "JHS Trained", f: (a) => g(a, "tt_jhs_m") + g(a, "tt_jhs_f") },
  { label: "Total Teachers", f: teachers },
  { label: "Total Trained", f: trained },
  { label: "% Trained", f: (a) => { const t = teachers(a); return t ? (trained(a) / t) * 100 : null; }, decimals: 1 },
  { label: "NSS Personnel", f: (a) => g(a, "nss_m") + g(a, "nss_f") },
  { label: "CTAs", f: (a) => g(a, "cta_m") + g(a, "cta_f") },
  { label: "Pupil Teachers", f: (a) => g(a, "pupil_teachers") },
  { label: "Pupils per Teacher", f: (a) => ratio(grand(a), teachers(a)), decimals: 1 },
];

const FACILITY_COLS: Col[] = [
  { label: "KG Classrooms", f: (a) => g(a, "room_kg") },
  { label: "Primary Classrooms", f: (a) => g(a, "room_pri") },
  { label: "JHS Classrooms", f: (a) => g(a, "room_jhs") },
  { label: "Total Classrooms", f: rooms },
  { label: "Hexagonal Desks (KG)", f: (a) => g(a, "desk_hex") },
  { label: "Dual Desks (Primary)", f: (a) => g(a, "desk_dual") },
  { label: "Mono Desks (JHS)", f: (a) => g(a, "desk_mono") },
  { label: "Teachers' Chairs", f: (a) => g(a, "chairs") },
  { label: "Teachers' Tables", f: (a) => g(a, "tables") },
  { label: "Pupils per Classroom", f: (a) => ratio(grand(a), rooms(a)), decimals: 1 },
  { label: "Indiscipline Issues", f: (a) => g(a, "indiscipline") },
];

type ReportId = "enrolment" | "class" | "teachers" | "facilities" | "directory" | "followup";
type GroupId = "school" | "circuit" | "type" | "level" | "feeding" | "circuit_type";

const REPORTS: { id: ReportId; label: string; hint: string }[] = [
  { id: "enrolment", label: "Enrolment (KG, Primary, JHS)", hint: "Boys, girls and totals per level with the Grand Total." },
  { id: "class", label: "Enrolment by class", hint: "Pupils in each class from Nursery to JHS3." },
  { id: "teachers", label: "Teachers", hint: "Male, female and trained teachers, with pupils per teacher." },
  { id: "facilities", label: "Classrooms and furniture", hint: "Classrooms, desks, chairs and tables." },
  { id: "directory", label: "School directory", hint: "Head teacher, contacts, EMIS code and GPS address." },
  { id: "followup", label: "Data follow-up", hint: "Fields marked for follow-up with each school." },
];

const GROUPS: { id: GroupId; label: string }[] = [
  { id: "school", label: "Each school" },
  { id: "circuit", label: "Circuit" },
  { id: "type", label: "Public / Private" },
  { id: "level", label: "School level" },
  { id: "feeding", label: "School feeding programme" },
  { id: "circuit_type", label: "Circuit and Public/Private" },
];

function groupKey(r: CensusRow, grp: GroupId): string {
  switch (grp) {
    case "circuit":
      return titleCase(r.circuit);
    case "type":
      return titleCase(r.school_type);
    case "level":
      return r.school_level ? r.school_level.replace("]", ")") : "Not stated";
    case "feeding":
      return r.feeding === "YES" ? "Beneficiary of school feeding" : r.feeding === "NO" ? "Not a beneficiary" : "Not stated";
    case "circuit_type":
      return `${titleCase(r.circuit)} - ${titleCase(r.school_type)}`;
    default:
      return r.name;
  }
}

interface Table {
  headers: string[];
  rows: Cell[][];
  total: Cell[] | null;
  numericFrom: number; // columns at or after this index are right-aligned numbers
  /** One school id per row when each row is a single school (so the name can open the school). */
  ids?: string[];
}

function buildTable(
  report: ReportId,
  grp: GroupId,
  rows: CensusRow[],
  opts: { nursery: boolean; grandSplit: boolean; schoolExtras: boolean; sel: LevelSel }
): Table {
  if (report === "directory") {
    const headers = ["Name of School", "Community", "Circuit", "Public/Private", "School Level", "EMIS Code", "GPS Address",
      "Head Teacher", "Head's Phone", "Head's Email", "School Email", "Date Established", "School Feeding"];
    const body = rows.map((r) => [r.name, r.community ?? "", titleCase(r.circuit), titleCase(r.school_type), r.school_level ?? "",
      r.emis_code ?? "", r.gps ?? "", titleCase(r.head_name), r.head_phone ?? "", r.head_email ?? "", r.school_email ?? "",
      r.established ?? "", r.feeding ?? ""]);
    return { headers, rows: body, total: null, numericFrom: 99, ids: rows.map((r) => r.id) };
  }
  if (report === "followup") {
    const withIssues = rows.filter((r) => r.follow_up.length > 0);
    const headers = ["Name of School", "Circuit", "Head's Phone", "Fields to follow up", "Fields"];
    const body = withIssues.map((r) => [r.name, titleCase(r.circuit), r.head_phone ?? "", r.follow_up.length, r.follow_up.join("; ")]);
    return { headers, rows: body, total: null, numericFrom: 3, ids: withIssues.map((r) => r.id) };
  }
  const allCols =
    report === "enrolment" ? enrolmentCols(opts.nursery, opts.grandSplit)
    : report === "class" ? CLASS_COLS
    : report === "teachers" ? TEACHER_COLS
    : FACILITY_COLS;
  const cols = allCols.filter((c) => {
    const lv = colLevel(c.label);
    return !lv || opts.sel[lv];
  });
  const firstLabel =
    grp === "school" ? "Name of School"
    : grp === "circuit" ? "Circuit"
    : grp === "type" ? "Public / Private"
    : grp === "level" ? "School Level"
    : grp === "feeding" ? "School Feeding"
    : "Circuit and Type";
  const extras = grp === "school" && opts.schoolExtras;
  const headers = [firstLabel, ...(extras ? ["Circuit", "Public/Private"] : []), ...(grp === "school" ? [] : ["Schools"]), ...cols.map((c) => c.label)];

  const groups = new Map<string, CensusRow[]>();
  for (const r of rows) {
    const k = groupKey(r, grp);
    const list = groups.get(k);
    if (list) list.push(r);
    else groups.set(k, [r]);
  }
  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));
  const mk = (label: string, list: CensusRow[], first: CensusRow | null): Cell[] => {
    const a = aggregate(list);
    return [
      label,
      ...(extras && first ? [titleCase(first.circuit), titleCase(first.school_type)] : extras ? ["", ""] : []),
      ...(grp === "school" ? [] : [list.length]),
      ...cols.map((c) => c.f(a)).map((v, i) => (v === null ? "-" : cols[i].decimals ? Number(v.toFixed(cols[i].decimals)) : v)),
    ];
  };
  const body = keys.map((k) => mk(k, groups.get(k) ?? [], grp === "school" ? (groups.get(k) ?? [])[0] ?? null : null));
  const total = mk("DISTRICT TOTAL", rows, null);
  return { headers, rows: body, total, numericFrom: extras ? 3 : 1, ids: grp === "school" ? keys.map((k) => (groups.get(k) ?? [])[0]?.id ?? "") : undefined };
}

function esc(s: string): string {
  return escHtml(s);
}

function cellText(c: Cell): string {
  return typeof c === "number" ? c.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(c);
}

function tableMarkup(t: Table): string {
  const all = t.total ? [...t.rows, t.total] : t.rows;
  const head = t.headers.map((h, i) => `<th${i >= t.numericFrom ? ' class="n"' : ""}>${esc(h)}</th>`).join("");
  const body = all
    .map((r, i) => {
      const isTotal = t.total !== null && i === all.length - 1;
      return `<tr${isTotal ? ' class="tot"' : ""}>${r.map((c, ci) => `<td${ci >= t.numericFrom && typeof c === "number" ? ' class="n"' : ""}>${esc(cellText(c))}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function tableHtml(title: string, subtitle: string, t: Table): string {
  return `<h2>${esc(title)}</h2><p>${esc(subtitle)}</p>${tableMarkup(t)}`;
}

const PAGE_CSS =
  "body{font-family:Arial,sans-serif;font-size:11px;color:#111}h2{margin:0 0 4px}p{margin:0 0 10px;color:#555}" +
  "table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;text-align:left}th{background:#0a1f44;color:#fff}" +
  "td.n{text-align:right}tr.tot td{font-weight:bold;background:#eef3fb}";

type TabId = "summary" | "reports" | "find";

export function CloudDistrictCensus() {
  const [rows, setRows] = useState<CensusRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("summary");

  const [report, setReport] = useState<ReportId>("enrolment");
  const [grp, setGrp] = useState<GroupId>("school");
  const [search, setSearch] = useState("");
  const [circuit, setCircuit] = useState("");
  const [type, setType] = useState("");
  const [level, setLevel] = useState("");
  const [feeding, setFeeding] = useState("");
  const [nursery, setNursery] = useState(false);
  const [grandSplit, setGrandSplit] = useState(false);
  const [schoolExtras, setSchoolExtras] = useState(false);
  const [sel, setSel] = useState<LevelSel>(ALL_LEVELS);
  const [dropEmpty, setDropEmpty] = useState(true);

  const [find, setFind] = useState("");
  const [open, setOpen] = useState<{ id: string | null; edit: boolean } | null>(null);

  useEffect(() => {
    CensusService.list()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the census data."));
  }, []);

  const circuits = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.circuit ?? "").filter(Boolean))).sort(),
    [rows]
  );
  const levels = useMemo(
    () => Array.from(new Set((rows ?? []).map((r) => r.school_level ?? "").filter(Boolean))).sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (!q || searchText(r).includes(q)) &&
        (!circuit || r.circuit === circuit) &&
        (!type || r.school_type === type) &&
        (!level || r.school_level === level) &&
        (!feeding || (feeding === "NA" ? !r.feeding : r.feeding === feeding))
    );
  }, [rows, search, circuit, type, level, feeding]);

  // The same schools, with the levels that are switched off taken out of every number.
  const levelRows = useMemo(() => applyLevels(filtered, sel, dropEmpty), [filtered, sel, dropEmpty]);
  const note = levelsNote(sel);

  const table = useMemo(
    () => buildTable(report, report === "directory" || report === "followup" ? "school" : grp, levelRows, { nursery, grandSplit, schoolExtras, sel }),
    [report, grp, levelRows, nursery, grandSplit, schoolExtras, sel]
  );

  const found = useMemo(() => {
    const q = find.trim().toLowerCase();
    const list = (rows ?? []).filter((r) => !q || q.split(/\s+/).every((w) => searchText(r).includes(w)));
    return list;
  }, [rows, find]);

  const reportMeta = REPORTS.find((r) => r.id === report) ?? REPORTS[0];
  const groupLabel = report === "directory" || report === "followup" ? "Each school" : GROUPS.find((x) => x.id === grp)?.label ?? "";
  const filterBits = [circuit && `Circuit: ${titleCase(circuit)}`, type && titleCase(type), level && levelLabel(level), feeding && `Feeding: ${feeding}`, search && `Search: ${search}`]
    .filter(Boolean)
    .join(" | ");
  const baseSubtitle = `${levelRows.length} school(s)${note ? " - " + note : ""}${filterBits ? " - " + filterBits : ""}`;
  const subtitle = `${baseSubtitle} - Grouped by: ${groupLabel}`;
  const levelSlug = note ? "-" + note.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") : "";
  const fileBase = `wassa-amenfi-central-${reportMeta.id}-${grp}${levelSlug}`;
  const printChips = [note, groupLabel && `Grouped by: ${groupLabel}`, circuit && `Circuit: ${titleCase(circuit)}`, type && titleCase(type), level && levelLabel(level), feeding && `Feeding: ${feeding}`, search && `Search: ${search}`].filter(Boolean) as string[];

  function exportCsv() {
    const all = table.total ? [...table.rows, table.total] : table.rows;
    downloadCsv(`${fileBase}.csv`, table.headers, all);
  }

  function exportExcel() {
    const html = `<html><head><meta charset="utf-8"><style>${PAGE_CSS}</style></head><body>${tableHtml(reportMeta.label, subtitle, table)}</body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBase}.xls`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printReport() {
    const all = aggregate(levelRows);
    openPrint({
      title: reportMeta.label,
      subtitle: `${levelRows.length} school(s) in Wassa Amenfi Central District`,
      chips: printChips,
      kpis:
        report === "enrolment" || report === "class"
          ? [
              { label: "Schools", value: fmt(all.schools) },
              { label: "Pupils", value: fmt(grand(all)) },
              { label: "Boys", value: fmt(g(all, "kg_b") + g(all, "pri_b") + g(all, "jhs_b")) },
              { label: "Girls", value: fmt(g(all, "kg_g") + g(all, "pri_g") + g(all, "jhs_g")) },
            ]
          : report === "teachers"
            ? [
                { label: "Schools", value: fmt(all.schools) },
                { label: "Teachers", value: fmt(teachers(all)) },
                { label: "Trained", value: fmt(trained(all)) },
                { label: "Pupils per teacher", value: fmt(ratio(grand(all), teachers(all)), 1) },
              ]
            : report === "facilities"
              ? [
                  { label: "Schools", value: fmt(all.schools) },
                  { label: "Classrooms", value: fmt(rooms(all)) },
                  { label: "Pupils per classroom", value: fmt(ratio(grand(all), rooms(all)), 1) },
                ]
              : [{ label: "Schools", value: fmt(all.schools) }],
      bodyHtml: tableMarkup(table) + (report === "enrolment" && nursery ? '<p style="font-size:10px;color:#5b6b8c">* Nursery/Creche pupils are shown separately and are not part of the Grand Total.</p>' : ""),
      landscape: table.headers.length > 7,
    });
  }

  if (error) return <div className="alert alert-danger">{error}</div>;
  if (rows === null) return <p className="text-muted">Loading…</p>;
  if (rows.length === 0)
    return (
      <div className="alert alert-warning">
        No census data has been loaded for your district yet.
      </div>
    );

  const districtId = rows[0].district_id;
  const flagged = levelRows.filter((r) => r.follow_up.length > 0).length;
  const opened = open?.id ? rows.find((r) => r.id === open.id) ?? null : null;

  function onSaved(saved: CensusRow) {
    setRows((prev) => {
      const list = prev ?? [];
      const exists = list.some((r) => r.id === saved.id);
      const next = exists ? list.map((r) => (r.id === saved.id ? saved : r)) : [...list, saved];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  const filtersBar = (
    <div className="actrs-card cx-glass p-3 mb-3">
      <div className="row g-2">
        <div className="col-md-3">
          <input className="form-control form-control-sm" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Narrow by any word (school, community, head…)" />
        </div>
        <div className="col-6 col-md-2">
          <select className="form-select form-select-sm" value={circuit} onChange={(e) => setCircuit(e.target.value)}>
            <option value="">All circuits</option>
            {circuits.map((c) => (
              <option key={c} value={c}>{titleCase(c)}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <select className="form-select form-select-sm" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Public and private</option>
            <option value="PUBLIC">Public only</option>
            <option value="PRIVATE">Private only</option>
          </select>
        </div>
        <div className="col-6 col-md-3">
          <select className="form-select form-select-sm" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All school levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>{levelLabel(l)}</option>
            ))}
          </select>
        </div>
        <div className="col-6 col-md-2">
          <select className="form-select form-select-sm" value={feeding} onChange={(e) => setFeeding(e.target.value)}>
            <option value="">Feeding: any</option>
            <option value="YES">Feeding: yes</option>
            <option value="NO">Feeding: no</option>
            <option value="NA">Not stated</option>
          </select>
        </div>
      </div>
      <div className="mt-3 pt-3 border-top">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="small fw-semibold">Levels to include in the figures:</span>
          {(["nur", "kg", "pri", "jhs"] as LevelKey[]).map((k) => (
            <span key={k} className={`cx-chip ${sel[k] ? "on" : "off"}`} onClick={() => setSel((p) => ({ ...p, [k]: !p[k] }))} title={sel[k] ? "Click to leave this level out" : "Click to include this level"}>
              <i className={`bi ${sel[k] ? "bi-check-circle-fill" : "bi-x-circle"}`} />
              {LEVEL_LABEL[k]}
            </span>
          ))}
        </div>
        <div className="d-flex align-items-center gap-2 flex-wrap mt-2">
          <span className="text-muted small">Quick choices:</span>
          {([
            ["All levels", { nur: true, kg: true, pri: true, jhs: true }],
            ["Without KG", { nur: false, kg: false, pri: true, jhs: true }],
            ["Without JHS", { nur: true, kg: true, pri: true, jhs: false }],
            ["Without Primary", { nur: true, kg: true, pri: false, jhs: true }],
            ["Primary only", { nur: false, kg: false, pri: true, jhs: false }],
            ["JHS only", { nur: false, kg: false, pri: false, jhs: true }],
            ["KG only", { nur: true, kg: true, pri: false, jhs: false }],
          ] as [string, LevelSel][]).map(([label, v]) => (
            <button key={label} type="button" className="btn btn-sm btn-outline-primary py-0" onClick={() => setSel(v)}>{label}</button>
          ))}
          {!allLevelsOn(sel) && (
            <label className="form-check-label small ms-2">
              <input type="checkbox" className="form-check-input me-1" checked={dropEmpty} onChange={(e) => setDropEmpty(e.target.checked)} />
              Leave out schools that have no pupils in these levels
            </label>
          )}
        </div>
        {!allLevelsOn(sel) && (
          <div className="small mt-2 cx-live d-inline-block px-2 py-1 rounded-pill" style={{ background: "rgba(28,111,235,.14)" }}>
            <i className="bi bi-funnel-fill me-1" />Showing: <b>{note}</b>. Every total, chart, report and download below follows this choice.
          </div>
        )}
      </div>
      {(search || circuit || type || level || feeding) && (
        <div className="mt-2 small">
          Showing {filtered.length} of {rows.length} schools.{" "}
          <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setSearch(""); setCircuit(""); setType(""); setLevel(""); setFeeding(""); }}>
            Clear filters
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="cx-wrap">
      <CensusFx />
      <Aurora />
      <div className="cx-hero d-flex align-items-start justify-content-between flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-1">District school census</h1>
          <div className="text-muted small">
            Wassa Amenfi Central District. The district's own schools survey, separate from the schools registered on EduLink GH. All figures can be edited.
          </div>
        </div>
        <button type="button" className="btn btn-light btn-sm" onClick={() => setOpen({ id: null, edit: true })}>
          <i className="bi bi-plus-circle me-1" />Add a school
        </button>
      </div>

      <ul className="nav nav-pills cx-pills mb-3">
        {([["summary", "Summary and charts"], ["reports", "Reports and downloads"], ["find", "Find a school"]] as [TabId, string][]).map(([id, label]) => (
          <li className="nav-item" key={id}>
            <button type="button" className={`nav-link ${tab === id ? "active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          </li>
        ))}
      </ul>

      {tab !== "find" && filtersBar}

      {tab === "summary" && <CensusSummary rows={levelRows} subtitle={baseSubtitle} sel={sel} chips={printChips} />}

      {tab === "reports" && (
        <>
          <div className="actrs-card p-3 mb-3">
            <div className="row g-2 align-items-end">
              <div className="col-md-4">
                <label className="form-label small mb-1">Report</label>
                <select className="form-select form-select-sm" value={report} onChange={(e) => setReport(e.target.value as ReportId)}>
                  {REPORTS.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <div className="text-muted" style={{ fontSize: "0.72rem" }}>{reportMeta.hint}</div>
              </div>
              {report !== "directory" && report !== "followup" && (
                <div className="col-md-3">
                  <label className="form-label small mb-1">Group the figures by</label>
                  <select className="form-select form-select-sm" value={grp} onChange={(e) => setGrp(e.target.value as GroupId)}>
                    {GROUPS.map((x) => (
                      <option key={x.id} value={x.id}>{x.label}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-md-5 d-flex gap-2 flex-wrap justify-content-md-end">
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={exportCsv}>
                  <i className="bi bi-filetype-csv me-1" />CSV
                </button>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={exportExcel}>
                  <i className="bi bi-file-earmark-excel me-1" />Excel
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={printReport}>
                  <i className="bi bi-printer me-1" />Print / PDF
                </button>
              </div>
            </div>
            <div className="d-flex flex-wrap gap-3 mt-2 small">
              {report === "enrolment" && (
                <>
                  <label className="form-check-label">
                    <input type="checkbox" className="form-check-input me-1" checked={grandSplit} onChange={(e) => setGrandSplit(e.target.checked)} />
                    Add Grand Total Boys, Girls and Girls %
                  </label>
                  <label className="form-check-label">
                    <input type="checkbox" className="form-check-input me-1" checked={nursery} onChange={(e) => setNursery(e.target.checked)} />
                    Show Nursery/Creche columns
                  </label>
                </>
              )}
              {grp === "school" && report !== "directory" && report !== "followup" && (
                <label className="form-check-label">
                  <input type="checkbox" className="form-check-input me-1" checked={schoolExtras} onChange={(e) => setSchoolExtras(e.target.checked)} />
                  Show circuit and public/private beside each school
                </label>
              )}
            </div>
          </div>

          {report === "enrolment" && nursery && (
            <div className="text-muted small mb-2">* Nursery/Creche pupils are shown separately and are not part of the Grand Total.</div>
          )}
          {report === "followup" && (
            <div className="text-muted small mb-2">{flagged} school(s) have fields the district office should confirm with the school. Open a school to correct a field and mark it sorted.</div>
          )}
          {table.ids && <div className="text-muted small mb-2">Click a school's name to open, edit or print everything about it.</div>}

          <div className="actrs-card p-0">
            <div className="table-responsive">
              <table className="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    {table.headers.map((h, i) => (
                      <th key={h + i} className={i >= table.numericFrom ? "text-end" : ""} style={{ whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.length === 0 && (
                    <tr><td colSpan={table.headers.length} className="text-center text-muted py-4">No schools match these filters.</td></tr>
                  )}
                  {table.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((c, ci) => (
                        <td key={ci} className={ci >= table.numericFrom && typeof c === "number" ? "text-end" : ""}>
                          {ci === 0 && table.ids && table.ids[ri] ? (
                            <button type="button" className="btn btn-link btn-sm p-0 text-start" onClick={() => setOpen({ id: table.ids?.[ri] ?? null, edit: false })}>
                              {c}
                            </button>
                          ) : typeof c === "number" ? (
                            c.toLocaleString(undefined, { maximumFractionDigits: 1 })
                          ) : (
                            c
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {table.total && table.rows.length > 0 && (
                    <tr className="fw-bold">
                      {table.total.map((c, ci) => (
                        <td key={ci} className={ci >= table.numericFrom && typeof c === "number" ? "text-end" : ""}>
                          {typeof c === "number" ? c.toLocaleString(undefined, { maximumFractionDigits: 1 }) : c}
                        </td>
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "find" && (
        <>
          <div className="actrs-card p-3 mb-3">
            <label className="form-label small mb-1">Search any school by name, community, circuit, EMIS code, head teacher, phone, email or GPS address</label>
            <input
              className="form-control"
              autoFocus
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder="For example: Manso, 1011130030, Gyasi, 0249…"
            />
            <div className="text-muted small mt-1">{found.length} of {rows.length} schools. Click a school to see all its data.</div>
          </div>
          <div className="actrs-card p-0">
            <div className="table-responsive" style={{ maxHeight: 560, overflowY: "auto" }}>
              <table className="table table-sm table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>School</th><th>Circuit</th><th>Type</th><th>Level</th><th>Head teacher</th><th>Phone</th>
                    <th className="text-end">Pupils</th><th className="text-end">Teachers</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {found.slice(0, 200).map((r) => {
                    const a = aggregate([r]);
                    return (
                      <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => setOpen({ id: r.id, edit: false })}>
                        <td className="fw-medium">{r.name}</td>
                        <td>{titleCase(r.circuit)}</td>
                        <td>{titleCase(r.school_type)}</td>
                        <td>{levelLabel(r.school_level)}</td>
                        <td>{titleCase(r.head_name)}</td>
                        <td>{r.head_phone ?? "-"}</td>
                        <td className="text-end">{fmt(rowTotal(r))}</td>
                        <td className="text-end">{fmt(teachers(a))}</td>
                        <td className="text-end">{r.follow_up.length > 0 && <span className="badge text-bg-danger">{r.follow_up.length}</span>}</td>
                      </tr>
                    );
                  })}
                  {found.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-muted py-4">No school matches that search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {open && (open.id === null || opened) && (
        <CensusSchoolModal
          key={open.id ?? "new"}
          row={open.id === null ? null : opened}
          districtId={districtId}
          circuits={circuits}
          levels={levels}
          startEditing={open.edit}
          onClose={() => setOpen(null)}
          onSaved={onSaved}
          onDeleted={(id) => setRows((prev) => (prev ?? []).filter((r) => r.id !== id))}
        />
      )}
    </div>
  );
}
