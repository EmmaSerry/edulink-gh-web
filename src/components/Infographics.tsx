import { useEffect, useRef, useState, type ReactNode } from "react";
import "@/styles/infographics.css";

/** Counts up to `value` with an easing curve (skipped for reduced motion). */
export function CountUp({ value, duration = 1100 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(origin + (value - origin) * eased);
      setShown(current);
      from.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{shown.toLocaleString()}</>;
}

/** True one frame after mount / whenever `key` changes, so CSS transitions play. */
function useGrow(key: unknown): boolean {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    setGrown(false);
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, [key]);
  return grown;
}

export function GlowCard({ title, children, delay = 0 }: { title: string; children: ReactNode; delay?: number }) {
  return (
    <div className="ig-card ig-rise" style={{ animationDelay: `${delay}ms` }}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

/** Glowing male / female ring with the total in the middle. */
export function GlowDonut({ male, female }: { male: number; female: number }) {
  const grown = useGrow(`${male}-${female}`);
  const total = male + female;
  const r = 78;
  const c = 2 * Math.PI * r;
  const mLen = total ? (male / total) * c : 0;
  const fLen = total ? (female / total) * c : 0;
  const gap = total && male && female ? 6 : 0;

  return (
    <div className="d-flex align-items-center gap-4 flex-wrap">
      <svg className="ig-donut" viewBox="0 0 200 200" role="img" aria-label={`${male} male, ${female} female`}>
        <defs>
          <filter id="ig-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle className="ig-track" cx="100" cy="100" r={r} />
        <g transform="rotate(-90 100 100)" filter="url(#ig-glow)">
          <circle
            className="ig-arc"
            cx="100"
            cy="100"
            r={r}
            stroke="#3aa0ff"
            strokeDasharray={`${grown ? Math.max(0, mLen - gap) : 0} ${c}`}
          />
          <circle
            className="ig-arc"
            cx="100"
            cy="100"
            r={r}
            stroke="#ff4fa3"
            strokeDasharray={`${grown ? Math.max(0, fLen - gap) : 0} ${c}`}
            strokeDashoffset={-mLen}
          />
        </g>
        <text x="100" y="104" textAnchor="middle" fill="#fff" fontSize="34" fontWeight="800" filter="url(#ig-glow)">
          {total.toLocaleString()}
        </text>
        <text x="100" y="126" textAnchor="middle" fill="#8fa9cf" fontSize="12">
          learners
        </text>
      </svg>
      <div className="ig-legend">
        <div>
          <span className="ig-dot m" />
          Male <strong className="ms-1">{male.toLocaleString()}</strong>
          {total > 0 && <span className="ig-muted ms-2">{Math.round((male / total) * 100)}%</span>}
        </div>
        <div>
          <span className="ig-dot f" />
          Female <strong className="ms-1">{female.toLocaleString()}</strong>
          {total > 0 && <span className="ig-muted ms-2">{Math.round((female / total) * 100)}%</span>}
        </div>
      </div>
    </div>
  );
}

interface BarItem {
  label: string;
  male: number;
  female: number;
  total: number;
}

/** Horizontal stacked bars (blue = male, pink = female). */
export function GlowBars({ items }: { items: BarItem[] }) {
  const grown = useGrow(items.map((i) => `${i.label}:${i.total}`).join("|"));
  const max = Math.max(1, ...items.map((i) => i.total));
  if (items.length === 0) return <div className="ig-empty">No learners match these filters.</div>;
  return (
    <div className="ig-bars">
      {items.map((it) => {
        const width = grown ? (it.total / max) * 100 : 0;
        return (
          <div className="ig-bar-row" key={it.label} title={`${it.male} male, ${it.female} female`}>
            <div className="ig-bar-label">{it.label}</div>
            <div className="ig-bar-track">
              <div className="ig-bar-fill" style={{ width: `${width}%` }}>
                <div className="m" style={{ flexGrow: it.male }} />
                <div className="f" style={{ flexGrow: it.female }} />
              </div>
            </div>
            <div className="ig-bar-value">{it.total.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Vertical twin columns per age. */
export function GlowColumns({ items }: { items: { age: number; male: number; female: number; total: number }[] }) {
  const grown = useGrow(items.map((i) => `${i.age}:${i.total}`).join("|"));
  const max = Math.max(1, ...items.flatMap((i) => [i.male, i.female]));
  if (items.length === 0) return <div className="ig-empty">No learners match these filters.</div>;
  return (
    <div className="ig-cols">
      {items.map((it) => (
        <div className="ig-col" key={it.age} title={`${it.male} male, ${it.female} female`}>
          <div className="ig-col-count">{it.total}</div>
          <div className="ig-col-bars">
            <div className="ig-col-bar m" style={{ height: grown ? `${(it.male / max) * 100}%` : 0 }} />
            <div className="ig-col-bar f" style={{ height: grown ? `${(it.female / max) * 100}%` : 0 }} />
          </div>
          <div className="ig-col-label">{it.age} yrs</div>
        </div>
      ))}
    </div>
  );
}
