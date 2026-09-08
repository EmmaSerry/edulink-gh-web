import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CloudDistrictService } from "@services/cloud/DistrictService";
import { CloudAcademicStandardsService } from "@services/cloud/AcademicStandardsService";
import { AcademicStandardsPanel, SchoolBreakdownPanel } from "@components/AcademicStandardsPanel";
import { downloadCsv } from "@/lib/csvExport";
import type { DistrictSchoolOverviewRow, DistrictAcademicStandards, PendingSchoolRow, IdleTimeoutSettings } from "@/types/database";

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="col-sm-6 col-lg-3">
      <div className="actrs-card p-3 h-100">
        <div className="text-muted small mb-1">{label}</div>
        <div className="h3 mb-0">{value}</div>
      </div>
    </div>
  );
}

/**
 * "Give district and system admin the right to set" the idle-session
 * timeout - see get_idle_timeout_settings() in
 * edulink_gh_phase0z_idle_timeout_and_signup_fix.sql. A district admin
 * only ever sees/edits their own district's override; a platform admin
 * additionally sees/edits the platform-wide default every district
 * without its own override falls back to. Enforcement itself lives in
 * CloudAuthContext, not here - this is just the control panel.
 */
function SessionTimeoutPanel() {
  const [settings, setSettings] = useState<IdleTimeoutSettings | null>(null);
  const [platformMinutes, setPlatformMinutes] = useState("");
  const [districtMinutes, setDistrictMinutes] = useState("");
  const [useDistrictOverride, setUseDistrictOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function load() {
    CloudDistrictService.getIdleTimeoutSettings()
      .then((s) => {
        setSettings(s);
        setPlatformMinutes(String(s.platformDefaultMinutes));
        setUseDistrictOverride(s.districtOverrideMinutes !== null);
        setDistrictMinutes(String(s.districtOverrideMinutes ?? s.platformDefaultMinutes));
      })
      .catch(() => setSettings(null));
  }

  useEffect(load, []);

  async function saveDistrict(e: FormEvent) {
    e.preventDefault();
    if (!settings?.districtId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (useDistrictOverride) {
        const minutes = Number(districtMinutes);
        if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
          throw new Error("Choose a timeout between 1 and 480 minutes.");
        }
        await CloudDistrictService.setDistrictIdleTimeout(settings.districtId, minutes);
      } else {
        await CloudDistrictService.setDistrictIdleTimeout(settings.districtId, null);
      }
      setSuccess("Session timeout updated.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the session timeout.");
    } finally {
      setSaving(false);
    }
  }

  async function savePlatform(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const minutes = Number(platformMinutes);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 480) {
        throw new Error("Choose a timeout between 1 and 480 minutes.");
      }
      await CloudDistrictService.setPlatformIdleTimeout(minutes);
      setSuccess("Platform-wide session timeout updated.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the session timeout.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings || (!settings.canSetDistrict && !settings.canSetPlatform)) return null;

  return (
    <div className="actrs-card p-4 mb-4">
      <h2 className="h6 fw-bold mb-1">Session timeout</h2>
      <p className="text-muted small mb-3">
        Signs a device out automatically after this many minutes of inactivity - also helps stop a device from
        staying signed in unattended. Currently applying <strong>{settings.effectiveMinutes} minutes</strong>.
      </p>

      {success && <div className="alert alert-success py-2">{success}</div>}
      {error && <div className="alert alert-danger py-2">{error}</div>}

      {settings.canSetDistrict && (
        <form className="d-flex flex-wrap align-items-end gap-3 mb-3" onSubmit={saveDistrict}>
          <div className="form-check">
            <input
              type="checkbox"
              className="form-check-input"
              id="useDistrictOverride"
              checked={useDistrictOverride}
              onChange={(e) => setUseDistrictOverride(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="useDistrictOverride">
              Set a timeout just for my district
            </label>
          </div>
          <div>
            <label className="form-label small mb-1">Minutes</label>
            <input
              type="number"
              min={1}
              max={480}
              className="form-control form-control-sm"
              style={{ width: 100 }}
              value={districtMinutes}
              disabled={!useDistrictOverride}
              onChange={(e) => setDistrictMinutes(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-outline-primary btn-sm" disabled={saving}>
            {saving ? "Saving…" : "Save district timeout"}
          </button>
        </form>
      )}

      {settings.canSetPlatform && (
        <form className="d-flex flex-wrap align-items-end gap-3" onSubmit={savePlatform}>
          <div>
            <label className="form-label small mb-1">Platform-wide default (minutes)</label>
            <input
              type="number"
              min={1}
              max={480}
              className="form-control form-control-sm"
              style={{ width: 100 }}
              value={platformMinutes}
              onChange={(e) => setPlatformMinutes(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-outline-primary btn-sm" disabled={saving}>
            {saving ? "Saving…" : "Save platform default"}
          </button>
        </form>
      )}
    </div>
  );
}

/**
 * The one feature in this build that a district office - not an
 * individual school - actually gets value from: how many pupils each
 * school has on the books, and how far each has progressed through its
 * current term's assessment workflow. See
 * edulink_gh_phase0n_district_dashboard.sql for why this is a single
 * aggregating RPC rather than row-level district access across every
 * table.
 */
export function CloudDistrictDashboard() {
  const [rows, setRows] = useState<DistrictSchoolOverviewRow[] | null>(null);
  const [standards, setStandards] = useState<DistrictAcademicStandards | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const [pending, setPending] = useState<PendingSchoolRow[] | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveWarning, setApproveWarning] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  function loadPending() {
    CloudDistrictService.getPendingSchools()
      .then(setPending)
      .catch(() => setPending([]));
  }

  useEffect(loadPending, []);

  async function handleApprove(school: PendingSchoolRow) {
    if (!confirm(`Approve ${school.name}? Their head teacher will be texted that the school is live.`)) return;
    setApprovingId(school.id);
    setApproveError(null);
    setApproveWarning(null);
    setApproveSuccess(null);
    try {
      const result = await CloudDistrictService.approveSchool(school.id);
      if (result.warning) {
        setApproveWarning(result.warning);
      } else {
        setApproveSuccess(`${school.name} approved. Their head teacher has been texted with sign-in instructions.`);
      }
      loadPending();
    } catch (err) {
      setApproveError(err instanceof Error ? err.message : "Could not approve this school.");
    } finally {
      setApprovingId(null);
      window.setTimeout(() => setApproveSuccess(null), 6000);
    }
  }

  useEffect(() => {
    let cancelled = false;
    CloudDistrictService.getSchoolsOverview()
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the district overview."));
    CloudAcademicStandardsService.getForDistrict()
      .then((data) => !cancelled && setStandards(data))
      .catch(() => {
        /* academic standards are a bonus panel - a load failure here
           shouldn't block the rest of the dashboard from rendering */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.school_name.toLowerCase().includes(q) ||
        (r.school_code ?? "").toLowerCase().includes(q) ||
        (r.circuit ?? "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(
    () =>
      (rows ?? []).reduce(
        (acc, r) => ({
          schools: acc.schools + 1,
          students: acc.students + r.active_student_count,
          finalized: acc.finalized + r.assessment_finalized_count,
          notStarted: acc.notStarted + r.assessment_draft_count,
        }),
        { schools: 0, students: 0, finalized: 0, notStarted: 0 }
      ),
    [rows]
  );

  function handleExport() {
    downloadCsv(
      "district-overview.csv",
      [
        "School",
        "Code",
        "Circuit",
        "Region",
        "Active students",
        "Current term",
        "Draft",
        "Completed",
        "Verified",
        "Finalized",
      ],
      filtered.map((r) => [
        r.school_name,
        r.school_code ?? "",
        r.circuit ?? "",
        r.region ?? "",
        r.active_student_count,
        r.current_term_name ?? "No active term set",
        r.assessment_draft_count,
        r.assessment_completed_count,
        r.assessment_verified_count,
        r.assessment_finalized_count,
      ])
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-1 gap-3 flex-wrap">
        <h1 className="h4 mb-0">District overview</h1>
        <button
          type="button"
          className="btn btn-outline-secondary text-nowrap"
          disabled={!rows || filtered.length === 0}
          onClick={handleExport}
        >
          <i className="bi bi-download me-1" />
          Export CSV
        </button>
      </div>
      <p className="text-muted mb-4">Enrollment and assessment progress across every school in your district.</p>

      {error && <div className="alert alert-danger">{error}</div>}

      {rows === null && !error ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <SessionTimeoutPanel />

          {((pending && pending.length > 0) || approveSuccess || approveError || approveWarning) && (
            <div className="actrs-card p-0 mb-4">
              <div className="p-3 border-bottom">
                <h2 className="h6 fw-bold mb-0">
                  Pending school signups ({pending?.length ?? 0})
                </h2>
              </div>
              {approveSuccess && <div className="alert alert-success py-2 m-3">{approveSuccess}</div>}
              {approveError && <div className="alert alert-danger py-2 m-3">{approveError}</div>}
              {approveWarning && <div className="alert alert-warning py-2 m-3">{approveWarning}</div>}
              <table className="table mb-0 align-middle">
                <tbody>
                  {(pending ?? []).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="fw-semibold">{s.name}</div>
                        <div className="text-muted small">
                          {s.circuit ?? "No circuit"} · {s.region ?? "No region"}
                        </div>
                      </td>
                      <td className="text-muted small">
                        {s.requested_by_name ?? "Unknown"}
                        <br />
                        {s.requested_by_phone ?? "—"}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={approvingId === s.id}
                          onClick={() => handleApprove(s)}
                        >
                          {approvingId === s.id ? "Approving…" : "Approve"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="row g-3 mb-4">
            <SummaryCard label="Schools" value={totals.schools} />
            <SummaryCard label="Active students" value={totals.students} />
            <SummaryCard label="Finalized assessments" value={totals.finalized} />
            <SummaryCard label="Not yet started" value={totals.notStarted} />
          </div>

          {standards && (
            <>
              <AcademicStandardsPanel subjectLevelStats={standards.districtGrid} kgSkillStats={standards.kgSkillStats} />
              <SchoolBreakdownPanel schools={standards.schoolBreakdown} />
            </>
          )}

          <div className="mb-3" style={{ maxWidth: 320 }}>
            <input
              className="form-control"
              placeholder="Search by school, code, or circuit…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="actrs-card p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Circuit</th>
                    <th className="text-end">Active students</th>
                    <th>Current term</th>
                    <th className="text-end">Draft</th>
                    <th className="text-end">Completed</th>
                    <th className="text-end">Verified</th>
                    <th className="text-end">Finalized</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center text-muted py-4">
                        {rows && rows.length === 0 ? "No schools in your district yet." : "No schools match your search."}
                      </td>
                    </tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.school_id}>
                      <td>
                        <div className="fw-semibold">{r.school_name}</div>
                        <div className="text-muted small">{r.school_code ?? "No code set"}</div>
                      </td>
                      <td>{r.circuit ?? "—"}</td>
                      <td className="text-end">{r.active_student_count}</td>
                      <td>{r.current_term_name ?? <span className="text-muted">No active term</span>}</td>
                      <td className="text-end">{r.assessment_draft_count}</td>
                      <td className="text-end">{r.assessment_completed_count}</td>
                      <td className="text-end">{r.assessment_verified_count}</td>
                      <td className="text-end">
                        <span className="badge text-bg-success">{r.assessment_finalized_count}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
