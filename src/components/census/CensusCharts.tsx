import { useState } from "react";
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
  /** Extra lines shown when hovering (for example boys and girls). */
  detail?: string[];
}

interface TipState {
  x: number;
  y: number;
  title: string;
  lines: string[];
  color?: string;
}

/** Hover box that follows the mouse. */
function useTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: { clientX: number; clientY: number }, title: string, lines: string[], color?: string) =>
    setTip({ x: e.clientX, y: e.clientY, title, lines, color });
  const hide = () => setTip(null);
  const left = tip ? (tip.x + 270 > window.innerWidth ? tip.x - 260 : tip.x + 14) : 0;
  const node = tip ? (
    <div className="cx-tip" style={{ left, top: tip.y + 14 }}>
      <div className="cx-tip-t">
        {tip.color && <span style={{ background: tip.color }} />}
        {tip.title}
      </div>
      {tip.lines.map((l) => (
        <div key={l}>{l}</div>
      ))}
    </div>
  ) : null;
  return { show, hide, node };
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
  const tip = useTip();
  const sliceTip = (e: { clientX: number; clientY: number }, d: Slice) =>
    tip.show(e, d.label, [`Value: ${n(d.value)}`, ...(total > 0 ? [`Share: ${((d.value / total) * 100).toFixed(1)}%`] : []), ...(d.detail ?? [])], d.color);
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
                onMouseEnter={(e) => sliceTip(e, d)}
                onMouseMove={(e) => sliceTip(e, d)}
                onMouseLeave={tip.hide}
              />
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
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "default" }} onMouseMove={(e) => sliceTip(e, d)} onMouseLeave={tip.hide}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: d.color, display: "inline-block", boxShadow: `0 0 8px ${d.color}` }} />
            <span>
              {d.label}: <b><Count value={d.value} className="" /></b>
              {total > 0 && <span style={{ opacity: 0.9 }}> ({((d.value / total) * 100).toFixed(1)}%)</span>}
            </span>
          </div>
        ))}
      </div>
      {tip.node}
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  note?: string;
  /** Extra lines shown when hovering. */
  detail?: string[];
}

/** Horizontal bars, one value each. */
export function HBars({ items, color = COLORS.a, decimals = 0 }: { items: BarItem[]; color?: string; decimals?: number }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const on = useReveal(items.map((i) => i.value).join(","));
  const tip = useTip();
  const total = items.reduce((a, i) => a + i.value, 0);
  return (
    <div style={{ fontSize: 12.5 }}>
      {items.map((i, idx) => {
        const c = i.color ?? color;
        const move = (e: { clientX: number; clientY: number }) =>
          tip.show(e, i.label, [`Value: ${decimals ? i.value.toFixed(decimals) : n(i.value)}`, ...(!decimals && total > 0 ? [`Share of chart: ${((i.value / total) * 100).toFixed(1)}%`] : []), ...(i.detail ?? [])], c);
        return (
          <div key={i.label} className="cx-row" style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }} onMouseMove={move} onMouseLeave={tip.hide}>
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
      {tip.node}
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
  const tip = useTip();
  const pc = (x: number, t: number) => (t > 0 ? ` (${((x / t) * 100).toFixed(1)}%)` : "");
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
        <div
          key={i.label}
          className="cx-row"
          style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}
          onMouseMove={(e) => tip.show(e, i.label, [`${labels[0]}: ${n(i.a)}${pc(i.a, i.a + i.b)}`, `${labels[1]}: ${n(i.b)}${pc(i.b, i.a + i.b)}`, `Total: ${n(i.a + i.b)}`])}
          onMouseLeave={tip.hide}
        >
          <div style={{ width: 130, flex: "0 0 130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={i.label}>
            {i.label}
          </div>
          <div style={{ flex: 1, display: "flex", height: 16, background: TRACK, borderRadius: 6, overflow: "hidden" }}>
            <div className="cx-bar" style={{ ["--glow" as string]: colors[0], width: on ? `${(i.a / max) * 100}%` : "0%", background: `linear-gradient(90deg, ${colors[0]}, ${colors[0]}cc)`, transitionDelay: `${idx * 45}ms` }} />
            <div className="cx-bar" style={{ ["--glow" as string]: colors[1], width: on ? `${(i.b / max) * 100}%` : "0%", background: `linear-gradient(90deg, ${colors[1]}, ${colors[1]}cc)`, transitionDelay: `${idx * 45 + 120}ms` }} />
          </div>
          <div style={{ width: 64, flex: "0 0 64px", textAlign: "right", fontWeight: 600 }}>{n(i.a + i.b)}</div>
        </div>
      ))}
      {tip.node}
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
  const tip = useTip();
  const [hot, setHot] = useState<number | null>(null);
  return (
    <div style={{ position: "relative" }}>
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
              </rect>
              <rect className="cx-col" style={{ ["--glow" as string]: colors[1], transform: on ? "scaleY(1)" : "scaleY(0)", transitionDelay: `${idx * 60 + 90}ms` }} x={cx + 1} y={padT + plotH - hb} width={bw} height={hb} fill={colors[1]} rx="3">
              </rect>
              <text x={cx} y={height - 10} fontSize="10.5" textAnchor="middle" fill="currentColor">
                {it.label}
              </text>
              <rect
                x={cx - step / 2}
                y={0}
                width={step}
                height={height}
                fill={hot === idx ? "rgba(128,128,128,0.16)" : "transparent"}
                onMouseMove={(e) => {
                  setHot(idx);
                  const t = it.a + it.b;
                  tip.show(e, it.label, [`${labels[0]}: ${n(it.a)}${t ? ` (${((it.a / t) * 100).toFixed(1)}%)` : ""}`, `${labels[1]}: ${n(it.b)}${t ? ` (${((it.b / t) * 100).toFixed(1)}%)` : ""}`, `Total: ${n(t)}`]);
                }}
                onMouseLeave={() => { setHot(null); tip.hide(); }}
              />
            </g>
          );
        })}
      </svg>
      {tip.node}
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
