import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudAcademicStandardsService } from "@services/cloud/AcademicStandardsService";
import { AcademicStandardsPanel } from "@components/AcademicStandardsPanel";
import type { SchoolRow, StudentRow, SchoolAcademicStandards } from "@/types/database";

/**
 * First real cloud page: proves the whole stack end to end - Supabase
 * Auth session -> RLS-scoped REST reads -> rendered UI. Deliberately
 * minimal (school card + student count) rather than trying to land
 * every dashboard widget from the roadmap in one go; assessments,
 * report generation and the district rollup views are the natural next
 * additions on top of this same shell.
 */
export function CloudDashboard() {
  const { profile } = useCloudAuth();
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [standards, setStandards] = useState<SchoolAcademicStandards | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([CloudSchoolService.getProfile(), CloudStudentService.list()])
      .then(([schoolRow, studentRows]) => {
        if (cancelled) return;
        setSchool(schoolRow);
        setStudents(studentRows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load dashboard data.");
      });
    if (profile?.role !== "district_admin") {
      CloudAcademicStandardsService.getForSchool()
        .then((data) => !cancelled && setStandards(data))
        .catch(() => {
          /* academic standards are a bonus panel - a load failure here
             shouldn't block the rest of the dashboard from rendering */
        });
    }
    return () => {
      cancelled = true;
    };
  }, [profile?.role]);

  const activeCount = students?.filter((s) => s.status === "ACTIVE").length ?? null;

  return (
    <div>
      <h1 className="h4 mb-1">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}</h1>
      <p className="text-muted mb-4">Here's what's on file for your school right now.</p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-4">
          <div className="actrs-card p-3 h-100">
            <div className="text-muted small mb-1">School</div>
            {school ? (
              <>
                <div className="fw-semibold">{school.name}</div>
                <div className="text-muted small">{school.school_code ?? "No school code set yet"}</div>
              </>
            ) : (
              <div className="text-muted small">
                {profile?.role === "district_admin" ? "District-level account (no single school)" : "Loading…"}
              </div>
            )}
          </div>
        </div>
        <div className="col-sm-6 col-lg-4">
          <div className="actrs-card p-3 h-100">
            <div className="text-muted small mb-1">Students on file</div>
            <div className="fw-semibold fs-4">{students ? students.length : "…"}</div>
            {activeCount !== null && <div className="text-muted small">{activeCount} active</div>}
          </div>
        </div>
        <div className="col-sm-6 col-lg-4">
          <div className="actrs-card p-3 h-100">
            <div className="text-muted small mb-1">Signed in as</div>
            <div className="fw-semibold text-capitalize">{profile?.role?.replace("_", " ") ?? "…"}</div>
            <div className="text-muted small">{profile?.phone ?? "No phone on file"}</div>
          </div>
        </div>
      </div>

      {standards && (
        <AcademicStandardsPanel
          subjectLevelStats={standards.subjectLevelStats}
          kgSkillStats={standards.kgSkillStats}
          termName={standards.termName}
        />
      )}

      <div className="actrs-card p-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h2 className="h6 mb-0">Students</h2>
          <Link to="/students" className="btn btn-sm btn-outline-primary">
            View all
          </Link>
        </div>
        <p className="text-muted small mb-0">
          Registration, assessment entry and report generation are the next pieces to land on top of this dashboard.
        </p>
      </div>
    </div>
  );
}
