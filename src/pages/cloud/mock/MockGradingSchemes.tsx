import { useCallback, useEffect, useState } from "react";
import { MockExamService, type SavedScheme } from "@/services/cloud/MockExamService";
import {
  EXAMPLE_NINE_GRADE_BANDS,
  NINE_GRADE_REMARKS,
  validateGradingConfig,
  type GradeBand,
  type GradingConfig,
} from "@/mock/mockEngine";

interface Draft {
  id: string | null;
  name: string;
  maxMark: number;
  lowerIsBetter: boolean;
  scaleType: "nine_grade" | "custom";
  allowDecimals: boolean;
  isDefault: boolean;
  bands: GradeBand[];
}

function newDraft(): Draft {
  return {
    id: null,
    name: "",
    maxMark: 100,
    lowerIsBetter: true,
    scaleType: "nine_grade",
    allowDecimals: false,
    isDefault: false,
    bands: EXAMPLE_NINE_GRADE_BANDS.map((b) => ({ ...b })),
  };
}

function toConfig(d: Draft): GradingConfig {
  const bands = d.bands.map((b) => ({
    ...b,
    remark: d.scaleType === "nine_grade" ? (NINE_GRADE_REMARKS[b.grade] ?? b.remark) : b.remark,
  }));
  return {
    schemeName: d.name,
    maxMark: d.maxMark,
    lowerIsBetter: d.lowerIsBetter,
    scaleType: d.scaleType,
    allowDecimals: d.allowDecimals,
    bands,
  };
}

