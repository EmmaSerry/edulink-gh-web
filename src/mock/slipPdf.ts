/**
 * Result slip drawing. Pure layout code: it draws onto anything that looks like a jsPDF document
 * (see PdfDoc), so it can be tested without a browser. One A4 portrait page per learner.
 *
 * What a slip shows: the learner's own marks, grades and remarks, the Mock Aggregate with a clear
 * pass-level word, progress across mocks in plain language, the grading key, a slip code and the
 * disclaimer that this is a school mock, not an official WAEC result. A missing mark is shown as a
 * dash and an absence as "ABS" - never as zero.
 */
import type { GradeBand } from "./mockEngine";

export interface PdfDoc {
  setFont(name: string, style?: string): unknown;
  setFontSize(size: number): unknown;
  setTextColor(r: number, g?: number, b?: number): unknown;
  setDrawColor(r: number, g?: number, b?: number): unknown;
  setFillColor(r: number, g?: number, b?: number): unknown;
  setLineWidth(w: number): unknown;
  text(text: string | string[], x: number, y: number, options?: { align?: "left" | "center" | "right" }): unknown;
  rect(x: number, y: number, w: number, h: number, style?: string): unknown;
  line(x1: number, y1: number, x2: number, y2: number): unknown;
  getTextWidth(text: string): number;
  splitTextToSize(text: string, maxWidth: number): string[];
  addPage(): unknown;
  addImage(data: string, format: string, x: number, y: number, w: number, h: number): unknown;
}

export interface SlipRow {
  name: string;
  isCore: boolean;
  max: number;
  mark: number | null;
  absent: boolean;
  pct: number | null;
  grade: number | null;
  remark: string;
  /** One of the six subjects that make up the aggregate. */
  counted: boolean;
}

export interface SlipData {
  schoolName: string;
  schoolAddress?: string | null;
  headTeacher?: string | null;
  logoDataUrl?: string | null;
  /** Learner passport photo (data URL), optional. */
  photoDataUrl?: string | null;
  mockName: string;
  academicYear: string;
  generatedOn: string;
  learner: { fullName: string; className: string; candidateNo: string };
  bands: GradeBand[];
  lowerIsBetter: boolean;
  rows: SlipRow[];
  status: "complete" | "incomplete" | "no_results" | "absent";
  aggregate: number | null;
  passAggregate: number;
  missing: string[];
  history: Array<{ mockName: string; aggregate: number | null }>;
  progressWord: string | null;
  progressSentence: string | null;
  strongest: string | null;
  weakest: string | null;
  position: { school: number | null; ofSchool: number; class: number | null; ofClass: number } | null;
  code: string;
}

export const PAGE = { w: 210, h: 297, margin: 14 };

/** Short fingerprint of what a slip contains, so a re-generated slip can be matched against a printed one. */
export function slipCode(parts: Array<string | number | null>): string {
  const text = parts.map((p) => (p === null ? "-" : String(p))).join("|");
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).toUpperCase().padStart(8, "0");
  };
  const a = fnv(2166136261);
  const b = fnv(3266489917);
  return `${a.slice(0, 4)}-${a.slice(4)}-${b.slice(0, 4)}`;
}

const NAVY: [number, number, number] = [20, 40, 80];
const GREY: [number, number, number] = [90, 100, 112];
const GREEN: [number, number, number] = [20, 108, 67];
const RED: [number, number, number] = [165, 42, 42];
const AMBER: [number, number, number] = [138, 97, 0];
const LIGHT: [number, number, number] = [238, 241, 246];

function fit(doc: PdfDoc, text: string, maxW: number): string {
  if (doc.getTextWidth(text) <= maxW) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
  return t + "…";
}

