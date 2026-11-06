/**
 * Small chart pieces for the census summary. Plain SVG/HTML with inline
 * styles only (no chart library), so they also print cleanly.
 */
export const COLORS = {
  boys: "#1C6FEB",
  girls: "#E64A9B",
  public: "#0A7D5A",
  private: "#F0A500",
  a: "#1C6FEB",
  b: "#7A5CFA",
  c: "#16A3B8",
  d: "#F0A500",
  e: "#E64A9B",
  grey: "#8A94A6",
};
const TRACK = "rgba(128,128,128,0.22)";

export interface Slice {
  label: string;
  value: number;
  color: string;
}

function n(v: number): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function Donut({ data, centerTop, centerBottom }: { data: Slice[]; centerTop?: string; centerBottom?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140" role="img">
        <circle cx="70" cy="70" r={R} fill="none" stroke={TRACK} strokeWidth="22" />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * C;
            const el = (
              <circle
                key={d.label}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="22"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              />
            );
            offset += len;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor">
          {centerTop ?? n(total)}
        </text>
        <text x="70" y="85" textAnchor="middle" fontSize="9.5" fill="currentColor" opacity="0.7">
          {centerBottom ?? "total"}
        </text>
      </svg>
      <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, display: "inline-block" }} />
            <span>
              {d.label}: <b>{n(d.value)}</b>
              {total > 0 && <span style={{ opacity: 0.7 }}> ({((d.value / total) * 100).toFixed(1)}%)</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  note?: string;
}

/** Horizontal bars, one value each. */
export function HBars({ items, color = COLORS.a, decimals = 0 }: { items: BarItem[]; color?: string; decimals?: number }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ fontSize: 12.5 }}>
      {items.map((i) => (
        <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
          <div style={{ width: 150, flex: "0 0 150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>
            {i.label}
          </div>
          <div style={{ flex: 1, background: TRACK, borderRadius: 4, height: 16 }}>
            <div style={{ width: `${(i.value / max) * 100}%`, background: i.color ?? color, height: 16, borderRadius: 4 }} />
          </div>
          <div style={{ width: 64, flex: "0 0 64px", textAlign: "right", fontWeight: 600 }}>
            {decimals ? i.value.toFixed(decimals) : n(i.value)}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface StackItem {
  label: string;
  a: number;
  b: number;
}

/** Horizontal stacked bars (for example boys and girls per circuit). */
export function StackedHBars({ items, labels, colors }: { items: StackItem[]; labels: [string, string]; colors: [string, string] }) {
  const max = Math.max(1, ...items.map((i) => i.a + i.b));
  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 4 }}>
        {labels.map((l, i) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[i], display: "inline-block" }} />
            {l}
          </span>
        ))}
      </div>
      {items.map((i) => (
        <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
          <div style={{ width: 130, flex: "0 0 130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>
            {i.label}
          </div>
          <div style={{ flex: 1, display: "flex", height: 16, background: TRACK, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ width: `${(i.a / max) * 100}%`, background: colors[0] }} title={`${labels[0]}: ${n(i.a)}`} />
            <div style={{ width: `${(i.b / max) * 100}%`, background: colors[1] }} title={`${labels[1]}: ${n(i.b)}`} />
          </div>
          <div style={{ width: 64, flex: "0 0 64px", textAlign: "right", fontWeight: 600 }}>{n(i.a + i.b)}</div>
        </div>
      ))}
    </div>
  );
}

export interface GroupItem {
  label: string;
  a: number;
  b: number;
}

/** Vertical grouped bars with two series (for example boys and girls per class). */
export function GroupedVBars({ items, labels, colors, height = 210 }: { items: GroupItem[]; labels: [string, string]; colors: [string, string]; height?: number }) {
  const W = 620;
  const padL = 40;
  const padB = 28;
  const padT = 14;
  const plotH = height - padB - padT;
  const max = Math.max(1, ...items.map((i) => Math.max(i.a, i.b)));
  const step = (W - padL - 8) / Math.max(1, items.length);
  const bw = Math.min(26, step / 2.6);
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  return (
    <div>
      <div style={{ display: "flex", gap: 14, fontSize: 12.5, marginBottom: 2 }}>
        {labels.map((l, i) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[i], display: "inline-block" }} />
            {l}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} style={{ width: "100%", height: "auto" }} role="img">
        {ticks.map((t) => {
          const y = padT + plotH - (t / max) * plotH;
          return (
            <g key={t}>
              <line x1={padL} x2={W - 4} y1={y} y2={y} stroke={TRACK} />
              <text x={padL - 5} y={y + 3} fontSize="9.5" textAnchor="end" fill="currentColor" opacity="0.7">
                {n(t)}
              </text>
            </g>
          );
        })}
        {items.map((it, idx) => {
          const cx = padL + step * idx + step / 2;
          const ha = (it.a / max) * plotH;
          const hb = (it.b / max) * plotH;
          return (
            <g key={it.label}>
              <rect x={cx - bw - 1} y={padT + plotH - ha} width={bw} height={ha} fill={colors[0]} rx="2">
                <title>{`${it.label} ${labels[0]}: ${n(it.a)}`}</title>
              </rect>
              <rect x={cx + 1} y={padT + plotH - hb} width={bw} height={hb} fill={colors[1]} rx="2">
                <title>{`${it.label} ${labels[1]}: ${n(it.b)}`}</title>
              </rect>
              <text x={cx} y={height - 10} fontSize="10" textAnchor="middle" fill="currentColor">
                {it.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="actrs-card p-3 h-100" style={{ breakInside: "avoid" }}>
      <div className="fw-semibold mb-2" style={{ fontSize: "0.95rem" }}>{title}</div>
      {children}
      {note && <div className="text-muted mt-2" style={{ fontSize: "0.72rem" }}>{note}</div>}
    </div>
  );
}
