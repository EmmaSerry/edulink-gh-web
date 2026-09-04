import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Breadcrumb } from "@components/Breadcrumb";
import { Card } from "@components/Card";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import {
  BackupService,
  BACKUP_MODULES,
  ALL_MODULE_KEYS,
  type RestorePreview,
} from "@services/BackupService";
import type { BackupFormat } from "@models/BackupHistory";

type Tab = "backup" | "restore" | "history";

export function BackupRestore() {
  const [tab, setTab] = useState<Tab>("backup");
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { name: currentUser } = useCurrentUser();

  const [selectedModules, setSelectedModules] = useState<string[]>(ALL_MODULE_KEYS);
  const [format, setFormat] = useState<BackupFormat>("json");
  const [exporting, setExporting] = useState(false);

  const history = useLiveQuery(() => BackupService.getHistory(), [tab]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RestorePreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedRestoreTables, setSelectedRestoreTables] = useState<string[]>([]);

  function toggleModule(key: string) {
    setSelectedModules((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function handleExport() {
    if (selectedModules.length === 0) {
      showToast("Select at least one module to back up.", "error");
      return;
    }
    setExporting(true);
    try {
      const entry = await BackupService.exportBackup(selectedModules, format, currentUser);
      showToast(`Backup "${entry.fileName}" created.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Backup failed.", "error");
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChosen(chosen: File) {
    setFile(chosen);
    setPreview(null);
    setPreviewing(true);
    try {
      const result = await BackupService.previewRestore(chosen);
      setPreview(result);
      setSelectedRestoreTables(Object.keys(result.tableCounts));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not read backup file.", "error");
      setFile(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleRestore() {
    if (!file || selectedRestoreTables.length === 0) return;
    const ok = await confirm({
      title: "Restore backup?",
      message: `This will REPLACE the data in ${selectedRestoreTables.length} table(s) with the contents of this backup file. This cannot be undone (except by restoring an earlier backup). If anything goes wrong partway through, nothing will be changed - restores either fully succeed or fully roll back.`,
      confirmLabel: "Restore",
      variant: "danger",
    });
    if (!ok) return;

    setRestoring(true);
    try {
      const result = await BackupService.restore(file, selectedRestoreTables, currentUser);
      if (result.success) {
        showToast("Restore completed successfully.", "success");
        setFile(null);
        setPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        showToast(`Restore failed and was rolled back: ${result.error}`, "error");
      }
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Backup & Restore" }]} />
      <PageHeader
        title="Backup & Restore"
        description="Full or partial offline backups, with validated, all-or-nothing restore"
      />

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link ${tab === "backup" ? "active" : ""}`} onClick={() => setTab("backup")}>
            Create backup
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "restore" ? "active" : ""}`} onClick={() => setTab("restore")}>
            Restore
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            History
          </button>
        </li>
      </ul>

      {tab === "backup" && (
        <Card>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h6 mb-0">Select modules</h2>
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-primary" onClick={() => setSelectedModules(ALL_MODULE_KEYS)}>
                Full backup (select all)
              </button>
              <button className="btn btn-sm btn-outline-secondary" onClick={() => setSelectedModules([])}>
                Clear
              </button>
            </div>
          </div>
          <div className="row g-2 mb-4">
            {BACKUP_MODULES.map((m) => (
              <div className="col-md-6" key={m.key}>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`mod-${m.key}`}
                    checked={selectedModules.includes(m.key)}
                    onChange={() => toggleModule(m.key)}
                  />
                  <label className="form-check-label" htmlFor={`mod-${m.key}`}>
                    {m.label}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="row g-3 align-items-end">
            <div className="col-auto">
              <label className="form-label small">Format</label>
              <select className="form-select" value={format} onChange={(e) => setFormat(e.target.value as BackupFormat)}>
                <option value="json">JSON (recommended - fully restorable)</option>
                <option value="xlsx">Excel (.xlsx) - for viewing/sharing only</option>
                <option value="csv">CSV - for viewing/sharing only</option>
              </select>
            </div>
            <div className="col-auto">
              <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
                {exporting ? "Creating backup…" : "Create backup"}
              </button>
            </div>
          </div>
          {format !== "json" && (
            <p className="text-muted small mt-3 mb-0">
              <i className="bi bi-info-circle me-1" />
              Excel/CSV backups are human-readable exports. Only a JSON backup can be restored back into ACTRS.
            </p>
          )}
        </Card>
      )}

      {tab === "restore" && (
        <Card>
          <h2 className="h6 mb-3">Choose a backup file</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="form-control mb-3"
            style={{ maxWidth: 420 }}
            onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
          />

          {previewing && <LoadingSpinner />}

          {preview && (
            <>
              <div className="p-3 rounded-3 bg-light mb-3 small">
                <div>Backup created: {new Date(preview.meta.createdAt).toLocaleString()} by {preview.meta.app} v{preview.meta.version}</div>
                <div>Scope: {preview.meta.scope === "full" ? "Full backup" : "Partial backup"}</div>
              </div>

              {preview.conflictWarnings.length > 0 && (
                <div className="alert alert-warning small">
                  <strong>Before you restore:</strong>
                  <ul className="mb-0 mt-1">
                    {preview.conflictWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <h3 className="h6 mt-3 mb-2">Tables to restore</h3>
              <div className="row g-2 mb-3">
                {Object.entries(preview.tableCounts).map(([tableName, count]) => (
                  <div className="col-md-6" key={tableName}>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id={`tbl-${tableName}`}
                        checked={selectedRestoreTables.includes(tableName)}
                        onChange={() =>
                          setSelectedRestoreTables((prev) =>
                            prev.includes(tableName) ? prev.filter((t) => t !== tableName) : [...prev, tableName],
                          )
                        }
                      />
                      <label className="form-check-label" htmlFor={`tbl-${tableName}`}>
                        {tableName} <span className="text-muted">({count} record{count === 1 ? "" : "s"})</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn btn-danger" onClick={handleRestore} disabled={restoring || selectedRestoreTables.length === 0}>
                {restoring ? "Restoring…" : "Restore selected tables"}
              </button>
            </>
          )}
        </Card>
      )}

      {tab === "history" && (
        <Card>
          {!history ? (
            <LoadingSpinner />
          ) : history.length === 0 ? (
            <p className="text-muted mb-0">No backup or restore actions yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>File</th>
                    <th>Scope</th>
                    <th>Records</th>
                    <th>By</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id}>
                      <td className="small">{new Date(h.performedAt).toLocaleString()}</td>
                      <td className="text-capitalize">{h.type}</td>
                      <td className="small">{h.fileName}</td>
                      <td className="text-capitalize">{h.scope ?? "—"}</td>
                      <td>{Object.values(h.recordCounts).reduce((a, b) => a + b, 0)}</td>
                      <td className="small">{h.performedBy ?? "—"}</td>
                      <td>
                        {h.outcome === "failed" || h.outcome === "rolled_back" ? (
                          <span className="badge text-bg-danger">Rolled back</span>
                        ) : (
                          <span className="badge text-bg-success">Success</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </>
  );
}
