/**
 * Small multi-sheet .xlsx builder (no library): styles with gradient fills,
 * formulas, merged cells, column widths, frozen panes, conditional formats
 * (data bars, status colours), links between sheets and one column chart.
 * Excel recalculates every formula when the file is opened.
 */
export interface St {
  b?: boolean;
  i?: boolean;
  sz?: number;
  color?: string;
  fill?: string;
  grad?: [string, string];
  deg?: number;
  h?: "left" | "center" | "right";
  v?: "top" | "center" | "bottom";
  wrap?: boolean;
  border?: string;
  fmt?: string;
  indent?: number;
  /** false = locked (default); true = the cell stays editable when the sheet is protected */
  unlocked?: boolean;
}
export interface Cell {
  v?: string | number | null;
  f?: string;
  s?: St;
}
export interface ChartSpec {
  title: string;
  cats: string;
  series: { name: string; ref: string; color: string }[];
  from: [number, number];
  to: [number, number];
  stacked?: boolean;
}

const enc = new TextEncoder();
const CRC: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name);
    const crc = crc32(f.data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true);
    lh.setUint16(12, 0x21, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, f.data.length, true);
    lh.setUint32(22, f.data.length, true);
    lh.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(lh.buffer), nm, f.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(14, 0x21, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, f.data.length, true);
    ch.setUint32(24, f.data.length, true);
    ch.setUint16(28, nm.length, true);
    ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nm);
    off += 30 + nm.length + f.data.length;
  }
  const cd = central.reduce((s, p) => s + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cd, true);
  end.setUint32(16, off, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of all) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] as string).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
