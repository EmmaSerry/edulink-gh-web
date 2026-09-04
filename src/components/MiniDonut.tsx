interface Props {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
}

/** Dependency-free donut chart using a CSS conic-gradient - used on the
 *  Dashboard for the Male/Female distribution (Module 13). */
export function MiniDonut({ segments, size = 120 }: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let cursor = 0;
  const stops = segments
    .map((s) => {
      const start = (cursor / total) * 360;
      cursor += s.value;
      const end = (cursor / total) * 360;
      return `${s.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="d-flex align-items-center gap-3">
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(${stops})`,
          flexShrink: 0,
        }}
      />
      <ul className="list-unstyled mb-0 small">
        {segments.map((s) => (
          <li key={s.label} className="d-flex align-items-center gap-2 mb-1">
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, display: "inline-block" }} />
            {s.label}: <strong>{s.value}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
