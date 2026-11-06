import { Count, useReveal } from "./censusFx";

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
  const on = useReveal(data.map((d) => d.value).join(","));
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="cx-donut" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <svg width="140" height="140" viewBox="0 0 140 140" role="img">
        <circle cx="70" cy="70" r={R} fill="none" stroke={TRACK} strokeWidth="22" />
        {total > 0 &&
          data.map((d) => {
            const len = (d.value / total) * C;
            const el = (
              <circle
                key={d.label}
                className="cx-slice"
                style={{ ["--glow" as string]: d.color }}
                cx="70"
                cy="70"
                r={R}
                fill="none"
                stroke={d.color}
                strokeWidth="22"
                strokeDasharray={on ? `${Math.max(0, len - 1.5)} ${C - Math.max(0, len - 1.5)}` : `0 ${C}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 70 70)"
              >
                <title>{`${d.label}: ${n(d.value)}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x="70" y="68" textAnchor="middle" fontSize="17" fontWeight="700" fill="currentColor">
          {centerTop ?? n(total)}
        </text>
        <text x="70" y="85" textAnchor="middle" fontSize="10.5" fill="currentColor" opacity="0.95">
          {centerBottom ?? "total"}
        </text>
      </svg>
      <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, display: "inline-block", boxShadow: `0 0 8px ${d.color}` }} />
            <span>
              {d.label}: <b><Count value={d.value} className="" /></b>
              {total > 0 && <span style={{ opacity: 0.9 }}> ({((d.value / total) * 100).toFixed(1)}%)</span>}
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
  const on = useReveal(items.map((i) => i.value).join(","));
  return (
    <div style={{ fontSize: 12.5 }}>
      {items.map((i, idx) => {
        const c = i.color ?? color;
        return (
          <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
            <div style={{ width: 150, flex: "0 0 150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>
              {i.label}
            </div>
            <div style={{ flex: 1, background: TRACK, borderRadius: 6, height: 16 }}>
              <div
                className="cx-bar"
                style={{
                  ["--glow" as string]: c,
                  width: on ? `${(i.value / max) * 100}%` : "0%",
                  background: `linear-gradient(90deg, ${c}, ${c}cc)`,
                  height: 16,
                  borderRadius: 6,
                  transitionDelay: `${idx * 45}ms`,
                }}
              />
            </div>
            <div style={{ width: 64, flex: "0 0 64px", textAlign: "right", fontWeight: 600 }}>
              {decimals ? i.value.toFixed(decimals) : n(i.value)}
            </div>
          </div>
        );
      })}
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
  const on = useReveal(items.map((i) => `${i.a}/${i.b}`).join(","));
  return (
    <div style={{ fontSize: 12.5 }}>
      <div style={{ display: "flex", gap: 14, marginBottom: 4 }}>
        {labels.map((l, i) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[i], display: "inline-block", boxShadow: `0 0 8px ${colors[i]}` }} />
            {l}
          </span>
        ))}
      </div>
      {items.map((i, idx) => (
        <div key={i.label} style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
          <div style={{ width: 130, flex: "0 0 130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>
            {i.label}
          </div>
          <div style={{ flex: 1, display: "flex", height: 16, background: TRACK, borderRadius: 6, overflow: "hidden" }}>
            <div className="cx-bar" style={{ ["--glow" as string]: colors[0], width: on ? `${(i.a / max) * 100}%` : "0%", background: `linear-gradient(90deg, ${colors[0]}, ${colors[0]}cc)`, transitionDelay: `${idx * 45}ms` }} title={`${labels[0]}: ${n(i.a)}`} />
            <div className="cx-bar" style={{ ["--glow" as string]: colors[1], width: on ? `${(i.b / max) * 100}%` : "0%", background: `linear-gradient(90deg, ${colors[1]}, ${colors[1]}cc)`, transitionDelay: `${idx * 45 + 120}ms` }} title={`${labels[1]}: ${n(i.b)}`} />
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
  const on = useReveal(items.map((i) => `${i.a}/${i.b}`).join(","));
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
              <text x={padL - 5} y={y + 3} fontSize="10.5" textAnchor="end" fill="currentColor" opacity="0.95">
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
              <rect className="cx-col" style={{ ["--glow" as string]: colors[0], transform: on ? "scaleY(1)" : "scaleY(0)", transitionDelay: `${idx * 60}ms` }} x={cx - bw - 1} y={padT + plotH - ha} width={bw} height={ha} fill={colors[0]} rx="3">
                <title>{`${it.label} ${labels[0]}: ${n(it.a)}`}</title>
              </rect>
              <rect className="cx-col" style={{ ["--glow" as string]: colors[1], transform: on ? "scaleY(1)" : "scaleY(0)", transitionDelay: `${idx * 60 + 90}ms` }} x={cx + 1} y={padT + plotH - hb} width={bw} height={hb} fill={colors[1]} rx="3">
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

export function ChartCard({ title, children, note, i = 0 }: { title: string; children: React.ReactNode; note?: string; i?: number }) {
  return (
    <div className="actrs-card cx-glass cx-rise p-3 h-100" style={{ ["--i" as string]: i, breakInside: "avoid" }}>
      <div className="cx-title mb-2" style={{ fontSize: "0.95rem" }}>{title}</div>
      {children}
      {note && <div className="text-muted mt-2" style={{ fontSize: "0.82rem" }}>{note}</div>}
    </div>
  );
}
