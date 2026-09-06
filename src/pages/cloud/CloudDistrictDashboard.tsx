import { useEffect, useMemo, useState } from "react";
import { CloudDistrictService } from "@services/cloud/DistrictService";
import { CloudAcademicStandardsService } from "@services/cloud/AcademicStandardsService";
import { AcademicStandardsPanel, SchoolBreakdownPanel } from "@components/AcademicStandardsPanel";
import { downloadCsv } from "@/lib/csvExport";
import type { DistrictSchoolOverviewRow, DistrictAcademicStandards } from "@/types/database";

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
