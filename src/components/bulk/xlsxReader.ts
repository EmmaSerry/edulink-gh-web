/**
 * Reads the cell values of an .xlsx file in the browser (no library).
 * Uses the browser's own DecompressionStream for the zip contents.
 */
export type Val = string | number | null;
export interface ReadSheet {
  name: string;
  rows: Val[][]; // rows[0] is spreadsheet row 1
}

const td = new TextDecoder("utf-8");

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as unknown as { DecompressionStream?: new (f: string) => unknown }).DecompressionStream;
  if (!DS) throw new Error("This browser cannot open Excel files. Please use an up-to-date Chrome, Edge or Firefox.");
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DS("deflate-raw") as never);
  return new Uint8Array(await new Response(stream as never).arrayBuffer());
}

async function unzip(buf: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const u = new Uint8Array(buf);
  const dv = new DataView(buf);
  let e = u.length - 22;
  while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error("This does not look like an Excel (.xlsx) file.");
  const count = dv.getUint16(e + 10, true);
  let p = dv.getUint32(e + 16, true);
  const out = new Map<string, Uint8Array>();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = td.decode(u.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(off + 26, true);
    const lelen = dv.getUint16(off + 28, true);
    const start = off + 30 + lnlen + lelen;
    const raw = u.subarray(start, start + csize);
    if (/\.(xml|rels)$/i.test(name)) out.set(name, method === 0 ? raw : await inflateRaw(raw));
    p += 46 + nlen + elen + clen;
  }
  return out;
}

const dec = (s: string) =>
  s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

function textOf(xml: string): string {
  const parts = Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map((m) => m[1]);
  return dec(parts.join(""));
}

function colIndex(ref: string): number {
  const m = /^([A-Z]+)/.exec(ref);
  if (!m) return 0;
  let n = 0;
  for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export async function readXlsx(buf: ArrayBuffer): Promise<ReadSheet[]> {
  const files = await unzip(buf);
  const get = (n: string) => {
    const f = files.get(n);
    return f ? td.decode(f) : "";
  };
  const wb = get("xl/workbook.xml");
  const rels = get("xl/_rels/workbook.xml.rels");
  const relMap = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
    if (id && t) relMap.set(id, t);
  }
  const shared: string[] = [];
  const ss = get("xl/sharedStrings.xml");
  for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) shared.push(m[1] ? textOf(m[1]) : "");

  const sheets: ReadSheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = dec(/\bname="([^"]*)"/.exec(m[0])?.[1] ?? "");
    const rid = /\br:id="([^"]+)"/.exec(m[0])?.[1] ?? "";
    let target = relMap.get(rid) ?? "";
    target = target.replace(/^\//, "");
    const path = target.startsWith("xl/") ? target : "xl/" + target;
    const xml = get(path);
    const rows: Val[][] = [];
    for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
      const rn = parseInt(/\br="(\d+)"/.exec(rm[1])?.[1] ?? "0", 10);
      if (!rn) continue;
      const cells: Val[] = [];
      for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1];
        const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? "";
        const t = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? "n";
        const inner = cm[2] ?? "";
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];
        let val: Val = null;
        if (t === "inlineStr") val = textOf(inner);
        else if (v !== undefined) {
          if (t === "s") val = shared[parseInt(v, 10)] ?? "";
          else if (t === "str" || t === "e") val = dec(v);
          else if (t === "b") val = v === "1" ? "TRUE" : "FALSE";
          else {
            const num = Number(v);
            val = Number.isFinite(num) ? num : dec(v);
          }
        }
        cells[colIndex(ref)] = val;
      }
      while (rows.length < rn - 1) rows.push([]);
      rows[rn - 1] = cells;
    }
    sheets.push({ name, rows });
  }
  return sheets;
}
