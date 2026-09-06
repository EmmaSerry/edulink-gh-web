import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudStaffService } from "@services/cloud/StaffService";
import type { ClassRow, LevelRow, UserProfileRow } from "@/types/database";

const BLANK_FORM = { levelId: "", name: "", code: "", capacity: "" };

/**
 * Settings -> Classes. The other half of what phase0o closes: creating
 * a class, and - the specific gap that was blocking testing the
 * teacher-scoped RLS from phase0l - assigning which staff member is
 * that class's teacher. Nothing here works until Settings -> Staff has
 * at least one teacher account to assign.
 */
export function SettingsClasses() {
  const { profile } = useCloudAuth();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [staff, setStaff] = useState<UserProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);

  const teachers = useMemo(() => staff.filter((s) => s.role === "teacher" && s.is_active), [staff]);
  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? "Unknown level";

  function load() {
    setLoading(true);
    setLoadError(null);
    Promise.all([CloudClassService.list(), CloudLevelService.list(), CloudStaffService.list()])
      .then(([classRows, levelRows, staffRows]) => {
        setClasses(classRows);
        setLevels(levelRows);
        setStaff(staffRows);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load classes."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id) return;
    setCreating(true);
    setCreateError(null);
    try {
      await CloudClassService.create({
        schoolId: profile.school_id,
        levelId: form.levelId,
        name: form.name.trim(),
        code: form.code.trim(),
        capacity: form.capacity.trim() === "" ? null : Number(form.capacity),
      });
      setForm(BLANK_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create this class.");
    } finally {
      setCreating(false);
    }
  }

  async function handleAssign(classId: string, teacherUserId: string) {
    setAssigningId(classId);
    setAssignError(null);
    try {
      await CloudClassService.assignTeacher(classId, teacherUserId === "" ? null : teacherUserId);
      load();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not update the class teacher.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 fw-bold mb-0">Classes</h2>
        <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "Add class"}
        </button>
      </div>

      {loadError && <div className="alert alert-danger py-2">{loadError}</div>}
      {createError && <div className="alert alert-danger py-2">{createError}</div>}
      {assignError && <div className="alert alert-danger py-2">{assignError}</div>}
      {teachers.length === 0 && !loading && (
        <div className="alert alert-warning py-2 small">
          No teacher accounts yet - add one under Settings → Staff before you can assign a class teacher.
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="actrs-card p-3 mb-3">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label small">Level</label>
              <select
                className="form-select form-select-sm"
                value={form.levelId}
                onChange={(e) => setForm((f) => ({ ...f, levelId: e.target.value }))}
                required
              >
                <option value="">Select a level…</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Class name</label>
              <input
                className="form-control form-control-sm"
                placeholder="e.g. KG1 Blue"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Code</label>
              <input
                className="form-control form-control-sm"
                placeholder="e.g. KG1B"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Capacity</label>
              <input
                type="number"
                min={0}
                className="form-control form-control-sm"
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
              />
            </div>
          </div>
          <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={creating}>
            {creating ? "Adding…" : "Add class"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted small mb-0">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="text-muted small mb-0">No classes yet.</p>
      ) : (
        <div className="actrs-card p-0">
          <table className="table mb-0 align-middle">
            <thead>
              <tr>
                <th>Class</th>
                <th>Level</th>
                <th style={{ width: 260 }}>Class teacher</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="fw-semibold">{c.name}</div>
                    <div className="text-muted small">{c.code}</div>
                  </td>
                  <td>{levelName(c.level_id)}</td>
                  <td>
                    <select
                      className="form-select form-select-sm"
                      value={c.class_teacher_id ?? ""}
                      disabled={assigningId === c.id}
                      onChange={(e) => handleAssign(c.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
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
