import type { ReactNode } from "react";
import type { Tone } from "@/mock/mockAnalysis";

export const TONE_COLOR: Record<Tone, { bg: string; fg: string; border: string; icon: string }> = {
  good: { bg: "#e8f6ee", fg: "#146c43", border: "#a3d9b9", icon: "▲" },
  ok: { bg: "#fff6dd", fg: "#8a6100", border: "#f1d98a", icon: "●" },
  bad: { bg: "#fdeaea", fg: "#a52a2a", border: "#f0b1b1", icon: "▼" },
  na: { bg: "#eef0f3", fg: "#5b6470", border: "#d3d8de", icon: "–" },
};

export function ToneBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const c = TONE_COLOR[tone];
  return (
    <span style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}`, borderRadius: 999, padding: "2px 10px", fontWeight: 600, fontSize: "0.8rem", whiteSpace: "nowrap" }}>
      {c.icon} {children}
    </span>
  );
}

/** A big plain-language card: a label, one headline number, a traffic-light word and one sentence. */
export function VerdictCard({ label, value, tone, word, sentence }: { label: string; value: string | number; tone: Tone; word: string; sentence: string }) {
  const c = TONE_COLOR[tone];
  return (
    <div className="col-12 col-md-6 col-xl-3">
      <div className="card h-100" style={{ borderColor: c.border, background: c.bg }}>
        <div className="card-body">
          <div className="small" style={{ color: c.fg, fontWeight: 600 }}>
            {label}
          </div>
          <div style={{ fontSize: "2rem", fontWeight: 700, lineHeight: 1.1, color: c.fg }}>{value}</div>
          <div className="mt-1">
            <ToneBadge tone={tone}>{word}</ToneBadge>
          </div>
          <div className="small mt-2" style={{ color: "#333" }}>
            {sentence}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Bar({ value, max, color = "#2f6fed" }: { value: number; max: number; color?: string }) {
  return (
    <div className="bg-light rounded flex-grow-1" style={{ height: 14 }}>
      <div style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, background: color, height: 14, borderRadius: 4 }} />
    </div>
  );
}

export function Sparkline({ values, width = 120, height = 34, lowerIsBetter = true }: { values: Array<number | null>; width?: number; height?: number; lowerIsBetter?: boolean }) {
  const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  if (pts.length < 2) return <span className="text-muted small">—</span>;
  const min = Math.min(...pts.map((p) => p.v));
  const max = Math.max(...pts.map((p) => p.v));
  const span = max - min || 1;
  const x = (i: number) => 4 + (i / Math.max(1, values.length - 1)) * (width - 8);
  // Higher on the chart always means better, whichever way the scale runs.
  const y = (v: number) => 4 + (lowerIsBetter ? (v - min) / span : (max - v) / span) * (height - 8);
  const path = pts.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const first = pts[0].v;
  const last = pts[pts.length - 1].v;
  const better = lowerIsBetter ? last < first : last > first;
  const color = last === first ? "#8a6100" : better ? "#146c43" : "#a52a2a";
  return (
    <svg width={width} height={height} role="img" aria-label="trend">
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {pts.map((p) => (
        <circle key={p.i} cx={x(p.i)} cy={y(p.v)} r={3} fill={color} />
      ))}
    </svg>
  );
}

export const DISCLAIMER = "Mock results are a school-level estimate from internal practice examinations. They are not official WAEC results or predictions.";
