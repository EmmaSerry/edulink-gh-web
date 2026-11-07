import { downloadBook, Sheet, ref, type St } from "./xlsxBook";
import { g, titleCase, type CensusRow } from "./censusModel";

/**
 * The Super Admin workbook: Summary, Fee Setup, then one worksheet per group
 * (12 circuits + the Private Schools group). Everything that can change is a live
 * formula, so editing a fee or a pupil figure updates every sheet.
 */
export interface WbGroup {
  name: string;
  schools: CensusRow[];
  paid: number;
}

const NAVY = "#0A1F44";
const LINE = "#D5DCEA";
const PAL: [string, string][] = [
  ["#0A1F44", "#1C6FEB"], ["#3B1C8C", "#7A5CFA"], ["#0B5E6E", "#16A3B8"], ["#8C1C5A", "#E64A9B"], ["#7A4B00", "#F0A500"],
  ["#0A5C3F", "#2DBE8C"], ["#1C3F8C", "#4C8DFF"], ["#5A1C8C", "#B15CFA"], ["#8C3B1C", "#FA8C5C"], ["#1C5E8C", "#5CC8FA"],
  ["#4E6E10", "#9CD83C"], ["#7A1C2E", "#F2546E"], ["#2E2E7A", "#8C8CFA"],
];
const N = (r: CensusRow, k: string) => g(r.n as Record<string, number>, k);
const FEE = "'Fee Setup'!";
const q = (n: string) => `'${n.replace(/'/g, "''")}'!`;

