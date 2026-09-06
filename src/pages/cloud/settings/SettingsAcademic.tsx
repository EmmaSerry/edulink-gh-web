import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudAcademicYearService } from "@services/cloud/AcademicYearService";
import { CloudTermService, type UpdateTermInput } from "@services/cloud/TermService";
import type { AcademicYearRow, TermRow } from "@/types/database";

const BLANK_TERM_FORM = {
  termName: "",
  termNumber: "1" as "1" | "2" | "3",
  openingDate: "",
  closingDate: "",
  vacationDate: "",
  reopeningDate: "",
  totalSchoolDays: "",
  makeActive: false,
};

function toDateOrNull(v: string): string | null {
  return v.trim() === "" ? null : v;
}

function toIntOrNull(v: string): number | null {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Settings -> Academic years & terms. The self-service replacement for
 * the manual academic-year/term SQL every new school has needed from me
 * so far - create_academic_year/create_term/set_current_academic_year/
 * set_active_term (edulink_gh_phase0k_settings.sql) keep "only one year
 * is current" and "only one term is active" true no matter which admin
 * clicks what, when.
 */
export function SettingsAcademic() {
  const { profile } = useCloudAuth();
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [yearsError, setYearsError] = useState<string | null>(null);
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);

  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);
  const [termsError, setTermsError] = useState<string | null>(null);

  const [newYearLabel, setNewYearLabel] = useState("");
  const [newYearCurrent, setNewYearCurrent] = useState(false);
  const [creatingYear, setCreatingYear] = useState(false);
  const [yearActionError, setYearActionError] = useState<string | null>(null);

  const [showTermForm, setShowTermForm] = useState(false);
  const [termForm, setTermForm] = useState(BLANK_TERM_FORM);
  const [creatingTerm, setCreatingTerm] = useState(false);
  const [termActionError, setTermActionError] = useState<string | null>(null);

  const [editingTermId, setEditingTermId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<UpdateTermInput | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  function loadYears() {
    setLoadingYears(true);
    setYearsError(null);
    CloudAcademicYearService.list()
      .then((rows) => {
        setYears(rows);
        setSelectedYearId((prev) => prev ?? rows.find((y) => y.is_current)?.id ?? rows[0]?.id ?? null);
      })
      .catch((err) => setYearsError(err instanceof Error ? err.message : "Could not load academic years."))
      .finally(() => setLoadingYears(false));
  }

  useEffect(loadYears, []);

  function loadTerms(yearId: string) {
    setLoadingTerms(true);
    setTermsError(null);
    CloudTermService.list(yearId)
      .then(setTerms)
      .catch((err) => setTermsError(err instanceof Error ? err.message : "Could not load terms."))
      .finally(() => setLoadingTerms(false));
  }

  useEffect(() => {
    if (selectedYearId) loadTerms(selectedYearId);
    else setTerms([]);
  }, [selectedYearId]);

  const selectedYear = useMemo(() => years.find((y) => y.id === selectedYearId) ?? null, [years, selectedYearId]);

  async function handleCreateYear(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id || !newYearLabel.trim()) return;
    setCreatingYear(true);
    setYearActionError(null);
    try {
      const created = await CloudAcademicYearService.create(profile.school_id, newYearLabel.trim(), newYearCurrent);
      setNewYearLabel("");
      setNewYearCurrent(false);
      loadYears();
      setSelectedYearId(created.id);
    } catch (err) {
      setYearActionError(err instanceof Error ? err.message : "Could not create academic year.");
    } finally {
      setCreatingYear(false);
    }
  }

  async function handleSetCurrentYear(id: string) {
    setYearActionError(null);
    try {
      await CloudAcademicYearService.setCurrent(id);
      loadYears();
    } catch (err) {
      setYearActionError(err instanceof Error ? err.message : "Could not update the current year.");
    }
  }

  async function handleCreateTerm(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id || !selectedYearId || !termForm.termName.trim()) return;
    setCreatingTerm(true);
    setTermActionError(null);
    try {
      await CloudTermService.create({
        schoolId: profile.school_id,
        academicYearId: selectedYearId,
        termName: termForm.termName.trim(),
        termNumber: Number(termForm.termNumber) as 1 | 2 | 3,
        openingDate: toDateOrNull(termForm.openingDate),
        closingDate: toDateOrNull(termForm.closingDate),
        vacationDate: toDateOrNull(termForm.vacationDate),
        reopeningDate: toDateOrNull(termForm.reopeningDate),
        totalSchoolDays: toIntOrNull(termForm.totalSchoolDays),
        makeActive: termForm.makeActive,
      });
      setTermForm(BLANK_TERM_FORM);
      setShowTermForm(false);
      loadTerms(selectedYearId);
    } catch (err) {
      setTermActionError(err instanceof Error ? err.message : "Could not create term.");
    } finally {
      setCreatingTerm(false);
    }
  }

  async function handleSetActiveTerm(id: string) {
    setTermActionError(null);
    try {
      await CloudTermService.setActive(id);
      if (selectedYearId) loadTerms(selectedYearId);
    } catch (err) {
      setTermActionError(err instanceof Error ? err.message : "Could not update the active term.");
    }
  }

  function startEdit(term: TermRow) {
    setEditingTermId(term.id);
    setEditForm({
      termName: term.term_name,
      openingDate: term.opening_date,
      closingDate: term.closing_date,
      vacationDate: term.vacation_date,
      reopeningDate: term.reopening_date,
      totalSchoolDays: term.total_school_days,
    });
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingTermId || !editForm) return;
    setSavingEdit(true);
    setTermActionError(null);
    try {
      await CloudTermService.update(editingTermId, editForm);
      setEditingTermId(null);
      setEditForm(null);
      if (selectedYearId) loadTerms(selectedYearId);
    } catch (err) {
      setTermActionError(err instanceof Error ? err.message : "Could not save term changes.");
    } finally {
      setSavingEdit(false);
    }
  }

  return (
    <div>
      <div className="row g-4">
        <div className="col-lg-5">
          <div className="actrs-card p-4">
            <h2 className="h6 fw-bold mb-3">Academic years</h2>
            {yearsError && <div className="alert alert-danger py-2">{yearsError}</div>}
            {loadingYears ? (
              <p className="text-muted small mb-0">Loading…</p>
            ) : years.length === 0 ? (
              <p className="text-muted small mb-3">No academic years yet - add the first one below.</p>
            ) : (
              <ul className="list-group mb-3">
                {years.map((y) => (
                  <li
                    key={y.id}
                    className={`list-group-item d-flex align-items-center justify-content-between ${
                      y.id === selectedYearId ? "active" : ""
                    }`}
                    role="button"
                    onClick={() => setSelectedYearId(y.id)}
                  >
                    <span>
                      {y.label}
                      {y.is_current && <span className="badge bg-success ms-2">Current</span>}
                    </span>
                    {!y.is_current && (
                      <button
                        type="button"
                        className={`btn btn-sm ${y.id === selectedYearId ? "btn-outline-light" : "btn-outline-secondary"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetCurrentYear(y.id);
                        }}
                      >
                        Set current
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {yearActionError && <div className="alert alert-danger py-2">{yearActionError}</div>}
            <form onSubmit={handleCreateYear} className="d-flex flex-column gap-2">
              <label className="form-label small mb-0">Add academic year</label>
              <input
                className="form-control"
                placeholder="e.g. 2027/2028"
                value={newYearLabel}
                onChange={(e) => setNewYearLabel(e.target.value)}
                required
              />
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="newYearCurrent"
                  checked={newYearCurrent}
                  onChange={(e) => setNewYearCurrent(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="newYearCurrent">
                  Make this the current year
                </label>
              </div>
              <button className="btn btn-primary btn-sm align-self-start" type="submit" disabled={creatingYear}>
                {creatingYear ? "Adding…" : "Add year"}
              </button>
            </form>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="actrs-card p-4">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h2 className="h6 fw-bold mb-0">Terms {selectedYear ? `— ${selectedYear.label}` : ""}</h2>
              {selectedYearId && (
                <button className="btn btn-outline-primary btn-sm" onClick={() => setShowTermForm((s) => !s)}>
                  {showTermForm ? "Cancel" : "Add term"}
                </button>
              )}
            </div>

            {!selectedYearId && <p className="text-muted small mb-0">Select an academic year to manage its terms.</p>}
            {termsError && <div className="alert alert-danger py-2">{termsError}</div>}
            {termActionError && <div className="alert alert-danger py-2">{termActionError}</div>}

            {showTermForm && selectedYearId && (
              <form onSubmit={handleCreateTerm} className="actrs-card p-3 mb-3">
                <div className="row g-2">
                  <div className="col-md-6">
                    <label className="form-label small">Term name</label>
                    <input
                      className="form-control form-control-sm"
                      placeholder="e.g. Term 1"
                      value={termForm.termName}
                      onChange={(e) => setTermForm((f) => ({ ...f, termName: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Term number</label>
                    <select
                      className="form-select form-select-sm"
                      value={termForm.termNumber}
                      onChange={(e) => setTermForm((f) => ({ ...f, termNumber: e.target.value as "1" | "2" | "3" }))}
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Opening date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={termForm.openingDate}
                      onChange={(e) => setTermForm((f) => ({ ...f, openingDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">Closing date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={termForm.closingDate}
                      onChange={(e) => setTermForm((f) => ({ ...f, closingDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Vacation date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={termForm.vacationDate}
                      onChange={(e) => setTermForm((f) => ({ ...f, vacationDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Reopening date</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={termForm.reopeningDate}
                      onChange={(e) => setTermForm((f) => ({ ...f, reopeningDate: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small">Total school days</label>
                    <input
                      type="number"
                      min={0}
                      className="form-control form-control-sm"
                      value={termForm.totalSchoolDays}
                      onChange={(e) => setTermForm((f) => ({ ...f, totalSchoolDays: e.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="newTermActive"
                        checked={termForm.makeActive}
                        onChange={(e) => setTermForm((f) => ({ ...f, makeActive: e.target.checked }))}
                      />
                      <label className="form-check-label small" htmlFor="newTermActive">
                        Make this the active term
                      </label>
                    </div>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm mt-3" type="submit" disabled={creatingTerm}>
                  {creatingTerm ? "Adding…" : "Add term"}
                </button>
              </form>
            )}

            {loadingTerms ? (
              <p className="text-muted small mb-0">Loading terms…</p>
            ) : selectedYearId && terms.length === 0 && !showTermForm ? (
              <p className="text-muted small mb-0">No terms yet for this year.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {terms.map((t) =>
                  editingTermId === t.id && editForm ? (
                    <form key={t.id} onSubmit={handleSaveEdit} className="actrs-card p-3">
                      <div className="row g-2">
                        <div className="col-md-6">
                          <label className="form-label small">Term name</label>
                          <input
                            className="form-control form-control-sm"
                            value={editForm.termName}
                            onChange={(e) => setEditForm((f) => f && { ...f, termName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small">Total school days</label>
                          <input
                            type="number"
                            min={0}
                            className="form-control form-control-sm"
                            value={editForm.totalSchoolDays ?? ""}
                            onChange={(e) =>
                              setEditForm((f) => f && { ...f, totalSchoolDays: toIntOrNull(e.target.value) })
                            }
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Opening</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editForm.openingDate ?? ""}
                            onChange={(e) => setEditForm((f) => f && { ...f, openingDate: toDateOrNull(e.target.value) })}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Closing</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editForm.closingDate ?? ""}
                            onChange={(e) => setEditForm((f) => f && { ...f, closingDate: toDateOrNull(e.target.value) })}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Vacation</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editForm.vacationDate ?? ""}
                            onChange={(e) => setEditForm((f) => f && { ...f, vacationDate: toDateOrNull(e.target.value) })}
                          />
                        </div>
                        <div className="col-md-3">
                          <label className="form-label small">Reopening</label>
                          <input
                            type="date"
                            className="form-control form-control-sm"
                            value={editForm.reopeningDate ?? ""}
                            onChange={(e) => setEditForm((f) => f && { ...f, reopeningDate: toDateOrNull(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="d-flex gap-2 mt-3">
                        <button className="btn btn-primary btn-sm" type="submit" disabled={savingEdit}>
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => {
                            setEditingTermId(null);
                            setEditForm(null);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div key={t.id} className="d-flex align-items-center justify-content-between actrs-card p-3">
                      <div>
                        <div className="fw-semibold">
                          {t.term_name}
                          {t.is_active && <span className="badge bg-success ms-2">Active</span>}
                        </div>
                        <div className="text-muted small">
                          {t.opening_date ?? "—"} to {t.closing_date ?? "—"}
                          {t.total_school_days ? ` · ${t.total_school_days} school days` : ""}
                        </div>
                      </div>
                      <div className="d-flex gap-2">
                        {!t.is_active && (
                          <button className="btn btn-outline-secondary btn-sm" onClick={() => handleSetActiveTerm(t.id)}>
                            Set active
                          </button>
                        )}
                        <button className="btn btn-outline-primary btn-sm" onClick={() => startEdit(t)}>
                          Edit
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
