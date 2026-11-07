/**
 * Beautiful print-outs for the census. Opens a new window with a proper header,
 * clean tables and a footer, then starts the browser's print / Save as PDF.
 */
export interface PrintOptions {
  title: string;
  subtitle?: string;
  /** Short chips under the title, for example the filters in use. */
  chips?: string[];
  /** Headline numbers shown as a strip under the title. */
  kpis?: { label: string; value: string }[];
  bodyHtml: string;
  landscape?: boolean;
  /** Copy the app's own stylesheets (Bootstrap etc.) so copied app markup looks right. */
  useAppStyles?: boolean;
}

export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const BASE_CSS = `
:root{--navy:#0a1f44;--blue:#1c6feb;--gold:#f0a500;--ink:#16213b;--mute:#5b6b8c;--line:#d7e0f0;--zebra:#f5f8fe}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{background:#fff!important;color:var(--ink)!important}
body{font-family:"Segoe UI",Arial,Helvetica,sans-serif;font-size:14px;line-height:1.35;margin:0;padding:0}
.sheet{padding:0}
.hero{background:linear-gradient(120deg,#0a1f44 0%,#12357a 60%,#1c6feb 100%);color:#fff!important;border-radius:14px;padding:18px 22px;position:relative;overflow:hidden;margin-bottom:14px;display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
.hero:after{content:"";position:absolute;right:-60px;top:-80px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,rgba(240,165,0,.28),rgba(240,165,0,0) 70%);z-index:0}
.hero>*{position:relative;z-index:1}
.hero .l{flex:1;min-width:0}
.hero .brand{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#ffe08a!important;font-weight:700}
.hero h1{font-size:28px;line-height:1.2;margin:5px 0 4px;font-weight:800;color:#fff!important}
.hero .sub{font-size:14.5px;color:#fff!important;font-weight:500}
.hero .date{flex:0 0 auto;font-size:13px;font-weight:700;color:#0a1f44!important;background:#ffe08a;border-radius:999px;padding:5px 14px;white-space:nowrap}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
.chip{background:#eaf2fe;color:#0a1f44;border:1px solid #c9dcfb;border-radius:999px;padding:3px 12px;font-size:13px;font-weight:600}
.kpis{display:flex;gap:8px;margin-bottom:12px}
.kpi{flex:1;border:1px solid var(--line);border-left:5px solid var(--blue);border-radius:10px;padding:8px 12px;background:#fff}
.kpi:nth-child(2n){border-left-color:var(--gold)}
.kpi .l{font-size:12px;color:var(--mute);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.kpi .v{font-size:26px;font-weight:800;color:var(--navy)}
table{border-collapse:collapse;width:100%}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{background:var(--navy);color:#fff!important;font-weight:700;font-size:13px;padding:8px 8px;text-align:left;border:1px solid var(--navy);line-height:1.25}
td{padding:6px 8px;border:1px solid var(--line);font-size:14px}
tbody tr:nth-child(even) td{background:var(--zebra)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
tr.tot td{background:#fff3d1!important;border-top:2px solid var(--gold);font-weight:800;color:var(--navy)}
h3{color:var(--navy);font-size:17px;margin:14px 0 5px;border-bottom:2px solid var(--gold);padding-bottom:3px;display:inline-block}
.kv{display:grid;grid-template-columns:190px 1fr;gap:4px 12px;margin-bottom:6px;font-size:14px}
.kv b{color:var(--mute);font-weight:600}
.foot{margin-top:14px;border-top:1px solid var(--line);padding-top:7px;color:var(--mute);font-size:11.5px;display:flex;justify-content:space-between}
.no-print,button,input,select,datalist{display:none!important}
.actrs-card,.card{background:#fff!important;border:1px solid var(--line)!important;border-radius:10px!important;box-shadow:none!important;backdrop-filter:none!important;color:var(--ink)!important;break-inside:avoid;page-break-inside:avoid}
.cx-glass,.cx-pop{background:#fff!important;backdrop-filter:none!important;box-shadow:none!important;animation:none!important;color:var(--ink)!important}
.cx-num{background:none!important;-webkit-text-fill-color:var(--navy)!important;color:var(--navy)!important;text-shadow:none!important}
.text-muted{color:var(--mute)!important}
.small,small{font-size:13px!important}
.badge{font-size:12.5px!important;color:#0a1f44!important;background:#eaf2fe!important;border:1px solid #c9dcfb}
svg text{font-size:13px}
svg text{fill:#16213b!important}
`;

function appStyles(): string {
  const parts: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => parts.push(l.outerHTML));
  return parts.join("");
}

export function openPrint(o: PrintOptions): void {
  const w = window.open("", "_blank");
  if (!w) return;
  const today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const chips = (o.chips ?? []).filter(Boolean).map((c) => `<span class="chip">${escHtml(c)}</span>`).join("");
  const kpis = (o.kpis ?? []).map((k) => `<div class="kpi"><div class="l">${escHtml(k.label)}</div><div class="v">${escHtml(k.value)}</div></div>`).join("");
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escHtml(o.title)}</title>${o.useAppStyles ? appStyles() : ""}` +
      `<style>@page{size:${o.landscape ? "A4 landscape" : "A4 portrait"}}@page{margin:11mm 10mm 14mm;@bottom-left{content:"EduLink GH - District School Census";font-size:11px;color:#5b6b8c}@bottom-right{content:"Page " counter(page) " of " counter(pages);font-size:11px;color:#5b6b8c}}@media print{.noprint{display:none!important}}${BASE_CSS}${o.landscape ? "html,body{width:277mm}" : ""}@page{size:${o.landscape ? "A4 landscape" : "A4 portrait"}}</style></head>` +
      `<body><div class="noprint" style="background:#fff3cd;color:#5c4400;padding:8px 14px;font:600 13px Arial;border-bottom:2px solid #f0a500">To get a LANDSCAPE PDF: in the print window choose <b>Save as PDF</b> as the destination (not Microsoft Print to PDF), and set Layout to <b>Landscape</b>. Tip: the <b>Download PDF</b> button on the page always gives landscape.</div><div class="sheet"><div class="hero"><div class="l"><div class="brand">EduLink GH &middot; Wassa Amenfi Central District</div><h1>${escHtml(o.title)}</h1>` +
      `${o.subtitle ? `<div class="sub">${escHtml(o.subtitle)}</div>` : ""}</div><div class="date">Printed ${today}</div></div>` +
      `${chips ? `<div class="chips">${chips}</div>` : ""}${kpis ? `<div class="kpis">${kpis}</div>` : ""}${o.bodyHtml}` +
      `<div class="foot"><span>Source: Wassa Amenfi Central District schools survey (corrected data)</span><span>Generated with EduLink GH</span></div></div></body></html>`
  );
  w.document.close();
  w.focus();
  window.setTimeout(() => w.print(), o.useAppStyles ? 900 : 300);
}
