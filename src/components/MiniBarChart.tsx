interface BarDatum {
  label: string;
  value: number;
}

/** Dependency-free horizontal bar chart (plain divs) - used on the
 *  Dashboard for "Students by Level/Class" so no charting library needs
 *  to be added to the Phase 0 tech stack just for a few summary bars. */
export function MiniBarChart({ data, color = "var(--actrs-blue)" }: { data: BarDatum[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-muted small mb-0">No data yet.</p>;
  }
  return (
    <div>
      {data.map((d) => (
        <div key={d.label} className="mb-2">
          <div className="d-flex justify-content-between small mb-1">
            <span>{d.label}</span>
            <span className="text-muted">{d.value}</span>
          </div>
          <div className="rounded-pill" style={{ background: "var(--actrs-grey-border)", height: 8 }}>
            <div
              className="rounded-pill"
              style={{ width: `${(d.value / max) * 100}%`, background: color, height: 8 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
