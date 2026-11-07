import type { Val } from "./xlsxReader";

/** The one set of rules used by the Excel template AND by the upload check. */
export const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandparent", "Sibling", "Other"];
export const MAX_ROWS = 1000;
/** Age window in days (about 2 to 26 years): same numbers are used inside the Excel formulas. */
export const DOB_MIN_AGE_DAYS = 700;
export const DOB_MAX_AGE_DAYS = 9500;

export interface RawRow {
  first: Val;
  middle: Val;
  last: Val;
  gender: Val;
  dob: Val;
  cls: Val;
  gname: Val;
  rel: Val;
  phone: Val;
}
export interface GoodRow {
  first: string;
  middle: string;
  last: string;
  gender: "M" | "F";
  dob: string; // yyyy-mm-dd
  cls: string; // class label as in the school's list
  gname: string;
  rel: string;
  phone: string; // 0XXXXXXXXX
}

const s = (v: Val): string => (v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim());

export function excelSerialToIso(n: number): string {
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Accepts a real Excel date, or text like 12/05/2014, 12-5-2014 or 2014-05-12. */
export function parseDob(v: Val): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v > 1 && v < 80000 ? excelSerialToIso(v) : null;
  const t = String(v).trim();
  let m = /^(\d{1,2})[/.\-\s](\d{1,2})[/.\-\s](\d{4})$/.exec(t);
  let y: number, mo: number, d: number;
  if (m) {
    d = +m[1];
    mo = +m[2];
    y = +m[3];
  } else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
    if (!m) return null;
    y = +m[1];
    mo = +m[2];
    d = +m[3];
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function normPhone(v: Val): string | null {
  if (v === null || v === undefined) return null;
  let c = String(v).replace(/[\s\-().]/g, "");
  if (c.startsWith("+233")) c = "0" + c.slice(4);
  else if (/^233\d{9}$/.test(c)) c = "0" + c.slice(3);
  if (!/^\d+$/.test(c)) return null;
  if (c.length === 9) c = "0" + c;
  return /^0\d{9}$/.test(c) ? c : null;
}

export function isEmptyRow(r: RawRow): boolean {
  return Object.values(r).every((v) => s(v) === "");
}

export function checkRow(r: RawRow, classLabels: string[], today = new Date()): { ok: true; value: GoodRow } | { ok: false; error: string } {
  const first = s(r.first);
  const last = s(r.last);
  if (!first) return { ok: false, error: "Fill in first name" };
  if (!last) return { ok: false, error: "Fill in last name" };
  const g = s(r.gender).toUpperCase();
  const gender = g === "MALE" || g === "M" ? "M" : g === "FEMALE" || g === "F" ? "F" : null;
  if (!gender) return { ok: false, error: "Gender: choose Male or Female" };
  const dob = parseDob(r.dob);
  if (!dob) return { ok: false, error: "Date of birth: enter a real date (dd/mm/yyyy)" };
  const ageDays = (today.getTime() - new Date(dob + "T00:00:00Z").getTime()) / 86400000;
  if (ageDays < DOB_MIN_AGE_DAYS || ageDays > DOB_MAX_AGE_DAYS) return { ok: false, error: "Date of birth looks wrong (age 2 to 26)" };
  const cls = classLabels.find((c) => c.toLowerCase() === s(r.cls).toLowerCase());
  if (!cls) return { ok: false, error: "Class: choose from the list" };
  const gname = s(r.gname);
  if (!gname) return { ok: false, error: "Fill in parent/guardian name" };
  const rel = RELATIONSHIPS.find((x) => x.toLowerCase() === s(r.rel).toLowerCase());
  if (!rel) return { ok: false, error: "Relationship: choose from the list" };
  const phone = normPhone(r.phone);
  if (!phone) return { ok: false, error: "Phone: 10 digits e.g. 0240000000" };
  return { ok: true, value: { first, middle: s(r.middle), last, gender, dob, cls, gname, rel, phone } };
}

export const dupKey = (first: string, last: string, dob: string) => `${first}|${last}|${dob}`.toLowerCase().replace(/[^a-z0-9|\-]/g, "");

// ---------------------------------------------------------------------------
// Duplicate detection (used on every upload, so the template can be used many times)
// ---------------------------------------------------------------------------

/** A learner already in the school, or an earlier row of the same file. */
export interface Known {
  first: string;
  middle: string;
  last: string;
  dob: string; // yyyy-mm-dd
  cls: string; // class name
  where: string; // text shown to the user, e.g. "registered in Basic 3" or "row 7 of this file"
}

const words = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** First + last name only, order ignored ("Kofi Mensah" = "Mensah Kofi"). */
const coreKey = (k: { first: string; last: string }) => [...words(k.first), ...words(k.last)].sort().join(" ");
/** Every name including the middle name, order ignored. */
const fullKey = (k: { first: string; middle: string; last: string }) => [...words(k.first), ...words(k.middle), ...words(k.last)].sort().join(" ");

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 3) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Names that are the same or nearly the same (a typo, a missing middle name, names swapped). */
function closeNames(a: Known | GoodLike, b: Known): boolean {
  const fa = fullKey(a), fb = fullKey(b);
  if (fa === fb || coreKey(a) === coreKey(b)) return true;
  const ta = fa.split(" "), tb = fb.split(" ");
  const [small, big] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  if (small.length >= 2 && small.every((w) => big.includes(w))) return true;
  return lev(fa, fb) <= (fa.length >= 12 ? 2 : 1);
}
type GoodLike = { first: string; middle: string; last: string; dob: string; cls: string };

/**
 * Finds learners that might be the same child. Rules:
 *  - same class: same name (any order, middle name optional) -> suspected, whatever the birth date;
 *    nearly the same name AND the same birth date -> suspected.
 *  - any class: same name AND same birth date -> suspected (already registered elsewhere in the school).
 */
export class DupIndex {
  private byCore = new Map<string, Known[]>();
  private byDob = new Map<string, Known[]>();
  add(k: Known) {
    const c = coreKey(k);
    this.byCore.set(c, [...(this.byCore.get(c) ?? []), k]);
    this.byDob.set(k.dob, [...(this.byDob.get(k.dob) ?? []), k]);
  }
  find(r: GoodLike): { reason: string } | null {
    const cls = r.cls.toLowerCase();
    for (const k of this.byCore.get(coreKey(r)) ?? []) {
      const sameClass = k.cls.toLowerCase() === cls;
      if (k.dob === r.dob) return { reason: `Same name and birth date as a learner ${k.where}` };
      if (sameClass) return { reason: `Same name as a learner ${k.where} (birth date differs)` };
    }
    for (const k of this.byDob.get(r.dob) ?? []) {
      if (k.cls.toLowerCase() === cls && closeNames(r, k)) return { reason: `Very similar name and same birth date as a learner ${k.where}` };
    }
    return null;
  }
}
