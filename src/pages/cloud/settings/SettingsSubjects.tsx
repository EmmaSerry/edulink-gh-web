import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudSubjectService, type SaveSubjectInput } from "@services/cloud/SubjectService";
import { CloudLevelService } from "@services/cloud/LevelService";
import type { SubjectRow, LevelRow } from "@/types/database";

const BLANK_FORM: SaveSubjectInput = { name: "", shortName: "", code: "", levelIds: [] };

function LevelCheckboxes({
  levels,
  selectedIds,
  onToggle,
}: {
  levels: LevelRow[];
  selectedIds: string[];
  onToggle: (levelId: string) => void;
}) {
  return (
    <div className="d-flex flex-wrap gap-2">
      {levels.map((l) => (
        <label
          key={l.id}
          className={`btn btn-sm ${selectedIds.includes(l.id) ? "btn-primary" : "btn-outline-secondary"}`}
          style={{ cursor: "pointer" }}
        >
          <input
            type="checkbox"
            className="d-none"
            checked={selectedIds.includes(l.id)}
            onChange={() => onToggle(l.id)}
          />
          {l.name}
        </label>
      ))}
    </div>
  );
}

/**
 * Settings -> Subjects. Previously a subject's level assignments could
 * only be fixed by asking a developer to edit the database directly -
 * this is that gap closed: any school_admin can add a subject, change
 * which levels it applies to, or remove one (which just deactivates it
 * - see create_school_subject/update_school_subject/set_subject_active
 * in edulink_gh_subjects_management.sql for why nothing here is ever a
 * hard delete). Levels shown as toggle chips rather than a multi-select
 * dropdown - eleven levels is few enough that seeing them all at once,
 * and which are already picked, beats scrolling a dropdown list.
 */
export function SettingsSubjects() {
  const { profile } = useCloudAuth();
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SaveSubjectInput>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SaveSubjectInput>(BLANK_FORM);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setLoadError(null);
    Promise.all([CloudSubjectService.listAll(), CloudLevelService.list(profile?.school_id)])
      .then(([subjectRows, levelRows]) => {
        setSubjects(subjectRows);
        setLevels(levelRows);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load subjects."))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? "?";
  const visibleSubjects = useMemo(
    () => subjects.filter((s) => showInactive || s.is_active),
    [subjects, showInactive]
  );

  function toggleFormLevel(levelId: string) {
    setForm((f) => ({
      ...f,
      levelIds: f.levelIds.includes(levelId) ? f.levelIds.filter((id) => id !== levelId) : [...f.levelIds, levelId],
    }));
  }

  function toggleEditLevel(levelId: string) {
    setEditForm((f) => ({
      ...f,
      levelIds: f.levelIds.includes(levelId) ? f.levelIds.filter((id) => id !== levelId) : [...f.levelIds, levelId],
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await CloudSubjectService.create(form);
      setForm(BLANK_FORM);
      setShowForm(false);
      load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not add this subject.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: SubjectRow) {
    setEditingId(s.id);
    setEditForm({ name: s.name, shortName: s.short_name ?? "", code: s.code ?? "", levelIds: [...s.level_ids] });
    setRowError(null);
  }

  async function handleSaveEdit(subjectId: string) {
    setBusyId(subjectId);
    setRowError(null);
    try {
      await CloudSubjectService.update(subjectId, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not save changes to this subject.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleToggleActive(s: SubjectRow) {
    setBusyId(s.id);
    setRowError(null);
    try {
      await CloudSubjectService.setActive(s.id, !s.is_active);
      load();
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Could not update this subject.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 fw-bold mb-0">Subjects</h2>
        <div className="d-flex align-items-center gap-3">
          <div className="form-check form-switch mb-0">
            <input
              className="form-check-input"
              type="checkbox"
              id="showInactiveSubjects"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="showInactiveSubjects">
              Show removed subjects
            </label>
          </div>
          <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancel" : "Add subject"}
          </button>
        </div>
      </div>

      <p className="text-muted small mb-3">
        Choose which levels each subject applies to. Removing a subject doesn't delete it or any score already
        recorded against it - it just stops offering it for new assessment entry, and can be restored at any time.
      </p>

      {loadError && <div className="alert alert-danger py-2">{loadError}</div>}
      {saveError && <div className="alert alert-danger py-2">{saveError}</div>}
      {rowError && <div className="alert alert-danger py-2">{rowError}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="actrs-card p-3 mb-3">
          <div className="row g-2 mb-2">
            <div className="col-md-5">
              <label className="form-label small">Subject name</label>
              <input
                className="form-control form-control-sm"
                placeholder="e.g. French"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Short name</label>
              <input
                className="form-control form-control-sm"
                placeholder="e.g. FR"
                value={form.shortName}
                onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label small">Code</label>
              <input
                className="form-control form-control-sm"
                placeholder="e.g. FR"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              />
            </div>
          </div>
          <label className="form-label small d-block">Applies to</label>
          <LevelCheckboxes levels={levels} selectedIds={form.levelIds} onToggle={toggleFormLevel} />
          <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={saving || form.levelIds.length === 0}>
            {saving ? "Adding…" : "Add subject"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-muted small mb-0">Loading…</p>
      ) : visibleSubjects.length === 0 ? (
        <p className="text-muted small mb-0">No subjects yet.</p>
      ) : (
        <div className="d-flex flex-column gap-2">
          {visibleSubjects.map((s) => (
            <div className={`actrs-card p-3 ${!s.is_active ? "opacity-50" : ""}`} key={s.id}>
              {editingId === s.id ? (
                <div>
                  <div className="row g-2 mb-2">
                    <div className="col-md-5">
                      <input
                        className="form-control form-control-sm"
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Short name"
                        value={editForm.shortName}
                        onChange={(e) => setEditForm((f) => ({ ...f, shortName: e.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <input
                        className="form-control form-control-sm"
                        placeholder="Code"
                        value={editForm.code}
                        onChange={(e) => setEditForm((f) => ({ ...f, code: e.target.value }))}
                      />
                    </div>
                  </div>
                  <LevelCheckboxes levels={levels} selectedIds={editForm.levelIds} onToggle={toggleEditLevel} />
                  <div className="d-flex gap-2 mt-3">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busyId === s.id || editForm.levelIds.length === 0}
                      onClick={() => handleSaveEdit(s.id)}
                    >
                      {busyId === s.id ? "Saving…" : "Save"}
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="d-flex align-items-start justify-content-between gap-3">
                  <div>
                    <div className="fw-semibold">
                      {s.name}
                      {!s.is_active && <span className="badge bg-secondary ms-2">Removed</span>}
                    </div>
                    {s.short_name && <div className="text-muted small">{s.short_name}</div>}
                    <div className="mt-1 d-flex flex-wrap gap-1">
                      {s.level_ids.map((id) => (
                        <span key={id} className="badge bg-body-secondary text-body border">
                          {levelName(id)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="d-flex gap-2 flex-shrink-0">
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => startEdit(s)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${s.is_active ? "btn-outline-danger" : "btn-outline-success"}`}
                      disabled={busyId === s.id}
                      onClick={() => handleToggleActive(s)}
                    >
                      {busyId === s.id ? "…" : s.is_active ? "Remove" : "Restore"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
