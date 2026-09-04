import type { ProficiencyRating } from "@models/AssessmentRecord";

const LEGEND: Array<{ code: ProficiencyRating; label: string; color: string }> = [
  { code: "G", label: "Gold - Exceeds Expectation", color: "#d4af37" },
  { code: "S", label: "Silver - Meets Expectation", color: "#9aa0a6" },
  { code: "B", label: "Bronze - Approaching Expectation", color: "#a05a2c" },
  { code: "X", label: "Not Assessed", color: "#dcdcdc" },
  { code: "O", label: "Absent", color: "#444444" },
];

/** The official NaCCA rating legend (Module 6) - reproduced verbatim on
 *  every KG report so a parent can interpret Gold/Silver/Bronze/X/O
 *  without needing a separate key. Strictly a legend - it never appears
 *  next to a number, score, or ranking anywhere on the KG template. */
export function KgLegend() {
  return (
    <div className="actrs-report-legend">
      <strong className="me-1">Legend:</strong>
      {LEGEND.map((item) => (
        <span key={item.code} className="legend-item">
          <span className="legend-swatch" style={{ background: item.color }} />
          {item.code} = {item.label}
        </span>
      ))}
    </div>
  );
}
