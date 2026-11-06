/** Shared types and helpers for the District school census. */

export interface CensusRow {
  id: string;
  district_id: string;
  name: string;
  community: string | null;
  emis_code: string | null;
  gps: string | null;
  circuit: string | null;
  head_name: string | null;
  head_sex: string | null;
  head_phone: string | null;
  head_email: string | null;
  school_email: string | null;
  school_type: string | null;
  school_level: string | null;
  feeding: string | null;
  established: string | null;
  n: Record<string, number | null>;
  follow_up: string[];
  updated_at?: string | null;
}

export interface CensusLogRow {
  id: string;
  changed_by_name: string | null;
  changed_at: string;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
}

export type Agg = Record<string, number>;

export interface ClassRowDef {
  key: string;
  label: string;
}
export const CLASS_ROWS: ClassRowDef[] = [
  { key: "nur", label: "Nursery / Creche" },
  { key: "kg1", label: "KG1" },
  { key: "kg2", label: "KG2" },
  ...[1, 2, 3, 4, 5, 6].map((i) => ({ key: `p${i}`, label: `B${i}` })),
  ...[1, 2, 3].map((i) => ({ key: `j${i}`, label: `JHS${i}` })),
];
export const PRIMARY_KEYS = ["p1", "p2", "p3", "p4", "p5", "p6"];
export const JHS_KEYS = ["j1", "j2", "j3"];

export const STAFF_LEVELS = [
  { k: "kg", label: "KG" },
  { k: "pri", label: "Primary" },
  { k: "jhs", label: "JHS" },
];
export const OTHER_STAFF: { key: string; label: string }[] = [
  { key: "nss_m", label: "NSS personnel (male)" },
  { key: "nss_f", label: "NSS personnel (female)" },
  { key: "cta_m", label: "Community teaching assistants (male)" },
  { key: "cta_f", label: "Community teaching assistants (female)" },
  { key: "pupil_teachers", label: "Pupil teachers" },
];
export const FACILITY_FIELDS: { key: string; label: string }[] = [
  { key: "room_kg", label: "KG classrooms" },
  { key: "room_pri", label: "Primary classrooms" },
  { key: "room_jhs", label: "JHS classrooms" },
  { key: "desk_hex", label: "Hexagonal desks (KG)" },
  { key: "desk_dual", label: "Dual desks (Primary)" },
  { key: "desk_mono", label: "Mono desks (JHS)" },
  { key: "chairs", label: "Teachers' chairs" },
  { key: "tables", label: "Teachers' tables" },
  { key: "indiscipline", label: "Indiscipline issues" },
];

const classKeys = CLASS_ROWS.flatMap((c) => [`${c.key}_b`, `${c.key}_g`]);
const staffKeys = STAFF_LEVELS.flatMap((l) => [`t_${l.k}_m`, `t_${l.k}_f`, `tt_${l.k}_m`, `tt_${l.k}_f`]);
export const TOTAL_KEYS = ["kg_b", "kg_g", "pri_b", "pri_g", "jhs_b", "jhs_g"];
export const EDITABLE_NUM_KEYS = [...classKeys, ...staffKeys, ...OTHER_STAFF.map((x) => x.key), ...FACILITY_FIELDS.map((x) => x.key)];
export const NUM_KEYS = [...EDITABLE_NUM_KEYS, ...TOTAL_KEYS];

/** KG/Primary/JHS totals are always the sum of the classes. */
export function recomputeTotals(n: Record<string, number | null>): Record<string, number | null> {
  const v = (k: string) => n[k] ?? 0;
  const out = { ...n };
  out.kg_b = v("kg1_b") + v("kg2_b");
  out.kg_g = v("kg1_g") + v("kg2_g");
  out.pri_b = PRIMARY_KEYS.reduce((s, k) => s + v(`${k}_b`), 0);
  out.pri_g = PRIMARY_KEYS.reduce((s, k) => s + v(`${k}_g`), 0);
  out.jhs_b = JHS_KEYS.reduce((s, k) => s + v(`${k}_b`), 0);
  out.jhs_g = JHS_KEYS.reduce((s, k) => s + v(`${k}_g`), 0);
  return out;
}

