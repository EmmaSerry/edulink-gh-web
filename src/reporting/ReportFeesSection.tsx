import type { ReportSnapshotFeeSummary } from "./ReportSnapshot.types";

function money(n: number): string {
  return `GHS ${n.toFixed(2)}`;
}

/**
 * School fees breakdown on a private school's report card - see
 * ReportSnapshotFeeSummary. Renders nothing when the snapshot has no
 * feeSummary at all (a public school, or a private school with no fees
 * generated for this term yet), so every template can render this
 * unconditionally without its own private-school check.
 */
export function ReportFeesSection({ feeSummary }: { feeSummary?: ReportSnapshotFeeSummary }) {
  if (!feeSummary || feeSummary.items.length === 0) return null;

  return (
    <table className="actrs-report-table" style={{ marginTop: 10 }}>
      <thead>
        <tr>
          <th colSpan={4} style={{ textAlign: "left", background: "var(--report-secondary)" }}>
            School Fees
          </th>
        </tr>
        <tr>
          <th style={{ textAlign: "left" }}>Fee</th>
          <th>Due</th>
          <th>Paid</th>
          <th>Balance</th>
        </tr>
      </thead>
      <tbody>
        {feeSummary.items.map((item, i) => (
          <tr key={i}>
            <td className="subject-name">{item.name}</td>
            <td>{money(item.amountDue)}</td>
            <td>{money(item.amountPaid)}</td>
            <td>{money(item.balance)}</td>
          </tr>
        ))}
        <tr className="overall-row">
          <td className="subject-name">Total</td>
          <td>{money(feeSummary.totalDue)}</td>
          <td>{money(feeSummary.totalPaid)}</td>
          <td>{money(feeSummary.totalBalance)}</td>
        </tr>
      </tbody>
    </table>
  );
}