export const colName = (i: number): string => {
  let s = "";
  for (let n = i; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
export const ref = (r: number, c: number) => `${colName(c)}${r}`;
const rgb = (h: string) => "FF" + h.replace("#", "").toUpperCase();

/** Collects distinct fonts/fills/borders/formats and hands out style numbers. */
class Styles {
  fonts: string[] = ['<font><sz val="11"/><name val="Calibri"/></font>'];
  fills: string[] = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  borders: string[] = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
  fmts: string[] = [];
  xfs: string[] = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
  cache = new Map<string, number>();
  idx(list: string[], x: string): number {
    const i = list.indexOf(x);
    if (i >= 0) return i;
    list.push(x);
    return list.length - 1;
  }
  get(s?: St): number {
    if (!s) return 0;
    const key = JSON.stringify(s);
    const hit = this.cache.get(key);
    if (hit !== undefined) return hit;
    const font = this.idx(this.fonts, `<font>${s.b ? "<b/>" : ""}${s.i ? "<i/>" : ""}<sz val="${s.sz ?? 11}"/><color rgb="${rgb(s.color ?? "#1b2a41")}"/><name val="Calibri"/></font>`);
    let fill = 0;
    if (s.grad) fill = this.idx(this.fills, `<fill><gradientFill degree="${s.deg ?? 0}"><stop position="0"><color rgb="${rgb(s.grad[0])}"/></stop><stop position="1"><color rgb="${rgb(s.grad[1])}"/></stop></gradientFill></fill>`);
    else if (s.fill) fill = this.idx(this.fills, `<fill><patternFill patternType="solid"><fgColor rgb="${rgb(s.fill)}"/><bgColor indexed="64"/></patternFill></fill>`);
    let border = 0;
    if (s.border) {
      const e = (t: string) => `<${t} style="thin"><color rgb="${rgb(s.border as string)}"/></${t}>`;
      border = this.idx(this.borders, `<border>${e("left")}${e("right")}${e("top")}${e("bottom")}<diagonal/></border>`);
    }
    let nf = 0;
    if (s.fmt) {
      const builtin: Record<string, number> = { "@": 49, "0": 1, "0.00": 2, "#,##0": 3, "#,##0.00": 4, "0%": 9, "0.00%": 10 };
      if (builtin[s.fmt] !== undefined) nf = builtin[s.fmt];
      else nf = 164 + this.idx(this.fmts, s.fmt);
    }
    const al = s.h || s.v || s.wrap || s.indent ? `<alignment${s.h ? ` horizontal="${s.h}"` : ""}${s.v ? ` vertical="${s.v}"` : ""}${s.wrap ? ' wrapText="1"' : ""}${s.indent ? ` indent="${s.indent}"` : ""}/>` : "";
    const prot = s.unlocked ? '<protection locked="0"/>' : "";
    const inner = al + prot;
    const xf = `<xf numFmtId="${nf}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1"${fill ? ' applyFill="1"' : ""}${border ? ' applyBorder="1"' : ""}${nf ? ' applyNumberFormat="1"' : ""}${al ? ' applyAlignment="1"' : ""}${prot ? ' applyProtection="1"' : ""}${inner ? ">" + inner + "</xf>" : "/>"}`;
    this.xfs.push(xf);
    const n = this.xfs.length - 1;
    this.cache.set(key, n);
    return n;
  }
  xml(): string {
    const nf = this.fmts.length ? `<numFmts count="${this.fmts.length}">${this.fmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join("")}</numFmts>` : "";
    const dxf = (fill: string, font: string) => `<dxf><font><b/><color rgb="${rgb(font)}"/></font><fill><patternFill patternType="solid"><fgColor rgb="${rgb(fill)}"/><bgColor rgb="${rgb(fill)}"/></patternFill></fill></dxf>`;
    return (
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${nf}` +
      `<fonts count="${this.fonts.length}">${this.fonts.join("")}</fonts><fills count="${this.fills.length}">${this.fills.join("")}</fills>` +
      `<borders count="${this.borders.length}">${this.borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
      `<dxfs count="5">${dxf("#198754", "#ffffff")}${dxf("#dc3545", "#ffffff")}${dxf("#6c757d", "#ffffff")}${dxf("#FDE8EA", "#7A0F1C")}${dxf("#E3F6EA", "#0A5C3F")}</dxfs></styleSheet>`
    );
  }
}

export class Sheet {
  rows = new Map<number, Map<number, Cell>>();
  widths: number[] = [];
  heights = new Map<number, number>();
  merges: string[] = [];
  cfs: string[] = [];
  links: { ref: string; location: string }[] = [];
  freeze: [number, number] | null = null;
  chart: ChartSpec | null = null;
  tab?: string;
  hidden = false;
  validations: string[] = [];
  /** sheet protection password (legacy hash); undefined = sheet not protected */
  protectPw?: string;
  constructor(public name: string) {}
  set(r: number, c: number, cell: Cell) {
    if (!this.rows.has(r)) this.rows.set(r, new Map());
    this.rows.get(r)!.set(c, cell);
  }
  /** Merge a block; every cell in it gets the same style so fills and borders cover it. */
  merge(r1: number, c1: number, r2: number, c2: number, cell: Cell) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? cell : { s: cell.s });
    if (r1 !== r2 || c1 !== c2) this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`);
  }
  bar(range: string, color: string) {
    this.cfs.push(`<conditionalFormatting sqref="${range}"><cfRule type="dataBar" priority="__P__"><dataBar><cfvo type="min"/><cfvo type="max"/><color rgb="${rgb(color)}"/></dataBar></cfRule></conditionalFormatting>`);
  }
  scale(range: string, lo: string, hi: string) {
    this.cfs.push(`<conditionalFormatting sqref="${range}"><cfRule type="colorScale" priority="__P__"><colorScale><cfvo type="min"/><cfvo type="max"/><color rgb="${rgb(lo)}"/><color rgb="${rgb(hi)}"/></colorScale></cfRule></conditionalFormatting>`);
  }
  status(range: string, rules: [string, 0 | 1 | 2][]) {
    this.cfs.push(`<conditionalFormatting sqref="${range}">${rules.map(([t, d]) => `<cfRule type="cellIs" dxfId="${d}" priority="__P__" operator="equal"><formula>"${t}"</formula></cfRule>`).join("")}</conditionalFormatting>`);
  }
}

/** Excel's classic sheet-protection password hash. */
export function pwHash(pw: string): string {
  let h = 0;
  for (let i = pw.length - 1; i >= 0; i--) {
    h = ((h >> 14) & 1) | ((h << 1) & 0x7fff);
    h ^= pw.charCodeAt(i);
  }
  h = ((h >> 14) & 1) | ((h << 1) & 0x7fff);
  h ^= pw.length;
  h ^= 0xce4b;
  return h.toString(16).toUpperCase().padStart(4, "0");
}

export function downloadBook(filename: string, sheets: Sheet[]): void {
  const st = new Styles();
  let prio = 1;
  const files: { name: string; x: string }[] = [];
  const hasChart = sheets.findIndex((s) => s.chart);

  sheets.forEach((sh, si) => {
    const rowsXml = Array.from(sh.rows.keys())
      .sort((a, b) => a - b)
      .map((r) => {
        const cells = sh.rows.get(r)!;
        const cx = Array.from(cells.keys())
          .sort((a, b) => a - b)
          .map((c) => {
            const cell = cells.get(c)!;
            const s = st.get(cell.s);
            const a = ref(r, c);
            if (cell.f) return `<c r="${a}" s="${s}"><f>${esc(cell.f)}</f></c>`;
            if (cell.v === null || cell.v === undefined || cell.v === "") return `<c r="${a}" s="${s}"/>`;
            if (typeof cell.v === "number" && Number.isFinite(cell.v)) return `<c r="${a}" s="${s}"><v>${cell.v}</v></c>`;
            return `<c r="${a}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(String(cell.v))}</t></is></c>`;
          })
          .join("");
        const h = sh.heights.get(r);
        return `<row r="${r}"${h ? ` ht="${h}" customHeight="1"` : ""}>${cx}</row>`;
      })
      .join("");
    const cols = sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const pane = sh.freeze ? `<pane ${sh.freeze[1] > 0 ? `xSplit="${sh.freeze[1]}" ` : ""}ySplit="${sh.freeze[0]}" topLeftCell="${ref(sh.freeze[0] + 1, sh.freeze[1] + 1)}" activePane="${sh.freeze[1] > 0 ? "bottomRight" : "bottomLeft"}" state="frozen"/>` : "";
    const cf = sh.cfs.map((x) => x.replace(/__P__/g, () => String(prio++))).join("");
    const links = sh.links.length ? `<hyperlinks>${sh.links.map((l) => `<hyperlink ref="${l.ref}" location="${esc(l.location)}" display="${esc(l.location)}"/>`).join("")}</hyperlinks>` : "";
    const merges = sh.merges.length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    files.push({
      name: `xl/worksheets/sheet${si + 1}.xml`,
      x:
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheetPr>${sh.tab ? `<tabColor rgb="${rgb(sh.tab)}"/>` : ""}<pageSetUpPr fitToPage="1"/></sheetPr>` +
        `<sheetViews><sheetView workbookViewId="0" showGridLines="0"${si === 0 ? ' tabSelected="1"' : ""}>${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>` +
        `<cols>${cols}</cols><sheetData>${rowsXml}</sheetData>${sh.protectPw !== undefined ? `<sheetProtection password="${pwHash(sh.protectPw)}" sheet="1" objects="1" scenarios="1" formatColumns="0" formatRows="0"/>` : ""}${merges}${cf}${sh.validations.length ? `<dataValidations count="${sh.validations.length}">${sh.validations.join("")}</dataValidations>` : ""}${links}` +
        `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
        `${sh.chart ? '<drawing r:id="rId1"/>' : ""}</worksheet>`,
    });
    if (sh.chart) {
      files.push({ name: `xl/worksheets/_rels/sheet${si + 1}.xml.rels`, x: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>` });
      const c = sh.chart;
      files.push({
        name: "xl/drawings/drawing1.xml",
        x: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:twoCellAnchor><xdr:from><xdr:col>${c.from[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.from[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${c.to[0]}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${c.to[1]}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="Chart 1"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor></xdr:wsDr>`,
      });
      files.push({ name: "xl/drawings/_rels/drawing1.xml.rels", x: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>` });
      const ser = c.series
        .map(
          (s, i) =>
            `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>${esc(s.name)}</c:f></c:strRef></c:tx><c:spPr><a:solidFill><a:srgbClr val="${s.color.replace("#", "")}"/></a:solidFill></c:spPr><c:invertIfNegative val="0"/><c:cat><c:strRef><c:f>${esc(c.cats)}</c:f></c:strRef></c:cat><c:val><c:numRef><c:f>${esc(s.ref)}</c:f></c:numRef></c:val></c:ser>`,
        )
        .join("");
      files.push({
        name: "xl/charts/chart1.xml",
        x:
          `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart>` +
          `<c:title><c:tx><c:rich><a:bodyPr/><a:p><a:pPr><a:defRPr sz="1400" b="1"/></a:pPr><a:r><a:rPr lang="en-GB" sz="1400" b="1"/><a:t>${esc(c.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` +
          `<c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="${c.stacked ? "stacked" : "clustered"}"/><c:varyColors val="0"/>${ser}<c:gapWidth val="60"/>${c.stacked ? '<c:overlap val="100"/>' : ""}<c:axId val="111"/><c:axId val="222"/></c:barChart>` +
          `<c:catAx><c:axId val="111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="222"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
          `<c:valAx><c:axId val="222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="111"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea>` +
          `<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart></c:chartSpace>`,
      });
    }
  });

  const ct =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
    (hasChart >= 0 ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/><Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>` : "") +
    `</Types>`;
  const wb =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>` +
    sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ""} r:id="rId${i + 1}"/>`).join("") +
    `</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
  const wbRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("") +
    `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const all = [
    { name: "[Content_Types].xml", x: ct },
    { name: "_rels/.rels", x: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", x: wb },
    { name: "xl/_rels/workbook.xml.rels", x: wbRels },
    { name: "xl/styles.xml", x: st.xml() },
    ...files,
  ].map((f) => ({ name: f.name, data: enc.encode(f.x) }));
  const blob = new Blob([zip(all) as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : filename + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
