/**
 * Builds a real PDF (A4, landscape or portrait) of a table, in the browser, with
 * no library. Because the page size is written into the file, it opens in
 * landscape whatever printer or print dialog the person uses.
 */
type Cell = string | number | null | undefined;

const REG = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const BOLD = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

function clean(s: string): string {
  return s
    .replace(/GH₵/g, "GHS")
    .replace(/₵/g, "GHS")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e -ÿ]/g, "?");
}
function wid(s: string, size: number, bold: boolean): number {
  const t = bold ? BOLD : REG;
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    w += c >= 32 && c <= 126 ? t[c - 32] : 556;
  }
  return (w * size) / 1000;
}
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function wrap(s: string, width: number, size: number, bold: boolean): string[] {
  const words = s.split(/\s+/);
  const out: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (wid(t, size, bold) <= width || !line) line = t;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [""];
}
const hex = (h: string) => [1, 3, 5].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(" ");

export interface PdfTable {
  filename: string;
  title: string;
  subtitle?: string;
  chips?: string[];
  headers: string[];
  rows: Cell[][];
  total?: Cell[] | null;
  /** columns from this index on are right-aligned numbers */
  numericFrom: number;
  landscape?: boolean;
  source?: string;
}

export function downloadTablePdf(o: PdfTable): void {
  const land = o.landscape !== false;
  const PW = land ? 841.89 : 595.28;
  const PH = land ? 595.28 : 841.89;
  const M = 28;
  const avail = PW - 2 * M;
  const fmtC = (c: Cell) => clean(c === null || c === undefined ? "" : typeof c === "number" ? c.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(c));
  const all: string[][] = [o.headers.map(clean), ...o.rows.map((r) => r.map(fmtC)), ...(o.total ? [o.total.map(fmtC)] : [])];
  const nc = o.headers.length;

  // font size and column widths
  let fs = 9.5;
  let widths: number[] = [];
  for (;;) {
    const pad = 8;
    const nat = Array.from({ length: nc }, (_, c) => Math.max(...all.map((r, ri) => wid(r[c] ?? "", fs, ri === 0 || (o.total && ri === all.length - 1) ? true : false))) + pad);
    const text = o.numericFrom;
    const head = Array.from({ length: nc }, (_, c) => Math.max(...(o.headers[c] ?? "").split(/\s+/).map((w) => wid(clean(w), fs, true))) + pad);
    const min = nat.map((w, c) => (c < text ? Math.min(w, 190) : Math.max(head[c], Math.min(w, 80))));
    const sum = nat.reduce((a, b) => a + b, 0);
    if (sum <= avail) {
      const extra = (avail - sum) / nc;
      widths = nat.map((w) => w + extra);
      break;
    }
    const minSum = min.reduce((a, b) => a + b, 0);
    if (minSum <= avail || fs <= 6.5) {
      // squeeze the text columns first
      const over = sum - avail;
      const flex = nat.map((w, c) => (c < text ? Math.max(0, w - min[c]) : 0));
      const flexSum = flex.reduce((a, b) => a + b, 0);
      widths = nat.map((w, c) => (flexSum > 0 ? w - (flex[c] / flexSum) * Math.min(over, flexSum) : w));
      const s2 = widths.reduce((a, b) => a + b, 0);
      if (s2 > avail) widths = widths.map((w) => (w * avail) / s2);
      break;
    }
    fs -= 0.5;
  }

  const pages: string[] = [];
  let cur: string[] = [];
  let y = 0;
  const lead = fs + 3.5;
  const text = (x: number, yy: number, s: string, size: number, bold: boolean, rgb = "0 0 0") =>
    cur.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb} rg ${x.toFixed(2)} ${yy.toFixed(2)} Td (${esc(s)}) Tj ET`);
  const rect = (x: number, yy: number, w: number, h: number, hx: string) => cur.push(`${hex(hx)} rg ${x.toFixed(2)} ${yy.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  const line = (x1: number, y1: number, x2: number, y2: number) => cur.push(`0.72 0.76 0.84 RG 0.5 w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);

  function header(first: boolean) {
    y = PH - M;
    if (first) {
      rect(M, y - 52, avail, 52, "#0a1f44");
      rect(M, y - 52, 6, 52, "#f0a500");
      text(M + 16, y - 16, "EDULINK GH - WASSA AMENFI CENTRAL DISTRICT", 8, true, "1 0.88 0.54");
      text(M + 16, y - 35, clean(o.title), 17, true, "1 1 1");
      if (o.subtitle) text(M + 16, y - 47, clean(o.subtitle).slice(0, land ? 190 : 120), 7.5, false, "1 1 1");
      const d = "Printed " + new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
      const dw = wid(clean(d), 8.5, true) + 20;
      rect(PW - M - dw - 10, y - 30, dw, 18, "#ffe08a");
      text(PW - M - dw, y - 24, clean(d), 8.5, true, "0.04 0.12 0.27");
      y -= 62;
      if (o.chips && o.chips.length) {
        let x = M;
        for (const c of o.chips.filter(Boolean)) {
          const cs = clean(c);
          const w = wid(cs, 8, true) + 16;
          if (x + w > PW - M) {
            x = M;
            y -= 20;
          }
          rect(x, y - 14, w, 16, "#eaf2fe");
          text(x + 8, y - 9, cs, 8, true, "0.04 0.12 0.27");
          x += w + 6;
        }
        y -= 24;
      }
    }
  }
  function tableHead() {
    const h = lead + 6;
    rect(M, y - h, avail, h, "#0a1f44");
    let x = M;
    o.headers.forEach((hd, c) => {
      const ls = wrap(clean(hd), widths[c] - 8, fs, true);
      const hh = ls.length * lead;
      ls.forEach((l, i) => {
        const tx = c >= o.numericFrom ? x + widths[c] - 4 - wid(l, fs, true) : x + 4;
        text(tx, y - 4 - (h - hh) / 2 - fs - i * lead + 1, l, fs, true, "1 1 1");
      });
      x += widths[c];
    });
    y -= h;
  }

  header(true);
  tableHead();
  all.slice(1).forEach((r, ri, arr) => {
    const isTot = !!o.total && ri === arr.length - 1;
    const cellLines = r.map((v, c) => (c < o.numericFrom ? wrap(v, widths[c] - 8, fs, isTot) : [v]));
    const rh = Math.max(...cellLines.map((l) => l.length)) * lead + 4;
    if (y - rh < M + 22) {
      pages.push(cur.join("\n"));
      cur = [];
      header(false);
      tableHead();
    }
    if (isTot) rect(M, y - rh, avail, rh, "#eef3fb");
    else if (ri % 2 === 1) rect(M, y - rh, avail, rh, "#f6f8fc");
    let x = M;
    r.forEach((_, c) => {
      cellLines[c].forEach((l, i) => {
        const tx = c >= o.numericFrom ? x + widths[c] - 4 - wid(l, fs, isTot) : x + 4;
        text(tx, y - 2 - fs - i * lead + 0.5, l, fs, isTot);
      });
      x += widths[c];
    });
    line(M, y - rh, M + avail, y - rh);
    y -= rh;
  });
  pages.push(cur.join("\n"));

  // footers and file assembly
  const n = pages.length;
  const src = clean(o.source ?? "Source: Wassa Amenfi Central District schools survey. Generated with EduLink GH");
  const streams = pages.map((p, i) => {
    const f = [`BT /F1 7.5 Tf 0.36 0.42 0.55 rg ${M} 16 Td (${esc(src)}) Tj ET`, `BT /F1 7.5 Tf 0.36 0.42 0.55 rg ${(PW - M - 60).toFixed(2)} 16 Td (Page ${i + 1} of ${n}) Tj ET`];
    return p + "\n" + f.join("\n");
  });

  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  const kids = streams.map((_, i) => `${5 + i * 2} 0 R`).join(" ");
  objs[2] = `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`;
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  streams.forEach((s, i) => {
    objs[5 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Rotate 0 /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`;
    objs[6 + i * 2] = `<< /Length ${s.length} >>\nstream\n${s}\nendstream`;
  });
  let out = "%PDF-1.4\n";
  const off: number[] = [];
  for (let i = 1; i < objs.length; i++) {
    off[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xr = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i++) out += String(off[i]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = o.filename.endsWith(".pdf") ? o.filename : o.filename + ".pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