function safeName(raw: string, used: Set<string>): string {
  let n = raw.replace(/[\\/?*[\]:']/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Group";
  let k = 2;
  const base = n;
  while (used.has(n.toLowerCase())) n = base.slice(0, 28) + " " + k++;
  used.add(n.toLowerCase());
  return n;
}

export function downloadFeeWorkbook(o: { groups: WbGroup[]; sports: number; culture: number; region: number; district: string; filename: string }): void {
  const date = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const used = new Set<string>(["summary", "fee setup"]);
  const names = o.groups.map((gr) => safeName(titleCase(gr.name), used));

  // shared styles
  const banner = (pal: [string, string]): St => ({ grad: pal, deg: 0, color: "#FFFFFF", b: true, sz: 20, v: "center", indent: 1 });
  const sub = (pal: [string, string]): St => ({ grad: pal, deg: 0, color: "#EAF2FE", sz: 11, v: "center", indent: 1 });
  const head = (pal: [string, string]): St => ({ grad: pal, deg: 0, color: "#FFFFFF", b: true, h: "center", v: "center", wrap: true, border: LINE });
  const txt = (alt: boolean): St => ({ fill: alt ? "#F3F6FC" : "#FFFFFF", border: LINE, v: "center" });
  const numS = (alt: boolean): St => ({ ...txt(alt), fmt: "#,##0", h: "right" });
  const moneyS = (alt: boolean): St => ({ ...txt(alt), fmt: "#,##0.00", h: "right" });
  const totS: St = { grad: ["#FFE08A", "#F0A500"], deg: 0, b: true, border: "#B07A00", color: NAVY, fmt: "#,##0", h: "right", v: "center" };
  const totT: St = { ...totS, h: "left", fmt: undefined };
  const totM: St = { ...totS, fmt: "#,##0.00" };
  const inputS: St = { fill: "#FFF4C2", border: "#E0A000", b: true, fmt: "#,##0.00", h: "right", v: "center", color: "#7A4B00" };
  const section = (pal: [string, string]): St => ({ grad: pal, deg: 0, color: "#FFFFFF", b: true, sz: 12, v: "center", indent: 1 });
  const card = (pal: [string, string], part: "l" | "v" | "s", fmt?: string): St => ({
    grad: pal,
    deg: 90,
    color: "#FFFFFF",
    h: "center",
    v: "center",
    b: part !== "s",
    sz: part === "l" ? 10 : part === "v" ? 18 : 9,
    fmt,
  });

  const sheets: Sheet[] = [];

  // ---------------- group sheets (built first so the Summary can point at them)
  const SPARE = 8;
  const info = o.groups.map((gr, gi) => {
    const sh = new Sheet(names[gi]);
    const pal = PAL[gi % PAL.length];
    sh.tab = pal[1].replace("#", "");
    sh.widths = [2, 6, 40, 22, 10, 12, 12, 13, 12, 12, 13, 18, 24];
    const first = 10;
    const nRows = gr.schools.length + SPARE;
    const T = first + nRows; // total row
    const last = T - 1;
    sh.merge(1, 2, 1, 13, { v: `${titleCase(gr.name).toUpperCase()}`, s: banner(pal) });
    sh.heights.set(1, 34);
    sh.merge(2, 2, 2, 13, { v: `${o.district}  |  Enrolment (Primary and JHS) and fees  |  ${date}`, s: sub(pal) });
    sh.heights.set(2, 22);
    sh.set(3, 2, { v: "« Back to Summary", s: { color: "#1C6FEB", b: true } });
    sh.links.push({ ref: ref(3, 2), location: "'Summary'!A1" });

    // KPI cards (live)
    const cards: [number, number, string, string, string?][] = [
      [2, 3, "SCHOOLS", `COUNTA(C${first}:C${last})`],
      [4, 5, "PUPILS COUNTED", `L${T}`, "#,##0"],
      [6, 8, "TOTAL PRIMARY", `H${T}`, "#,##0"],
      [9, 11, "TOTAL JHS", `K${T}`, "#,##0"],
      [12, 12, "FEE PER PUPIL", `${FEE}$C$10`, '"GH₵ "#,##0.00'],
      [13, 13, "FEE PAYABLE", `M${T}`, '"GH₵ "#,##0.00'],
    ];
    cards.forEach(([c1, c2, label, f, fmt], ci) => {
      const p = PAL[(gi + ci) % PAL.length];
      sh.merge(5, c1, 5, c2, { v: label, s: card(p, "l") });
      sh.merge(6, c1, 6, c2, { f, s: card(p, "v", fmt ?? "#,##0") });
      sh.merge(7, c1, 7, c2, { v: ci === 1 ? "Primary + JHS" : ci === 4 ? "per pupil" : " ", s: card(p, "s") });
    });
    sh.heights.set(5, 18);
    sh.heights.set(6, 34);
    sh.heights.set(7, 16);

    const heads = ["No.", "Name of school", "Circuit", "Type", "Primary Boys", "Primary Girls", "Total Primary", "JHS Boys", "JHS Girls", "Total JHS", "Pupils counted", "Fee payable (GH₵)"];
    heads.forEach((h, i) => sh.set(9, 2 + i, { v: h, s: head(pal) }));
    sh.heights.set(9, 34);
    const sorted = gr.schools.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < nRows; i++) {
      const r = first + i;
      const alt = i % 2 === 1;
      const s = sorted[i];
      sh.set(r, 2, { v: s ? i + 1 : null, s: { ...txt(alt), h: "center" } });
      sh.set(r, 3, { v: s ? s.name : null, s: { ...txt(alt), b: true } });
      sh.set(r, 4, { v: s ? titleCase(s.circuit) : null, s: txt(alt) });
      sh.set(r, 5, { v: s ? titleCase(s.school_type) : null, s: { ...txt(alt), h: "center" } });
      sh.set(r, 6, { v: s ? N(s, "pri_b") : null, s: numS(alt) });
      sh.set(r, 7, { v: s ? N(s, "pri_g") : null, s: numS(alt) });
      sh.set(r, 8, { f: `IF(COUNT(F${r}:G${r})=0,"",N(F${r})+N(G${r}))`, s: { ...numS(alt), b: true } });
      sh.set(r, 9, { v: s ? N(s, "jhs_b") : null, s: numS(alt) });
      sh.set(r, 10, { v: s ? N(s, "jhs_g") : null, s: numS(alt) });
      sh.set(r, 11, { f: `IF(COUNT(I${r}:J${r})=0,"",N(I${r})+N(J${r}))`, s: { ...numS(alt), b: true } });
      sh.set(r, 12, { f: `IF(COUNT(H${r},K${r})=0,"",N(H${r})+N(K${r}))`, s: { ...numS(alt), b: true } });
      sh.set(r, 13, { f: `IF(L${r}="","",L${r}*${FEE}$C$10)`, s: moneyS(alt) });
    }
    sh.merge(T, 2, T, 5, { v: `TOTAL (${gr.schools.length} school${gr.schools.length === 1 ? "" : "s"} + room for more)`, s: totT });
    ["F", "G", "H", "I", "J", "K", "L"].forEach((c, i) => sh.set(T, 6 + i, { f: `SUM(${c}${first}:${c}${last})`, s: totS }));
    sh.set(T, 13, { f: `SUM(M${first}:M${last})`, s: totM });
    sh.heights.set(T, 24);
    sh.bar(`L${first}:L${last}`, pal[1].replace("#", ""));
    sh.scale(`H${first}:H${last}`, "#FFFFFF", "#BFD8FF");
    sh.scale(`K${first}:K${last}`, "#FFFFFF", "#E3C8FF");
    sh.freeze = [9, 3];

    // summary portions under the table
    const S = T + 2;
    sh.merge(S, 2, S, 5, { v: "ENROLMENT SUMMARY", s: section(pal) });
    sh.merge(S, 9, S, 13, { v: "FEE SUMMARY", s: section(pal) });
    const left: [string, string, string][] = [
      ["Total boys (Primary + JHS)", `F${T}+I${T}`, "#,##0"],
      ["Total girls (Primary + JHS)", `G${T}+J${T}`, "#,##0"],
      ["Girls as % of pupils", `IF(L${T}=0,0,(G${T}+J${T})/L${T})`, "0.0%"],
      ["Primary as % of pupils", `IF(L${T}=0,0,H${T}/L${T})`, "0.0%"],
      ["JHS as % of pupils", `IF(L${T}=0,0,K${T}/L${T})`, "0.0%"],
      ["Average pupils per school", `IF(COUNTA(C${first}:C${last})=0,0,L${T}/COUNTA(C${first}:C${last}))`, "#,##0.0"],
    ];
    left.forEach(([l, f, fmt], i) => {
      const r = S + 1 + i;
      sh.merge(r, 2, r, 4, { v: l, s: { ...txt(i % 2 === 1), b: true } });
      sh.set(r, 5, { f, s: { ...txt(i % 2 === 1), fmt, h: "right", b: true, color: pal[0] } });
    });
    const gRow = 10 + gi; // this group's row on the Summary sheet
    const right: [string, string, string, boolean?][] = [
      ["Sports fee", `L${T}*${FEE}$C$7`, '"GH₵ "#,##0.00'],
      ["Culture fee", `L${T}*${FEE}$C$8`, '"GH₵ "#,##0.00'],
      ["Region fee", `L${T}*${FEE}$C$9`, '"GH₵ "#,##0.00'],
      ["Total payable", `M${T}`, '"GH₵ "#,##0.00'],
      ["Amount paid (edit on Summary)", `Summary!L${gRow}`, '"GH₵ "#,##0.00'],
      ["Outstanding balance", `MAX(0,M${T}-Summary!L${gRow})`, '"GH₵ "#,##0.00'],
    ];
    right.forEach(([l, f, fmt], i) => {
      const r = S + 1 + i;
      sh.merge(r, 9, r, 11, { v: l, s: { ...txt(i % 2 === 1), b: true } });
      sh.merge(r, 12, r, 13, { f, s: { ...txt(i % 2 === 1), fmt, h: "right", b: true, color: pal[0] } });
    });
    const rs = S + 1 + right.length;
    sh.merge(rs, 9, rs, 11, { v: "Status", s: { ...txt(false), b: true } });
    sh.merge(rs, 12, rs, 13, { f: `IF(M${T}=0,"NO FEE",IF(Summary!L${gRow}>=M${T},"PAID","OWING"))`, s: { ...txt(false), h: "center", b: true } });
    sh.status(`L${rs}`, [["PAID", 0], ["OWING", 1], ["NO FEE", 2]]);
    sh.merge(rs + 2, 2, rs + 2, 13, { v: "To update: type new figures in the white/striped cells (or add a school in the spare rows above the total). Totals, fees and the Summary sheet recalculate by themselves.", s: { i: true, color: "#5B6B8C", wrap: true, v: "top" } });
    sh.heights.set(rs + 2, 30);
    sheets.push(sh);
    return { T, first, last };
  });

  // ---------------- Summary
  const sum = new Sheet("Summary");
  sum.tab = "F0A500";
  sum.widths = [2, 30, 9, 12, 12, 13, 12, 12, 12, 14, 17, 17, 17, 12, 13];
  const spal: [string, string] = ["#0A1F44", "#7A5CFA"];
  sum.merge(1, 2, 1, 15, { v: `${o.district.toUpperCase()}: ENROLMENT AND SPORTS, CULTURE & REGION FEES`, s: banner(spal) });
  sum.heights.set(1, 36);
  sum.merge(2, 2, 2, 15, { v: `Summary of all ${o.groups.length} groups (circuits and private schools). Pupils counted = Primary + JHS; KG and Nursery/Creche are not counted.   |   ${date}`, s: sub(spal) });
  sum.heights.set(2, 22);
  const G = o.groups.length;
  const TR = 10 + G; // total row
  const kc: [number, number, string, string, string][] = [
    [2, 2, "SCHOOLS", `C${TR}`, "#,##0"],
    [3, 5, "PUPILS COUNTED", `J${TR}`, "#,##0"],
    [6, 8, "FEE PER PUPIL", `${FEE}C10`, '"GH₵ "#,##0.00'],
    [9, 11, "TOTAL PAYABLE", `K${TR}`, '"GH₵ "#,##0.00'],
    [12, 13, "TOTAL PAID", `L${TR}`, '"GH₵ "#,##0.00'],
    [14, 15, "OUTSTANDING", `M${TR}`, '"GH₵ "#,##0.00'],
  ];
  kc.forEach(([c1, c2, l, f, fmt], i) => {
    const p = PAL[i % PAL.length];
    sum.merge(4, c1, 4, c2, { v: l, s: card(p, "l") });
    sum.merge(5, c1, 5, c2, { f, s: card(p, "v", fmt) });
    sum.merge(6, c1, 6, c2, { v: " ", s: card(p, "s") });
  });
  sum.heights.set(4, 18);
  sum.heights.set(5, 34);
  sum.heights.set(6, 8);
  sum.merge(8, 2, 8, 15, { v: "ALL GROUPS AT A GLANCE (click a group name to open its worksheet)", s: section(spal) });
  const sh = ["Group", "Schools", "Primary Boys", "Primary Girls", "Total Primary", "JHS Boys", "JHS Girls", "Total JHS", "Pupils counted", "Amount payable (GH₵)", "Amount paid (GH₵)", "Outstanding (GH₵)", "Status", "Share of pupils"];
  sh.forEach((h, i) => sum.set(9, 2 + i, { v: h, s: head(spal) }));
  sum.heights.set(9, 36);
  o.groups.forEach((gr, i) => {
    const r = 10 + i;
    const alt = i % 2 === 1;
    const { T, first, last } = info[i];
    const nm = q(names[i]);
    sum.set(r, 2, { v: titleCase(gr.name), s: { ...txt(alt), b: true, color: "#1C4FD0" } });
    sum.links.push({ ref: ref(r, 2), location: `${nm}A1` });
    sum.set(r, 3, { f: `COUNTA(${nm}C${first}:C${last})`, s: numS(alt) });
    ["F", "G", "H", "I", "J", "K", "L", "M"].forEach((c, k) => sum.set(r, 4 + k, { f: `${nm}${c}${T}`, s: k === 7 ? moneyS(alt) : numS(alt) }));
    sum.set(r, 12, { v: gr.paid, s: { ...inputS } });
    sum.set(r, 13, { f: `MAX(0,K${r}-L${r})`, s: moneyS(alt) });
    sum.set(r, 14, { f: `IF(K${r}=0,"NO FEE",IF(L${r}>=K${r},"PAID","OWING"))`, s: { ...txt(alt), h: "center", b: true } });
    sum.set(r, 15, { f: `IF(J$${TR}=0,0,J${r}/J$${TR})`, s: { ...txt(alt), fmt: "0.0%", h: "right" } });
  });
  sum.set(TR, 2, { v: "ALL GROUPS", s: totT });
  ["C", "D", "E", "F", "G", "H", "I", "J"].forEach((c, i) => sum.set(TR, 3 + i, { f: `SUM(${c}10:${c}${TR - 1})`, s: totS }));
  ["K", "L", "M"].forEach((c, i) => sum.set(TR, 11 + i, { f: `SUM(${c}10:${c}${TR - 1})`, s: totM }));
  sum.set(TR, 14, { f: `COUNTIF(N10:N${TR - 1},"PAID")&" of "&COUNTA(B10:B${TR - 1})&" paid"`, s: { ...totS, h: "center", fmt: undefined } });
  sum.set(TR, 15, { f: `SUM(O10:O${TR - 1})`, s: { ...totS, fmt: "0.0%" } });
  sum.heights.set(TR, 26);
  sum.bar(`J10:J${TR - 1}`, "7A5CFA");
  sum.bar(`O10:O${TR - 1}`, "2DBE8C");
  sum.status(`N10:N${TR - 1}`, [["PAID", 0], ["OWING", 1], ["NO FEE", 2]]);
  sum.freeze = [9, 2];
  sum.merge(TR + 2, 2, TR + 2, 15, { v: "Yellow cells are for you: type what each group has paid in 'Amount paid'. To change the fees go to the 'Fee Setup' sheet. Add schools in the spare rows of a group sheet; everything here updates automatically.", s: { i: true, color: "#5B6B8C", wrap: true, v: "top" } });
  sum.heights.set(TR + 2, 32);
  sum.chart = {
    title: "Primary and JHS pupils by group",
    cats: `Summary!$B$10:$B$${TR - 1}`,
    series: [
      { name: "Summary!$F$9", ref: `Summary!$F$10:$F$${TR - 1}`, color: "#1C6FEB" },
      { name: "Summary!$I$9", ref: `Summary!$I$10:$I$${TR - 1}`, color: "#E64A9B" },
    ],
    stacked: true,
    from: [1, TR + 3],
    to: [9, TR + 23],
  };

  // ---------------- Fee Setup
  const fee = new Sheet("Fee Setup");
  fee.tab = "0A7D5A";
  fee.widths = [2, 36, 22, 16, 16, 16, 20];
  const fpal: [string, string] = ["#0A5C3F", "#2DBE8C"];
  fee.merge(1, 2, 1, 7, { v: "FEE SETUP", s: banner(fpal) });
  fee.heights.set(1, 34);
  fee.merge(2, 2, 2, 7, { v: "Set the fee per pupil once. Every sheet in this workbook uses it. Pupils counted = Primary + JHS (KG and Nursery/Creche are excluded).", s: sub(fpal) });
  fee.heights.set(2, 22);
  fee.merge(4, 2, 4, 7, { v: "1. FEE PER PUPIL (GH₵): type in the yellow cells", s: section(fpal) });
  fee.set(6, 2, { v: "Component", s: head(fpal) });
  fee.set(6, 3, { v: "Amount per pupil (GH₵)", s: head(fpal) });
  fee.merge(6, 4, 6, 7, { v: "What it is for", s: head(fpal) });
  const comps: [string, number, string][] = [["Sports", o.sports, "Sports affiliation"], ["Culture", o.culture, "Culture"], ["Region", o.region, "Regional levy"]];
  comps.forEach(([l, v, d], i) => {
    const r = 7 + i;
    fee.set(r, 2, { v: l, s: { ...txt(i % 2 === 1), b: true } });
    fee.set(r, 3, { v, s: inputS });
    fee.merge(r, 4, r, 7, { v: d, s: txt(i % 2 === 1) });
  });
  fee.set(10, 2, { v: "TOTAL PER PUPIL", s: totT });
  fee.set(10, 3, { f: "SUM(C7:C9)", s: totM });
  fee.merge(10, 4, 10, 7, { v: "= Sports + Culture + Region (used everywhere)", s: { ...totT, b: false, i: true } });
  fee.heights.set(10, 26);
  fee.merge(12, 2, 12, 7, { v: "2. QUICK CALCULATOR", s: section(fpal) });
  fee.set(13, 2, { v: "Number of pupils (type any number)", s: { ...txt(false), b: true } });
  fee.set(13, 3, { v: 100, s: { ...inputS, fmt: "#,##0" } });
  const calc: [string, string][] = [["Sports", "C13*C7"], ["Culture", "C13*C8"], ["Region", "C13*C9"], ["Fee payable", "C13*C10"]];
  calc.forEach(([l, f], i) => {
    fee.set(14 + i, 2, { v: l, s: { ...txt(i % 2 === 1), b: true } });
    fee.set(14 + i, 3, { f, s: { ...moneyS(i % 2 === 1), b: i === 3 } });
  });
  fee.merge(19, 2, 19, 7, { v: "3. FEE PAYABLE BY EACH GROUP (live)", s: section(fpal) });
  ["Group", "Pupils counted", "Sports (GH₵)", "Culture (GH₵)", "Region (GH₵)", "Total payable (GH₵)"].forEach((h, i) => fee.set(20, 2 + i, { v: h, s: head(fpal) }));
  fee.heights.set(20, 30);
  o.groups.forEach((_, i) => {
    const r = 21 + i;
    const alt = i % 2 === 1;
    fee.set(r, 2, { f: `Summary!B${10 + i}`, s: { ...txt(alt), b: true } });
    fee.set(r, 3, { f: `Summary!J${10 + i}`, s: numS(alt) });
    fee.set(r, 4, { f: `C${r}*$C$7`, s: moneyS(alt) });
    fee.set(r, 5, { f: `C${r}*$C$8`, s: moneyS(alt) });
    fee.set(r, 6, { f: `C${r}*$C$9`, s: moneyS(alt) });
    fee.set(r, 7, { f: `C${r}*$C$10`, s: { ...moneyS(alt), b: true } });
  });
  const FT = 21 + G;
  fee.set(FT, 2, { v: "ALL GROUPS", s: totT });
  ["C", "D", "E", "F", "G"].forEach((c, i) => fee.set(FT, 3 + i, { f: `SUM(${c}21:${c}${FT - 1})`, s: i === 0 ? totS : totM }));
  fee.heights.set(FT, 24);
  fee.bar(`G21:G${FT - 1}`, "2DBE8C");
  fee.merge(FT + 2, 2, FT + 2, 7, { v: "How the fee is worked out: pupils counted (Primary + JHS) x fee per pupil. Each circuit pays the district the total of its schools. A school that moves to another group is moved by cutting its row and pasting it into the spare rows of the other group's sheet.", s: { i: true, color: "#5B6B8C", wrap: true, v: "top" } });
  fee.heights.set(FT + 2, 46);

  downloadBook(o.filename, [sum, fee, ...sheets]);
}
