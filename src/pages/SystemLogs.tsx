import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Breadcrumb } from "@components/Breadcrumb";
import { Card } from "@components/Card";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";
import { SystemLogService, type UnifiedLogFilter } from "@services/SystemLogService";

const MODULE_OPTIONS = [
  { value: "", label: "All modules" },
  { value: "STUDENT", label: "Student" },
  { value: "ASSESSMENT", label: "Assessment" },
  { value: "REPORT", label: "Report" },
  { value: "ARCHIVE", label: "Archive" },
  { value: "BACKUP", label: "Backup" },
  { value: "RESTORE", label: "Restore" },
  { value: "IMPORT", label: "Import" },
  { value: "EXPORT", label: "Export" },
  { value: "CONFIGURATION", label: "Configuration" },
  { value: "SYSTEM", label: "System" },
];

/**
 * Module 6 (Phase 5) - System Logs & Audit. Presents the unified feed
 * SystemLogService.getUnifiedFeed() builds from every append-only log
 * table ACTRS keeps (systemLogs, auditLogs, printLogs, exportLogs),
 * filterable by date, module, action and performer.
 */
export function SystemLogs() {
  const [filter, setFilter] = useState<UnifiedLogFilter>({});
  const [actionText, setActionText] = useState("");
  const [performedByText, setPerformedByText] = useState("");

  const effectiveFilter: UnifiedLogFilter = {
    ...filter,
    action: actionText.trim() || undefined,
    performedBy: performedByText.trim() || undefined,
  };

  const rows = useLiveQuery(
    () => SystemLogService.getUnifiedFeed(effectiveFilter),
    [filter.module, filter.fromDate, filter.toDate, actionText, performedByText],
  );

  return (
    <>
      <Breadcrumb items={[{ label: "System Logs" }]} />
      <PageHeader
        title="System Logs & Audit"
        description="Complete activity trail across every module - assessments, reports, backups, restores, imports, exports and archiving"
      />

      <Card className="mb-4">
        <div className="row g-3">
          <div className="col-md-3">
            <label className="form-label small">Module</label>
            <select
              className="form-select form-select-sm"
              value={filter.module ?? ""}
              onChange={(e) => setFilter((f) => ({ ...f, module: e.target.value || undefined }))}
            >
              {MODULE_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="col-md-3">
            <label className="form-label small">Action contains</label>
            <input className="form-control form-control-sm" value={actionText} onChange={(e) => setActionText(e.target.value)} placeholder="e.g. finalized, backup" />
          </div>
          <div className="col-md-2">
            <label className="form-label small">Performed by</label>
            <input className="form-control form-control-sm" value={performedByText} onChange={(e) => setPerformedByText(e.target.value)} />
          </div>
          <div className="col-md-2">
            <label className="form-label small">From date</label>
            <input type="date" className="form-control form-control-sm" onChange={(e) => setFilter((f) => ({ ...f, fromDate: e.target.value || undefined }))} />
          </div>
          <div className="col-md-2">
            <label className="form-label small">To date</label>
            <input type="date" className="form-control form-control-sm" onChange={(e) => setFilter((f) => ({ ...f, toDate: e.target.value ? `${e.target.value}T23:59:59` : undefined }))} />
          </div>
        </div>
      </Card>

      <Card>
        {!rows ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState icon="bi-journal-text" title="No matching activity" message="Try widening your filters, or check back once more actions have been recorded." />
        ) : (
          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Date/Time</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Performed By</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="small text-nowrap">{new Date(r.performedAt).toLocaleString()}</td>
                    <td><span className="badge text-bg-light border text-capitalize">{r.module.toLowerCase()}</span></td>
                    <td className="small">{r.action}</td>
                    <td className="small">{r.performedBy}</td>
                    <td className="small text-muted">{r.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-muted small mb-0">{rows.length} entr{rows.length === 1 ? "y" : "ies"}</p>
          </div>
        )}
      </Card>
    </>
  );
}
