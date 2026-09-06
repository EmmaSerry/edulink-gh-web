import { useEffect, useState, type FormEvent } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudCircuitService } from "@services/cloud/CircuitService";
import type { CircuitRow } from "@/types/database";

/**
 * Settings -> Circuits. District/platform admin only (see
 * edulink_gh_phase0s_circuits.sql) - a school_admin can pick a circuit
 * on their own School Profile tab, but doesn't manage the list itself.
 */
export function SettingsCircuits() {
  const { profile } = useCloudAuth();
  const [circuits, setCircuits] = useState<CircuitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function load(districtId: string) {
    setLoading(true);
    setLoadError(null);
    CloudCircuitService.listAll(districtId)
      .then(setCircuits)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load circuits."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (profile?.district_id) load(profile.district_id);
    else setLoading(false);
  }, [profile?.district_id]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!profile?.district_id || !newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await CloudCircuitService.create(profile.district_id, newName.trim());
      setNewName("");
      load(profile.district_id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this circuit.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(id: string) {
    if (!profile?.district_id || !renameValue.trim()) return;
    setBusyId(id);
    setRowError(null);
    try {
      await CloudCircuitService.rename(id, renameValue.trim());
      setRenamingId(null);
      load(profile.district_id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not rename this circuit.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(c: CircuitRow) {
    if (!profile?.district_id) return;
    setBusyId(c.id);
    setRowError(null);
    try {
      await CloudCircuitService.setActive(c.id, !c.is_active);
      load(profile.district_id);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not update this circuit.");
    } finally {
      setBusyId(null);
    }
  }

  if (!profile?.district_id) {
    return (
      <div className="alert alert-warning">
        Your account has no district assigned, so circuits can't be managed from here - ask a platform admin to set
        one.
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 fw-bold mb-0">Circuits</h2>
      </div>
      <p className="text-muted small mb-3">
        Every school in your district picks its circuit from this list on its own School Profile settings tab, so
        names stay consistent across the district.
      </p>

      {loadError && <div className="alert alert-danger py-2">{loadError}</div>}
      {createError && <div className="alert alert-danger py-2">{createError}</div>}
      {rowError && <div className="alert alert-danger py-2">{rowError}</div>}

      <form onSubmit={handleCreate} className="d-flex gap-2 mb-3">
        <input
          className="form-control form-control-sm"
          style={{ maxWidth: 280 }}
          placeholder="e.g. Cape Coast Circuit A"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={creating}>
          {creating ? "Adding…" : "Add circuit"}
        </button>
      </form>

      {loading ? (
        <p className="text-muted small mb-0">Loading…</p>
      ) : circuits.length === 0 ? (
        <p className="text-muted small mb-0">No circuits yet.</p>
      ) : (
        <div className="actrs-card p-0">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ width: 120 }}>Status</th>
                <th style={{ width: 220 }}></th>
              </tr>
            </thead>
            <tbody>
              {circuits.map((c) => (
                <tr key={c.id}>
                  <td>
                    {renamingId === c.id ? (
                      <input
                        className="form-control form-control-sm"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                      />
                    ) : (
                      c.name
                    )}
                  </td>
                  <td>
                    <span className={`badge ${c.is_active ? "text-bg-success" : "text-bg-secondary"}`}>
                      {c.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-end">
                    {renamingId === c.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm me-2"
                          disabled={busyId === c.id}
                          onClick={() => handleRename(c.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setRenamingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm me-2"
                          onClick={() => {
                            setRenamingId(c.id);
                            setRenameValue(c.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          disabled={busyId === c.id}
                          onClick={() => handleToggleActive(c)}
                        >
                          {c.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
