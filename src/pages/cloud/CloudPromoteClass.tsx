import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudAcademicYearService } from "@services/cloud/AcademicYearService";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudPromotionService, type PromoteResult } from "@services/cloud/PromotionService";
import type { AcademicYearRow, ClassRow, LevelRow, StudentRow, TermRow, PromotionOutcome } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

const OUTCOME_LABEL: Record<PromotionOutcome, string> = {
  PROMOTED: "Promote to a new class",
  REPEATED: "Repeat (stay at this level)",
  TRANSFERRED: "Move to a different class",
  GRADUATED: "Graduated / completed school",
};

/**
 * The year-end (or mid-year) batch action: move every - or some - of a
 * class's active pupils to a new class/term/year in one go, mark a
 * finishing class as graduated, or record a repeat. See
 * edulink_gh_phase0r_promotion.sql - this screen is a thin UI over
 * bulk_promote_class(), which does the real work one pupil at a time
 * so a single failure doesn't undo the rest of the batch.
 */
export function CloudPromoteClass() {
  const { classId } = useParams<{ classId: string }>();

  const [fromClass, setFromClass] = useState<ClassRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearRow[]>([]);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [fromTerm, setFromTerm] = useState<TermRow | null>(null);
  const [roster, setRoster] = useState<StudentRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [outcome, setOutcome] = useState<PromotionOutcome>("PROMOTED");
  const [toAcademicYearId, setToAcademicYearId] = useState("");
  const [toTermId, setToTermId] = useState("");
  const [toClassId, setToClassId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [results, setResults] = useState<PromoteResult[] | null>(null);

  useEffect(() => {
    if (!classId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      CloudClassService.getById(classId),
      CloudLevelService.list(),
      CloudClassService.list(),
      CloudAcademicYearService.list(),
      CloudTermService.getActive(),
    ])
      .then(async ([cls, levelRows, classRows, yearRows, activeTerm]) => {
        if (cancelled) return;
        setFromClass(cls);
        setLevels(levelRows);
        setClasses(classRows);
        setAcademicYears(yearRows);
        setFromTerm(activeTerm);
        if (activeTerm && cls) {
          const activeRoster = await CloudPromotionService.getActiveRoster(activeTerm.id, cls.id);
          if (cancelled) return;
          setRoster(activeRoster);
          setSelected(new Set(activeRoster.map((s) => s.id)));
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Could not load this class."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [classId]);

  useEffect(() => {
    if (!toAcademicYearId) {
      setTerms([]);
      setToTermId("");
      return;
    }
    CloudTermService.list(toAcademicYearId).then(setTerms);
  }, [toAcademicYearId]);

  const levelName = (id: string) => levels.find((l) => l.id === id)?.name ?? "Unknown level";
  const needsDestination = outcome !== "GRADUATED";

  const canSubmit =
    selected.size > 0 &&
    !submitting &&
    (!needsDestination || (toAcademicYearId && toTermId && toClassId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === roster.length ? new Set() : new Set(roster.map((s) => s.id))));
  }

  async function handleSubmit() {
    if (!classId || !fromClass) return;
    setSubmitting(true);
    setSubmitError(null);
    setResults(null);
    try {
      const res = await CloudPromotionService.bulkPromote({
        fromClassId: classId,
        studentIds: Array.from(selected),
        outcome,
        toClassId: needsDestination ? toClassId : undefined,
        toAcademicYearId: needsDestination ? toAcademicYearId : undefined,
        toTermId: needsDestination ? toTermId : undefined,
      });
      setResults(res);
      const succeededIds = new Set(res.filter((r) => r.ok).map((r) => r.studentId));
      setRoster((prev) => prev.filter((s) => !succeededIds.has(s.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        succeededIds.forEach((id) => next.delete(id));
        return next;
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not complete this action.");
    } finally {
      setSubmitting(false);
    }
  }

  const succeededCount = useMemo(() => results?.filter((r) => r.ok).length ?? 0, [results]);
  const failedResults = useMemo(() => results?.filter((r) => !r.ok) ?? [], [results]);

  if (loading) return <p className="text-muted">Loading…</p>;
  if (loadError) return <div className="alert alert-danger">{loadError}</div>;
  if (!fromClass) return <div className="alert alert-warning">Class not found.</div>;
  if (!fromTerm) {
    return (
      <div className="alert alert-warning">
        No active term is set for your school yet - set one under Settings → Academic years &amp; terms before
        promoting a class.
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-1">
        <h1 className="h4 mb-0">Promote {fromClass.name}</h1>
        <Link to="/settings" className="btn btn-outline-secondary btn-sm">
          Back to Settings
        </Link>
      </div>
      <p className="text-muted mb-4">
        {levelName(fromClass.level_id)} · {roster.length + succeededCount} active pupil
        {roster.length + succeededCount === 1 ? "" : "s"} for the current term ({fromTerm.term_name}).
      </p>

      {results && (
        <div className={`alert ${failedResults.length ? "alert-warning" : "alert-success"} py-2`}>
          <div>
            {succeededCount} pupil{succeededCount === 1 ? "" : "s"} updated successfully.
          </div>
          {failedResults.length > 0 && (
            <ul className="mb-0 mt-1 small">
              {failedResults.map((r) => (
                <li key={r.studentId}>
                  {roster.find((s) => s.id === r.studentId)?.first_name ?? r.studentId}: {r.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {submitError && <div className="alert alert-danger py-2">{submitError}</div>}

      <div className="actrs-card p-4 mb-3">
        <h2 className="h6 fw-bold mb-3">What's happening to these pupils?</h2>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small">Outcome</label>
            <select
              className="form-select form-select-sm"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as PromotionOutcome)}
            >
              {(Object.keys(OUTCOME_LABEL) as PromotionOutcome[]).map((o) => (
                <option key={o} value={o}>
                  {OUTCOME_LABEL[o]}
                </option>
              ))}
            </select>
          </div>
          {needsDestination && (
            <>
              <div className="col-md-3">
                <label className="form-label small">Destination academic year</label>
                <select
                  className="form-select form-select-sm"
                  value={toAcademicYearId}
                  onChange={(e) => {
                    setToAcademicYearId(e.target.value);
                    setToClassId("");
                  }}
                  required
                >
                  <option value="">Select…</option>
                  {academicYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.label}
                      {y.is_current ? " (current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label small">Destination term</label>
                <select
                  className="form-select form-select-sm"
                  value={toTermId}
                  onChange={(e) => setToTermId(e.target.value)}
                  disabled={!toAcademicYearId}
                  required
                >
                  <option value="">Select…</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.term_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label small">Destination class</label>
                <select
                  className="form-select form-select-sm"
                  value={toClassId}
                  onChange={(e) => setToClassId(e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({levelName(c.level_id)})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
        {outcome === "GRADUATED" && (
          <p className="text-muted small mb-0 mt-2">
            Selected pupils will be marked Graduated and removed from active class lists - their full academic
            record is kept, and this can be reversed from a pupil's own edit screen if needed.
          </p>
        )}
      </div>

      <div className="actrs-card p-0 mb-3">
        <div className="d-flex align-items-center justify-content-between p-3 border-bottom">
          <h2 className="h6 fw-bold mb-0">
            Pupils ({selected.size} of {roster.length} selected)
          </h2>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={toggleAll} disabled={roster.length === 0}>
            {selected.size === roster.length ? "Deselect all" : "Select all"}
          </button>
        </div>
        {roster.length === 0 ? (
          <p className="text-muted small p-3 mb-0">
            No active pupils left in this class for the current term - everyone has already been processed.
          </p>
        ) : (
          <table className="table mb-0 align-middle">
            <tbody>
              {roster.map((s) => (
                <tr key={s.id}>
                  <td style={{ width: 40 }}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                    />
                  </td>
                  <td>{fullNameOf(s)}</td>
                  <td className="text-muted small">{s.student_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={handleSubmit}>
        {submitting
          ? "Working…"
          : outcome === "GRADUATED"
            ? `Graduate ${selected.size} pupil${selected.size === 1 ? "" : "s"}`
            : `${OUTCOME_LABEL[outcome].split(" ")[0]} ${selected.size} pupil${selected.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
