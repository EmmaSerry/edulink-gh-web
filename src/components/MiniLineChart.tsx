interface LinePoint {
  label: string;
  value: number;
}

/** Dependency-free SVG line chart - used on the Dashboard for the
 *  academic performance trend across terms (Module 4, Phase 5). Kept in
 *  the same no-charting-library style as MiniBarChart/MiniDonut so the
 *  Phase 0 tech stack never needed a charting package added to it. */
export function MiniLineChart({ data, color = "var(--actrs-blue)", height = 140 }: { data: LinePoint[]; color?: string; height?: number }) {
  if (data.length === 0) {
    return <p className="text-muted small mb-0">No data yet.</p>;
  }
  if (data.length === 1) {
    return (
      <div className="text-center py-3">
        <div className="fs-4 fw-bold" style={{ color }}>{data[0].value}</div>
        <div className="small text-muted">{data[0].label}</div>
      </div>
    );
  }

  const width = 100; // percentage-based viewBox, scales to container
  const max = Math.max(1, ...data.map((d) => d.value));
  const min = Math.min(0, ...data.map((d) => d.value));
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = height - ((d.value - min) / range) * (height - 24) - 12;
    return { x, y, ...d };
  });

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none">
        <path d={path} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.6} fill={color} />
        ))}
      </svg>
      <div className="d-flex justify-content-between small text-muted mt-1">
        {data.map((d) => (
          <span key={d.label} title={`${d.label}: ${d.value}`}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}
