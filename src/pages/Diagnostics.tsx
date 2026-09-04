import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Breadcrumb } from "@components/Breadcrumb";
import { Card } from "@components/Card";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { DiagnosticsService, type DiagnosticsReport } from "@services/DiagnosticsService";
import { getRecentPerformanceMetrics } from "@services/PerformanceMetricService";

function formatBytes(bytes?: number): string {
  if (bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

/** Module 7 (Phase 5) - Application Diagnostics. */
export function Diagnostics() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const history = useLiveQuery(() => DiagnosticsService.getSnapshotHistory(), [report]);
  const perfSamples = useLiveQuery(() => getRecentPerformanceMetrics(undefined, 15), [report]);

  async function load() {
    setLoading(true);
    try {
      setReport(await DiagnosticsService.runDiagnostics());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!report) return;
    await DiagnosticsService.saveSnapshot(report);
    showToast("Diagnostics snapshot saved.", "success");
  }

  async function handleClearCache() {
    const ok = await confirm({
      title: "Clear cache and reload?",
      message: "This clears the offline app cache and re-installs a fresh copy on reload. Your student, assessment and report data is stored separately and will NOT be affected.",
      confirmLabel: "Clear & reload",
      variant: "danger",
    });
    if (ok) await DiagnosticsService.clearCachesAndReload();
  }

  const storagePct =
    report?.storageUsageBytes && report?.storageQuotaBytes ? Math.round((report.storageUsageBytes / report.storageQuotaBytes) * 100) : undefined;

  return (
    <>
      <Breadcrumb items={[{ label: "Diagnostics" }]} />
      <PageHeader
        title="Diagnostics"
        description="Database, storage, cache and offline health checks"
        actions={
          <>
            <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={loading}>
              <i className="bi bi-arrow-clockwise me-1" /> {loading ? "Checking…" : "Run diagnostics"}
            </button>
            <button className="btn btn-sm btn-outline-primary" onClick={handleSave} disabled={!report}>
              Save snapshot
            </button>
            <button className="btn btn-sm btn-outline-danger" onClick={handleClearCache}>
              Clear cache & reload
            </button>
          </>
        }
      />

      {loading || !report ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="row g-4 mb-4">
            <div className="col-md-3">
              <Card>
                <div className="text-muted small">Application Version</div>
                <div className="fs-5 fw-bold">{report.appVersion}</div>
                <div className="small text-muted">{report.appPhase}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card>
                <div className="text-muted small">Database</div>
                <div className="fs-5 fw-bold">{report.dbName} v{report.dbVersion}</div>
                <div className="small text-muted">{report.indexedDbSupported ? "IndexedDB OK" : "IndexedDB unsupported"}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card>
                <div className="text-muted small">Service Worker</div>
                <div className="fs-6 fw-bold">{report.serviceWorkerStatus}</div>
              </Card>
            </div>
            <div className="col-md-3">
              <Card>
                <div className="text-muted small">Connection</div>
                <div className="fs-5 fw-bold">
                  <span className={`badge ${report.online ? "text-bg-success" : "text-bg-secondary"}`}>
                    {report.online ? "Online" : "Offline"}
                  </span>
                </div>
                <div className="small text-muted">Works fully offline either way</div>
              </Card>
            </div>
          </div>

          <div className="row g-4 mb-4">
            <div className="col-md-6">
              <Card>
                <h2 className="h6 mb-3">Storage usage</h2>
                {storagePct !== undefined ? (
                  <>
                    <div className="progress mb-2" style={{ height: 10 }}>
                      <div className="progress-bar" style={{ width: `${storagePct}%` }} />
                    </div>
                    <div className="small text-muted">
                      {formatBytes(report.storageUsageBytes)} of {formatBytes(report.storageQuotaBytes)} used ({storagePct}%)
                      {report.storagePersisted !== undefined && (report.storagePersisted ? " · Persisted storage granted" : " · Persisted storage not granted")}
                    </div>
                  </>
                ) : (
                  <p className="text-muted small mb-0">Storage estimate not available in this browser.</p>
                )}
              </Card>
            </div>
            <div className="col-md-6">
              <Card>
                <h2 className="h6 mb-3">Cache & records</h2>
                <div className="row g-2 small">
                  <div className="col-6"><strong>{report.cacheNames.length}</strong> cache{report.cacheNames.length === 1 ? "" : "s"} installed</div>
                  <div className="col-6"><strong>{report.totalStudents}</strong> students</div>
                  <div className="col-6"><strong>{report.totalRecords}</strong> total records</div>
                  <div className="col-6">
                    Last backup: {report.lastBackupAt ? new Date(report.lastBackupAt).toLocaleDateString() : "Never"}
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {report.troubleshooting.length > 0 && (
            <Card className="mb-4">
              <h2 className="h6 mb-3">Troubleshooting guidance</h2>
              <ul className="mb-0 small">
                {report.troubleshooting.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </Card>
          )}

          <Card className="mb-4">
            <h2 className="h6 mb-3">Browser</h2>
            <p className="small text-muted mb-0" style={{ wordBreak: "break-all" }}>{report.browser}</p>
            <p className="small text-muted mb-0">Screen: {report.screenSize}</p>
          </Card>

          {perfSamples && perfSamples.length > 0 && (
            <Card className="mb-4">
              <h2 className="h6 mb-3">Recent performance samples</h2>
              <p className="text-muted small">
                Best-effort local timings captured during real use (Module 8) - search, batch report generation
                and PDF export. Never sent anywhere; purely for spotting a slowdown on a particular device.
              </p>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead><tr><th>When</th><th>Metric</th><th>Duration</th><th>Context</th></tr></thead>
                  <tbody>
                    {perfSamples.map((p) => (
                      <tr key={p.id}>
                        <td className="small">{new Date(p.recordedAt).toLocaleString()}</td>
                        <td className="small">{p.metric.replace(/_/g, " ")}</td>
                        <td>{p.durationMs} ms</td>
                        <td className="small text-muted">{p.context ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {history && history.length > 0 && (
            <Card>
              <h2 className="h6 mb-3">Snapshot history</h2>
              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead><tr><th>Date</th><th>DB v</th><th>Storage</th><th>Students</th><th>Total Records</th></tr></thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="small">{new Date(h.recordedAt).toLocaleString()}</td>
                        <td>{h.dbVersion}</td>
                        <td className="small">{formatBytes(h.storageUsageBytes)}</td>
                        <td>{h.totalStudents}</td>
                        <td>{h.totalRecords}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </>
  );
}