export function drawSlip(doc: PdfDoc, d: SlipData): void {
  const L = PAGE.margin;
  const R = PAGE.w - PAGE.margin;
  const W = R - L;
  let y = 14;

  /* ---------- header ---------- */
  let textLeft = L;
  let textRight = R;
  let headerH = 22;
  if (d.photoDataUrl) {
    try {
      const pf = /^data:image\/(png|jpe?g)/i.exec(d.photoDataUrl)?.[1]?.toUpperCase().replace("JPG", "JPEG") ?? "JPEG";
      doc.addImage(d.photoDataUrl, pf, R - 26, y - 4, 26, 32);
      doc.setDrawColor(...NAVY);
      doc.setLineWidth(0.4);
      doc.rect(R - 26, y - 4, 26, 32);
      textRight = R - 30;
      headerH = 31;
    } catch {
      textRight = R;
    }
  }
  if (d.logoDataUrl) {
    try {
      const fmt = /^data:image\/(png|jpe?g)/i.exec(d.logoDataUrl)?.[1]?.toUpperCase().replace("JPG", "JPEG") ?? "PNG";
      doc.addImage(d.logoDataUrl, fmt, L, y - 4, 18, 18);
      textLeft = L + 22;
    } catch {
      textLeft = L;
    }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(fit(doc, d.schoolName.toUpperCase(), textRight - textLeft), textLeft, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...GREY);
  if (d.schoolAddress) doc.text(fit(doc, d.schoolAddress, textRight - textLeft), textLeft, y + 8);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("MOCK EXAMINATION RESULT SLIP", textLeft, y + 18);
  y += headerH;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.6);
  doc.line(L, y, R, y);
  y += 6;

  /* ---------- learner ---------- */
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...GREY);
  doc.text("Learner", L, y);
  doc.text("Class", L + 100, y);
  doc.text("Candidate no.", L + 135, y);
  doc.text("Examination", L, y + 12.5);
  doc.text("Academic year", L + 100, y + 12.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text(fit(doc, d.learner.fullName, 95), L, y + 6);
  doc.text(fit(doc, d.learner.className, 30), L + 100, y + 6);
  doc.text(d.learner.candidateNo, L + 135, y + 6);
  doc.text(fit(doc, d.mockName, 95), L, y + 18);
  doc.text(d.academicYear, L + 100, y + 18);
  y += 26;

  /* ---------- marks table ---------- */
  const cols = { subject: L + 2, mark: L + 78, pct: L + 100, grade: L + 118, remark: L + 132 };
  doc.setFillColor(...NAVY);
  doc.rect(L, y, W, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Subject", cols.subject, y + 5.6);
  doc.text("Mark", cols.mark, y + 5.6, { align: "right" });
  doc.text("%", cols.pct, y + 5.6, { align: "right" });
  doc.text("Grade", cols.grade, y + 5.6, { align: "center" });
  doc.text("Remark", cols.remark, y + 5.6);
  y += 8;

  d.rows.forEach((r, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(...LIGHT);
      doc.rect(L, y, W, 8.2, "F");
    }
    doc.setFont("helvetica", r.counted ? "bold" : "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(0, 0, 0);
    doc.text(fit(doc, r.name + (r.counted ? "  *" : ""), 72), cols.subject, y + 5.6);
    doc.setFont("helvetica", "normal");
    if (r.absent) {
      doc.setTextColor(...GREY);
      doc.text("ABS", cols.mark, y + 5.6, { align: "right" });
      doc.text("Absent", cols.remark, y + 5.6);
    } else if (r.mark === null) {
      doc.setTextColor(...GREY);
      doc.text("-", cols.mark, y + 5.6, { align: "right" });
      doc.text("Not yet available", cols.remark, y + 5.6);
    } else {
      doc.text(`${r.mark}/${r.max}`, cols.mark, y + 5.6, { align: "right" });
      doc.text(r.pct === null ? "-" : r.pct.toFixed(0), cols.pct, y + 5.6, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(r.grade === null ? "-" : String(r.grade), cols.grade, y + 5.6, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.text(fit(doc, r.remark, R - cols.remark - 1), cols.remark, y + 5.6);
    }
    y += 8.2;
  });
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(L, y, R, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  doc.text("* counts towards the Mock Aggregate (four core subjects plus the best two other subjects).", L, y + 5);
  y += 12;

  /* ---------- aggregate box ---------- */
  const pass = d.aggregate !== null && d.aggregate <= d.passAggregate;
  const boxColor = d.aggregate === null ? AMBER : pass ? GREEN : RED;
  doc.setDrawColor(...boxColor);
  doc.setLineWidth(0.8);
  doc.rect(L, y, W, 25);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(...GREY);
  doc.text("MOCK AGGREGATE (lower is better)", L + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...boxColor);
  if (d.aggregate !== null) {
    doc.setFontSize(30);
    doc.text(String(d.aggregate), L + 4, y + 20);
    doc.setFontSize(14);
    doc.text(pass ? "PASS LEVEL" : "BELOW PASS LEVEL", L + 38, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    doc.text(`Pass level is aggregate ${d.passAggregate} or better.`, L + 38, y + 22);
  } else {
    doc.setFontSize(15);
    const why = d.status === "absent" ? "Absent from the examination" : "Not yet available";
    doc.text(why, L + 4, y + 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    if (d.missing.length) doc.text(fit(doc, `Waiting for: ${d.missing.join(", ")}`, W - 80), L + 80, y + 17);
  }
  if (d.position) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GREY);
    const parts: string[] = [];
    if (d.position.school !== null) parts.push(`School position ${d.position.school} of ${d.position.ofSchool}`);
    if (d.position.class !== null) parts.push(`Class position ${d.position.class} of ${d.position.ofClass}`);
    if (parts.length) doc.text(parts.join("   "), R - 3, y + 6, { align: "right" });
  }
  y += 31;

  /* ---------- progress ---------- */
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text("Progress over the mocks", L, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  if (d.history.length > 1) {
    const line = d.history.map((h) => `${h.mockName}: ${h.aggregate === null ? "not complete" : h.aggregate}`).join("   >   ");
    doc.splitTextToSize(line, W).slice(0, 2).forEach((ln, i) => doc.text(ln, L, y + i * 4.5));
    y += Math.min(2, doc.splitTextToSize(line, W).length) * 4.5 + 1;
  } else {
    doc.text("This is the first mock with results for this learner.", L, y);
    y += 5.5;
  }
  if (d.progressWord || d.progressSentence) {
    const tone = d.progressWord === "Improving" ? GREEN : d.progressWord === "Slipping" ? RED : NAVY;
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...tone);
    if (d.progressWord) doc.text(d.progressWord, L, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    if (d.progressSentence) {
      const lines = doc.splitTextToSize(d.progressSentence, W - 32).slice(0, 3);
      lines.forEach((ln, i) => doc.text(ln, L + 32, y + i * 4.5));
      y += Math.max(1, lines.length) * 4.5;
    } else y += 4.5;
    y += 1.5;
  }
  if (d.strongest || d.weakest) {
    doc.setFontSize(10.5);
    if (d.strongest) {
      doc.setTextColor(...GREEN);
      doc.text(fit(doc, `Strongest: ${d.strongest}`, W / 2 - 2), L, y);
    }
    if (d.weakest) {
      doc.setTextColor(...RED);
      doc.text(fit(doc, `Needs most help: ${d.weakest}`, W / 2 - 2), L + W / 2, y);
    }
    y += 6;
  }

  /* ---------- grading key ---------- */
  y += 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text("Grading key", L, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GREY);
  const sorted = [...d.bands].sort((a, b) => (d.lowerIsBetter ? a.grade - b.grade : b.grade - a.grade));
  const perRow = 2;
  const cellW = W / perRow;
  sorted.forEach((b, i) => {
    const cx = L + (i % perRow) * cellW;
    const cy = y + Math.floor(i / perRow) * 5;
    doc.text(fit(doc, `Grade ${b.grade}: ${b.min}-${b.max}  ${b.remark}`, cellW - 2), cx, cy);
  });
  y += Math.ceil(sorted.length / perRow) * 5 + 8;

  /* ---------- signatures ---------- */
  const sigY = Math.max(y + 6, 240);
  doc.setDrawColor(...GREY);
  doc.setLineWidth(0.3);
  doc.line(L, sigY, L + 62, sigY);
  doc.line(R - 62, sigY, R, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GREY);
  doc.text("Class teacher", L, sigY + 4);
  doc.text(d.headTeacher ? `Headteacher: ${d.headTeacher}` : "Headteacher", R - 62, sigY + 4);

  /* ---------- footer ---------- */
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.line(L, 276, R, 276);
  doc.setFontSize(8.5);
  doc.setTextColor(...GREY);
  const note = "This is a school mock examination result: a practice estimate, not an official WAEC result or a prediction of one.";
  doc.splitTextToSize(note, W).forEach((ln, i) => doc.text(ln, L, 281 + i * 3.6));
  doc.text(`Slip code ${d.code}  |  Printed ${d.generatedOn}`, L, 289);
  doc.text("Check: ask the school office to reprint and compare the slip code.", R, 289, { align: "right" });
}

/** Draws a list of slips into one document, one per page. */
export function drawSlips(doc: PdfDoc, slips: SlipData[]): void {
  slips.forEach((s, i) => {
    if (i > 0) doc.addPage();
    drawSlip(doc, s);
  });
}
