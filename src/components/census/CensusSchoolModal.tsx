import { useEffect, useRef, useState } from "react";
import { CensusService } from "@services/cloud/CensusService";
import { openPrint } from "./censusPrint";
import {
  CLASS_ROWS, EDITABLE_NUM_KEYS, FACILITY_FIELDS, OTHER_STAFF, STAFF_LEVELS, aggregate, fieldLabel, fmt, g, grand,
  jhsT, kgT, levelLabel, pct, priT, recomputeTotals, teachers, titleCase, type CensusLogRow, type CensusRow,
} from "./censusModel";

interface Props {
  /** The school to show, or null to add a new one. */
  row: CensusRow | null;
  districtId: string;
  circuits: string[];
  levels: string[];
  startEditing?: boolean;
  onClose: () => void;
  onSaved: (row: CensusRow) => void;
  onDeleted: (id: string) => void;
}

const TEXT_FIELDS: { key: keyof CensusRow; label: string; type?: string; list?: "circuits" | "levels" }[] = [
  { key: "name", label: "Name of school" },
  { key: "community", label: "Community / location" },
  { key: "circuit", label: "Circuit", list: "circuits" },
  { key: "emis_code", label: "EMIS code" },
  { key: "gps", label: "GPS address" },
  { key: "school_level", label: "School level", list: "levels" },
  { key: "established", label: "Date established", type: "date" },
  { key: "head_name", label: "Head teacher" },
  { key: "head_phone", label: "Head's phone" },
  { key: "head_email", label: "Head's email" },
  { key: "school_email", label: "School email" },
];

type TextForm = Record<string, string>;

function blankText(): TextForm {
  const t: TextForm = {};
  for (const f of TEXT_FIELDS) t[f.key] = "";
  t.school_type = "PUBLIC";
  t.head_sex = "";
  t.feeding = "";
  return t;
}

function toTextForm(r: CensusRow): TextForm {
  const t: TextForm = {};
  for (const f of TEXT_FIELDS) t[f.key] = (r[f.key] as string | null) ?? "";
  t.school_type = r.school_type ?? "";
  t.head_sex = r.head_sex ?? "";
  t.feeding = r.feeding ?? "";
  return t;
}

function toNumForm(r: CensusRow | null): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of EDITABLE_NUM_KEYS) {
    const v = r?.n[k];
    o[k] = v === null || v === undefined ? "" : String(v);
  }
  return o;
}

function show(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(blank)";
  if (Array.isArray(v)) return v.length ? v.join("; ") : "(none)";
  return String(v);
}

