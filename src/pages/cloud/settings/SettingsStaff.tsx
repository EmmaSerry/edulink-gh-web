import { useEffect, useState, type FormEvent } from "react";
import { CloudStaffService, type StaffRole, type UpdateStaffInput } from "@services/cloud/StaffService";
import type { UserProfileRow } from "@/types/database";

const ROLE_LABEL: Record<StaffRole, string> = {
  teacher: "Teacher",
  bursar: "Bursar",
  school_admin: "School admin",
};

const BLANK = { email: "", fullName: "", role: "teacher" as StaffRole, phone: "" };

/**
 * Settings -> Staff. Lets a school admin create teacher/bursar/admin
 * accounts themselves instead of me creating every one by hand in
 * Supabase Studio - see edulink_gh_phase0o_staff_and_classes.sql. A
 * newly created teacher still needs to be assigned to a class from
 * Settings -> Classes before the class-scoped RLS gives them anything
 * to actually see.
 */
export function SettingsStaff() {
  const [staff, setStaff] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ email: string; tempPassword: string } | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateStaffInput | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    setLoading(true);
    setLoadError(null);
    CloudStaffService.list()
      .then(setStaff)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load staff."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    setJustCreated(null);
    try {
      const { tempPassword } = await CloudStaffService.create({
        email: form.email.trim(),
        fullName: form.fullName.trim(),
        role: form.role,
        phone: form.phone.trim() || null,
      });
      setJustCreated({ email: form.email.trim(), tempPassword });
      setForm(BLANK);
      setShowForm(false);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this staff account.");
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(id: string) {
    setActionId(id);
    setActionError(null);
    try {
      await CloudStaffService.archive(id);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not archive this staff member.");
    } finally {
      setActionId(null);
    }
  }

  async function handleReactivate(id: string) {
    setActionId(id);
    setActionError(null);
    try {
      await CloudStaffService.reactivate(id);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not reactivate this staff member.");
    } finally {
      setActionId(null);
    }
  }

  function startEdit(s: UserProfileRow) {
    setEditingId(s.id);
    setEditForm({ fullName: s.full_name, role: (s.role as StaffRole) ?? "teacher", phone: s.phone });
    setActionError(null);
  }

  async function handleSaveEdit(id: string) {
    if (!editForm) return;
    setSavingEdit(true);
    setActionError(null);
    try {
      await CloudStaffService.update(id, editForm);
      setEditingId(null);
      setEditForm(null);
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      {justCreated && (
        <div className="alert alert-success">
          <div className="fw-semibold mb-1">Account created for {justCreated.email}</div>
          <div>
            Temporary password: <code className="fs-6">{justCreated.tempPassword}</code>
          </div>
          <div className="small text-muted mt-1">
            Share this with them directly (SMS, WhatsApp, in person) - it won't be shown again. If they can't sign
            in, check that "Confirm email" is switched off under Authentication → Providers → Email in Supabase.
          </div>
        </div>
      )}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 fw-bold mb-0">Staff accounts</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Add staff"}
        </button>
      </div>

      {loadError && <div className="alert alert-danger py-2">{loadError}</div>}
      {createError && <div className="alert alert-danger py-2">{createError}</div>}
      {actionError && <div className="alert alert-danger py-2">{actionError}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="actrs-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label small">Full name</label>
              <input
                className="form-control form-control-sm"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small">Email</label>
              <input
                type="email"
                className="form-control form-control-sm"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label small">Role</label>
              <select
                className="form-select form-select-sm"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
              >
                {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label small">Phone (optional)</label>
              <input
                className="form-control form-control-sm"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={creating}>
            {creating ? "Creating…" : "Create account"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted small mb-0">Loading…</p>
      ) : staff.length === 0 ? (
        <p className="text-muted small mb-0">No staff added yet.</p>
      ) : (
        <div className="actrs-card p-0">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Phone</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) =>
                editingId === s.id && editForm ? (
                  <tr key={s.id}>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={editForm.fullName}
                        onChange={(e) => setEditForm((f) => f && { ...f, fullName: e.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={editForm.role}
                        onChange={(e) => setEditForm((f) => f && { ...f, role: e.target.value as StaffRole })}
                      >
                        {(Object.keys(ROLE_LABEL) as StaffRole[]).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        value={editForm.phone ?? ""}
                        onChange={(e) => setEditForm((f) => f && { ...f, phone: e.target.value || null })}
                      />
                    </td>
                    <td>
                      {s.is_active ? (
                        <span className="badge text-bg-success">Active</span>
                      ) : (
                        <span className="badge text-bg-secondary">Archived</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={savingEdit}
                          onClick={() => handleSaveEdit(s.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            setEditingId(null);
                            setEditForm(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id} className={s.is_active ? "" : "opacity-75"}>
                    <td>{s.full_name}</td>
                    <td>
                      <span className="badge text-bg-secondary">{ROLE_LABEL[s.role as StaffRole] ?? s.role}</span>
                    </td>
                    <td className="text-muted">{s.phone ?? "—"}</td>
                    <td>
                      {s.is_active ? (
                        <span className="badge text-bg-success">Active</span>
                      ) : (
                        <span className="badge text-bg-secondary">Archived</span>
                      )}
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end">
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm"
                          disabled={actionId === s.id}
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </button>
                        {s.is_active ? (
                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            disabled={actionId === s.id}
                            onClick={() => handleArchive(s.id)}
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            disabled={actionId === s.id}
                            onClick={() => handleReactivate(s.id)}
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