export const g = (a: Agg, k: string) => a[k] ?? 0;
export const kgT = (a: Agg) => g(a, "kg_b") + g(a, "kg_g");
export const priT = (a: Agg) => g(a, "pri_b") + g(a, "pri_g");
export const jhsT = (a: Agg) => g(a, "jhs_b") + g(a, "jhs_g");
export const grand = (a: Agg) => kgT(a) + priT(a) + jhsT(a);
export const boysT = (a: Agg) => g(a, "kg_b") + g(a, "pri_b") + g(a, "jhs_b");
export const girlsT = (a: Agg) => g(a, "kg_g") + g(a, "pri_g") + g(a, "jhs_g");
export const teachers = (a: Agg) =>
  ["t_kg_m", "t_kg_f", "t_pri_m", "t_pri_f", "t_jhs_m", "t_jhs_f"].reduce((s, k) => s + g(a, k), 0);
export const trained = (a: Agg) =>
  ["tt_kg_m", "tt_kg_f", "tt_pri_m", "tt_pri_f", "tt_jhs_m", "tt_jhs_f"].reduce((s, k) => s + g(a, k), 0);
export const rooms = (a: Agg) => g(a, "room_kg") + g(a, "room_pri") + g(a, "room_jhs");
export const ratio = (x: number, y: number): number | null => (y > 0 ? x / y : null);

export function aggregate(rows: CensusRow[]): Agg {
  const a: Agg = { schools: rows.length };
  for (const k of NUM_KEYS) a[k] = 0;
  for (const r of rows) for (const k of NUM_KEYS) a[k] += r.n[k] ?? 0;
  return a;
}

export function rowTotal(r: CensusRow): number {
  return grand(aggregate([r]));
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "Not stated";
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function levelLabel(s: string | null | undefined): string {
  return s ? s.replace("]", ")") : "Not stated";
}

export function fmt(v: number | null, decimals = 0): string {
  if (v === null || Number.isNaN(v)) return "-";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function pct(x: number, y: number, decimals = 1): string {
  return y > 0 ? `${((x / y) * 100).toFixed(decimals)}%` : "-";
}

/** All the searchable text of a school in one lowercase string. */
export function searchText(r: CensusRow): string {
  return [r.name, r.community, r.circuit, r.emis_code, r.gps, r.head_name, r.head_phone, r.head_email, r.school_email,
    r.school_type, r.school_level, r.feeding, r.established]
    .filter(Boolean)
    .join(" | ")
    .toLowerCase();
}

export const FIELD_LABELS: Record<string, string> = {
  name: "School name", community: "Community", emis_code: "EMIS code", gps: "GPS address", circuit: "Circuit",
  head_name: "Head teacher", head_sex: "Head's sex", head_phone: "Head's phone", head_email: "Head's email",
  school_email: "School email", school_type: "Public/Private", school_level: "School level", feeding: "School feeding",
  established: "Date established", follow_up: "Follow-up list",
};
export function fieldLabel(k: string): string {
  if (FIELD_LABELS[k]) return FIELD_LABELS[k];
  const m = /^(nur|kg1|kg2|p\d|j\d|kg|pri|jhs)_(b|g)$/.exec(k);
  if (m) {
    const cls = CLASS_ROWS.find((c) => c.key === m[1])?.label ?? { kg: "KG total", pri: "Primary total", jhs: "JHS total" }[m[1]] ?? m[1];
    return `${cls} ${m[2] === "b" ? "boys" : "girls"}`;
  }
  const t = /^(t|tt)_(kg|pri|jhs)_(m|f)$/.exec(k);
  if (t) return `${STAFF_LEVELS.find((l) => l.k === t[2])?.label} ${t[1] === "tt" ? "trained " : ""}teachers (${t[3] === "m" ? "male" : "female"})`;
  return OTHER_STAFF.find((x) => x.key === k)?.label ?? FACILITY_FIELDS.find((x) => x.key === k)?.label ?? k;
}