export function CensusSchoolModal({ row, districtId, circuits, levels, startEditing, onClose, onSaved, onDeleted }: Props) {
  const creating = row === null;
  const [editing, setEditing] = useState<boolean>(creating || !!startEditing);
  const [text, setText] = useState<TextForm>(row ? toTextForm(row) : blankText());
  const [num, setNum] = useState<Record<string, string>>(toNumForm(row));
  const [followUp, setFollowUp] = useState<string[]>(row?.follow_up ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CensusLogRow[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!row) return;
    setText(toTextForm(row));
    setNum(toNumForm(row));
    setFollowUp(row.follow_up);
  }, [row]);

  useEffect(() => {
    if (!row || !showHistory) return;
    CensusService.history(row.id).then(setHistory).catch(() => setHistory([]));
  }, [row, showHistory]);

  const live: CensusRow | null = row;
  const a = aggregate(live ? [live] : []);

  // Totals shown while editing come from the numbers typed so far.
  const typed: Record<string, number | null> = {};
  for (const k of EDITABLE_NUM_KEYS) typed[k] = num[k] === "" ? null : Number(num[k]);
  const t = recomputeTotals(typed);
  const ea: Record<string, number> = {};
  for (const k of Object.keys(t)) ea[k] = t[k] ?? 0;

  const view = editing ? ea : (a as Record<string, number>);

  async function save() {
    setError(null);
    if (!text.name.trim()) return setError("Please enter the name of the school.");
    if (!["PUBLIC", "PRIVATE"].includes(text.school_type.toUpperCase())) return setError("Choose Public or Private.");
    for (const k of EDITABLE_NUM_KEYS) {
      if (num[k] !== "" && (!/^\d+$/.test(num[k]) || Number(num[k]) > 100000)) {
        return setError(`"${fieldLabel(k)}" must be a whole number (0 or more).`);
      }
    }
    const clean = (s: string): string | null => (s.trim() === "" ? null : s.trim());
    const payload = {
      name: text.name.trim(),
      community: clean(text.community),
      emis_code: clean(text.emis_code),
      gps: clean(text.gps),
      circuit: clean(text.circuit)?.toUpperCase() ?? null,
      head_name: clean(text.head_name),
      head_sex: clean(text.head_sex)?.toUpperCase() ?? null,
      head_phone: clean(text.head_phone),
      head_email: clean(text.head_email),
      school_email: clean(text.school_email),
      school_type: text.school_type.toUpperCase(),
      school_level: clean(text.school_level),
      feeding: clean(text.feeding)?.toUpperCase() ?? null,
      established: clean(text.established),
      n: recomputeTotals(typed),
      follow_up: followUp,
    };
    setBusy(true);
    try {
      const saved = row ? await CensusService.update(row.id, payload) : await CensusService.create(districtId, payload);
      onSaved(saved);
      if (creating) onClose();
      else {
        setEditing(false);
        if (showHistory) CensusService.history(saved.id).then(setHistory).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!row) return;
    if (!window.confirm(`Delete ${row.name} from the census permanently? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await CensusService.remove(row.id);
      onDeleted(row.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setBusy(false);
    }
  }

  function printProfile() {
    if (!printRef.current || !row) return;
    const ra = aggregate([row]);
    openPrint({
      title: row.name,
      subtitle: [row.community, row.head_name ? `Head teacher: ${titleCase(row.head_name)}` : "", row.head_phone].filter(Boolean).join("  |  "),
      chips: [titleCase(row.school_type), levelLabel(row.school_level), `${titleCase(row.circuit)} circuit`, row.emis_code ? `EMIS ${row.emis_code}` : "", row.gps ?? ""].filter(Boolean),
      kpis: [
        { label: "Pupils (KG to JHS)", value: fmt(grand(ra)) },
        { label: "Boys", value: fmt(g(ra, "kg_b") + g(ra, "pri_b") + g(ra, "jhs_b")) },
        { label: "Girls", value: fmt(g(ra, "kg_g") + g(ra, "pri_g") + g(ra, "jhs_g")) },
        { label: "Teachers", value: fmt(teachers(ra)) },
      ],
      bodyHtml: printRef.current.innerHTML,
      useAppStyles: true,
    });
  }

  function setT(k: string, v: string) {
    setText((p) => ({ ...p, [k]: v }));
  }
  function setN(k: string, v: string) {
    setNum((p) => ({ ...p, [k]: v }));
  }
  const numInput = (k: string) =>
    editing ? (
      <input
        type="number"
        min={0}
        className="form-control form-control-sm text-end"
        style={{ width: 84, display: "inline-block" }}
        value={num[k]}
        onChange={(e) => setN(k, e.target.value)}
      />
    ) : (
      <span>{row?.n[k] === null || row?.n[k] === undefined ? "-" : fmt(row?.n[k] ?? 0)}</span>
    );

  const hasFlag = (label: string) => followUp.includes(label);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 2000, overflowY: "auto", padding: "20px 10px" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && !editing) onClose(); }}
    >
      <div className="actrs-card p-3 p-md-4" style={{ maxWidth: 980, margin: "0 auto", background: "var(--bs-body-bg, #fff)" }}>
        <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-3">
          <div>
            <h2 className="h5 mb-1">{creating ? "Add a school" : row?.name}</h2>
            {!creating && row && (
              <div className="d-flex gap-2 flex-wrap">
                <span className={`badge ${row.school_type === "PRIVATE" ? "text-bg-warning" : "text-bg-success"}`}>{titleCase(row.school_type)}</span>
                <span className="badge text-bg-secondary">{levelLabel(row.school_level)}</span>
                <span className="badge text-bg-info">{titleCase(row.circuit)} circuit</span>
                {row.follow_up.length > 0 && <span className="badge text-bg-danger">{row.follow_up.length} to follow up</span>}
              </div>
            )}
          </div>
          <div className="d-flex gap-2 flex-wrap">
            {!creating && !editing && (
              <>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing(true)}>
                  <i className="bi bi-pencil-square me-1" />Edit
                </button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={printProfile}>
                  <i className="bi bi-printer me-1" />Print
                </button>
              </>
            )}
            {editing && (
              <>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={save}>
                  {busy ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={busy}
                  onClick={() => (creating ? onClose() : (setEditing(false), row && (setText(toTextForm(row)), setNum(toNumForm(row)), setFollowUp(row.follow_up), setError(null))))}
                >
                  Cancel
                </button>
              </>
            )}
            {!editing && (
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
            )}
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <datalist id="census-circuits">{circuits.map((c) => <option key={c} value={c} />)}</datalist>
        <datalist id="census-levels">{levels.map((c) => <option key={c} value={c} />)}</datalist>

        <div ref={printRef}>
          <h3 className="h6 fw-bold mt-2">Identity and contacts</h3>
          <div className="row g-2">
            {TEXT_FIELDS.map((f) => (
              <div className="col-md-6" key={f.key}>
                <label className="form-label small mb-0 text-muted">
                  {f.label}
                  {hasFlag(fieldLabelToHeader(f.key)) && <span className="badge text-bg-danger ms-1">follow up</span>}
                </label>
                {editing ? (
                  <input
                    className="form-control form-control-sm"
                    type={f.type ?? "text"}
                    list={f.list ? `census-${f.list}` : undefined}
                    value={text[f.key]}
                    onChange={(e) => setT(f.key, e.target.value)}
                  />
                ) : (
                  <div>{f.key === "circuit" ? titleCase(row?.circuit) : f.key === "school_level" ? levelLabel(row?.school_level) : ((row?.[f.key] as string | null) ?? "-") || "-"}</div>
                )}
              </div>
            ))}
            <div className="col-md-4">
              <label className="form-label small mb-0 text-muted">Public / Private</label>
              {editing ? (
                <select className="form-select form-select-sm" value={text.school_type} onChange={(e) => setT("school_type", e.target.value)}>
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              ) : (
                <div>{titleCase(row?.school_type)}</div>
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-0 text-muted">Head's sex</label>
              {editing ? (
                <select className="form-select form-select-sm" value={text.head_sex} onChange={(e) => setT("head_sex", e.target.value)}>
                  <option value="">Not stated</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              ) : (
                <div>{titleCase(row?.head_sex)}</div>
              )}
            </div>
            <div className="col-md-4">
              <label className="form-label small mb-0 text-muted">School feeding programme</label>
              {editing ? (
                <select className="form-select form-select-sm" value={text.feeding} onChange={(e) => setT("feeding", e.target.value)}>
                  <option value="">Not stated</option>
                  <option value="YES">Yes</option>
                  <option value="NO">No</option>
                </select>
              ) : (
                <div>{row?.feeding === "YES" ? "Yes" : row?.feeding === "NO" ? "No" : "Not stated"}</div>
              )}
            </div>
          </div>

          <h3 className="h6 fw-bold mt-4">Enrolment by class</h3>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-1">
              <thead>
                <tr><th>Class</th><th className="text-end">Boys</th><th className="text-end">Girls</th><th className="text-end">Total</th></tr>
              </thead>
              <tbody>
                {CLASS_ROWS.map((c) => {
                  const b = editing ? Number(num[`${c.key}_b`] || 0) : g(view, `${c.key}_b`);
                  const gl = editing ? Number(num[`${c.key}_g`] || 0) : g(view, `${c.key}_g`);
                  return (
                    <tr key={c.key}>
                      <td>{c.label}</td>
                      <td className="text-end">{numInput(`${c.key}_b`)}</td>
                      <td className="text-end">{numInput(`${c.key}_g`)}</td>
                      <td className="text-end">{fmt(b + gl)}</td>
                    </tr>
                  );
                })}
                {[
                  ["Total KG", "kg"],
                  ["Total Primary", "pri"],
                  ["Total JHS", "jhs"],
                ].map(([label, k]) => (
                  <tr key={k} className="fw-semibold">
                    <td>{label}</td>
                    <td className="text-end">{fmt(g(view, `${k}_b`))}</td>
                    <td className="text-end">{fmt(g(view, `${k}_g`))}</td>
                    <td className="text-end">{fmt(g(view, `${k}_b`) + g(view, `${k}_g`))}</td>
                  </tr>
                ))}
                <tr className="fw-bold">
                  <td>GRAND TOTAL (KG + Primary + JHS)</td>
                  <td className="text-end">{fmt(g(view, "kg_b") + g(view, "pri_b") + g(view, "jhs_b"))}</td>
                  <td className="text-end">{fmt(g(view, "kg_g") + g(view, "pri_g") + g(view, "jhs_g"))}</td>
                  <td className="text-end">{fmt(grand(view))}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-muted" style={{ fontSize: "0.72rem" }}>
            Totals are worked out from the classes. Nursery/Creche is not part of the Grand Total.
            {!editing && ` Girls: ${pct(g(view, "kg_g") + g(view, "pri_g") + g(view, "jhs_g"), grand(view))}. KG ${fmt(kgT(view))}, Primary ${fmt(priT(view))}, JHS ${fmt(jhsT(view))}.`}
          </div>

          <h3 className="h6 fw-bold mt-4">Teachers</h3>
          <div className="table-responsive">
            <table className="table table-sm align-middle mb-1">
              <thead>
                <tr><th>Level</th><th className="text-end">Male</th><th className="text-end">Female</th><th className="text-end">Trained male</th><th className="text-end">Trained female</th></tr>
              </thead>
              <tbody>
                {STAFF_LEVELS.map((l) => (
                  <tr key={l.k}>
                    <td>{l.label}</td>
                    <td className="text-end">{numInput(`t_${l.k}_m`)}</td>
                    <td className="text-end">{numInput(`t_${l.k}_f`)}</td>
                    <td className="text-end">{numInput(`tt_${l.k}_m`)}</td>
                    <td className="text-end">{numInput(`tt_${l.k}_f`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="row g-2 mt-1">
            {OTHER_STAFF.map((f) => (
              <div className="col-md-4" key={f.key}>
                <div className="d-flex justify-content-between align-items-center border rounded px-2 py-1">
                  <span className="small">{f.label}</span>
                  {numInput(f.key)}
                </div>
              </div>
            ))}
          </div>

          <h3 className="h6 fw-bold mt-4">Classrooms and furniture</h3>
          <div className="row g-2">
            {FACILITY_FIELDS.map((f) => (
              <div className="col-md-4" key={f.key}>
                <div className="d-flex justify-content-between align-items-center border rounded px-2 py-1">
                  <span className="small">{f.label}</span>
                  {numInput(f.key)}
                </div>
              </div>
            ))}
          </div>

          {followUp.length > 0 && (
            <>
              <h3 className="h6 fw-bold mt-4">To follow up with the school</h3>
              <div className="d-flex flex-wrap gap-2">
                {followUp.map((f) => (
                  <span key={f} className="badge text-bg-danger d-inline-flex align-items-center gap-1">
                    {f}
                    {editing && (
                      <button
                        type="button"
                        className="btn btn-sm btn-light py-0 px-1"
                        style={{ fontSize: "0.65rem" }}
                        title="Mark as sorted out"
                        onClick={() => setFollowUp((p) => p.filter((x) => x !== f))}
                      >
                        Sorted
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {!creating && (
          <div className="mt-4 pt-3 border-top">
            <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setShowHistory((s) => !s)}>
              {showHistory ? "Hide" : "Show"} who changed what
            </button>
            {showHistory && (
              <div className="mt-2 small">
                {history === null && <div className="text-muted">Loading…</div>}
                {history !== null && history.length === 0 && <div className="text-muted">No changes recorded yet.</div>}
                {(history ?? []).map((h) => (
                  <div key={h.id} className="mb-2">
                    <b>{new Date(h.changed_at).toLocaleString()}</b> by {h.changed_by_name ?? "someone"}: {h.action.toLowerCase()}
                    <ul className="mb-0">
                      {Object.entries(h.changes ?? {}).slice(0, 12).map(([k, v]) => (
                        <li key={k}>
                          {fieldLabel(k)}: {show(v.old)} &rarr; {show(v.new)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {editing && !creating && (
          <div className="mt-3">
            <button type="button" className="btn btn-outline-danger btn-sm" disabled={busy} onClick={remove}>
              <i className="bi bi-trash me-1" />Delete this school from the census
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Follow-up flags are stored under the spreadsheet's own heading, so map our field to it. */
function fieldLabelToHeader(k: keyof CensusRow): string {
  const m: Record<string, string> = {
    name: "NAME OF SCHOOL",
    community: "LOCATION OF SCHOOL [COMMUNITY]",
    circuit: "CIRCUIT",
    emis_code: "EMIS CODE",
    gps: "SCHOOL GPS ADDRESS [WW-XXXX-XXXX]",
    school_level: "SCHOOL LEVEL",
    established: "DATE ESTABLISHED",
    head_phone: "CONTACT NUMBER OF HEADTEACHER",
    head_email: "EMAIL OF HEADTEACHER",
    school_email: "INSTITUTIONAL EMAIL OF SCHOOL",
  };
  return m[k as string] ?? "";
}