/** Grading schemes manager. Mocks keep their own frozen copy, so editing a scheme never changes an existing mock. */
export function MockGradingSchemes({ canEdit }: { canEdit: boolean }) {
  const [schemes, setSchemes] = useState<SavedScheme[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSchemes(await MockExamService.listSchemes());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load grading schemes.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const problems = draft ? validateGradingConfig(toConfig(draft)) : [];

  const setBand = (i: number, patch: Partial<GradeBand>) =>
    setDraft((d) => (d ? { ...d, bands: d.bands.map((b, j) => (j === i ? { ...b, ...patch } : b)) } : d));

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError("");
    try {
      const cfg = toConfig(draft);
      await MockExamService.saveScheme({
        id: draft.id,
        name: draft.name.trim(),
        maxMark: cfg.maxMark,
        lowerIsBetter: cfg.lowerIsBetter,
        scaleType: cfg.scaleType,
        allowDecimals: cfg.allowDecimals,
        bands: cfg.bands,
        isDefault: draft.isDefault,
      });
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="alert alert-info small">
        The boundaries below are <strong>examples only</strong>. Set the ranges your school or district uses. A mock keeps its own copy of the scheme it
        was created with, so later changes never alter old results. Mock aggregates are school-level estimates, not official WAEC results.
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      {!draft && (
        <>
          {loading ? (
            <div className="text-muted">Loading…</div>
          ) : schemes.length === 0 ? (
            <div className="text-muted mb-3">No grading scheme yet. Create one before setting up a mock.</div>
          ) : (
            <div className="table-responsive mb-3">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Scale</th>
                    <th>Max mark</th>
                    <th>Ranges</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {schemes.map((s) => (
                    <tr key={s.id}>
                      <td>
                        {s.name} {s.isDefault && <span className="badge text-bg-primary">Default</span>}
                      </td>
                      <td>{s.scaleType === "nine_grade" ? "Nine-grade" : "Custom"}</td>
                      <td>{s.maxMark}</td>
                      <td className="small text-muted">{s.bands.map((b) => `${b.grade}: ${b.min}-${b.max}`).join("  ·  ")}</td>
                      <td className="text-end">
                        {canEdit && (
                          <>
                            <button
                              className="btn btn-sm btn-outline-primary me-1"
                              onClick={() => setDraft({ ...s, bands: [...s.bands].sort((a, b) => b.min - a.min) })}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={async () => {
                                if (!window.confirm(`Delete "${s.name}"? Existing mocks are not affected.`)) return;
                                try {
                                  await MockExamService.deleteScheme(s.id);
                                  await load();
                                } catch (e) {
                                  setError(e instanceof Error ? e.message : "Could not delete.");
                                }
                              }}
                            >
                              Delete
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
          {canEdit && (
            <button className="btn btn-primary" onClick={() => setDraft({ ...newDraft(), name: schemes.length ? "" : "School nine-grade scale", isDefault: schemes.length === 0 })}>
              New grading scheme
            </button>
          )}
        </>
      )}

      {draft && (
        <div className="card">
          <div className="card-body">
            <div className="row g-3 mb-3">
              <div className="col-md-4">
                <label className="form-label">Scheme name</label>
                <input className="form-control" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </div>
              <div className="col-md-2">
                <label className="form-label">Maximum mark</label>
                <input
                  type="number"
                  className="form-control"
                  value={draft.maxMark}
                  onChange={(e) => setDraft({ ...draft, maxMark: Number(e.target.value) })}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Scale type</label>
                <select
                  className="form-select"
                  value={draft.scaleType}
                  onChange={(e) => setDraft({ ...draft, scaleType: e.target.value as Draft["scaleType"] })}
                >
                  <option value="nine_grade">Nine-grade (1 = best)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Better grade is…</label>
                <select
                  className="form-select"
                  value={draft.lowerIsBetter ? "lower" : "higher"}
                  onChange={(e) => setDraft({ ...draft, lowerIsBetter: e.target.value === "lower" })}
                >
                  <option value="lower">the lower number</option>
                  <option value="higher">the higher number</option>
                </select>
              </div>
              <div className="col-12 d-flex gap-4">
                <div className="form-check">
                  <input
                    id="mdec"
                    type="checkbox"
                    className="form-check-input"
                    checked={draft.allowDecimals}
                    onChange={(e) => setDraft({ ...draft, allowDecimals: e.target.checked })}
                  />
                  <label htmlFor="mdec" className="form-check-label">
                    Allow decimal marks
                  </label>
                </div>
                <div className="form-check">
                  <input
                    id="mdef"
                    type="checkbox"
                    className="form-check-input"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft({ ...draft, isDefault: e.target.checked })}
                  />
                  <label htmlFor="mdef" className="form-check-label">
                    Use as my default
                  </label>
                </div>
              </div>
            </div>

            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>Grade</th>
                  <th style={{ width: 120 }}>From mark</th>
                  <th style={{ width: 120 }}>To mark</th>
                  <th>Remark</th>
                  <th style={{ width: 50 }} />
                </tr>
              </thead>
              <tbody>
                {draft.bands.map((b, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={b.grade}
                        onChange={(e) => setBand(i, { grade: Number(e.target.value), label: e.target.value })}
                      />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={b.min} onChange={(e) => setBand(i, { min: Number(e.target.value) })} />
                    </td>
                    <td>
                      <input type="number" className="form-control form-control-sm" value={b.max} onChange={(e) => setBand(i, { max: Number(e.target.value) })} />
                    </td>
                    <td>
                      {draft.scaleType === "nine_grade" ? (
                        <span className="text-muted">{NINE_GRADE_REMARKS[b.grade] ?? "—"} (automatic)</span>
                      ) : (
                        <input className="form-control form-control-sm" value={b.remark} onChange={(e) => setBand(i, { remark: e.target.value })} />
                      )}
                    </td>
                    <td>
                      {draft.scaleType === "custom" && (
                        <button className="btn btn-sm btn-outline-danger" onClick={() => setDraft({ ...draft, bands: draft.bands.filter((_, j) => j !== i) })}>
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {draft.scaleType === "custom" && (
              <button
                className="btn btn-sm btn-outline-secondary mb-3"
                onClick={() => setDraft({ ...draft, bands: [...draft.bands, { min: 0, max: 0, grade: draft.bands.length + 1, label: String(draft.bands.length + 1), remark: "" }] })}
              >
                Add a range
              </button>
            )}

            {problems.length > 0 && (
              <div className="alert alert-warning small">
                <strong>Fix before saving:</strong>
                <ul className="mb-0">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="d-flex gap-2">
              <button className="btn btn-primary" disabled={busy || problems.length > 0 || !draft.name.trim()} onClick={save}>
                {busy ? "Saving…" : "Save scheme"}
              </button>
              <button className="btn btn-outline-secondary" onClick={() => setDraft(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
