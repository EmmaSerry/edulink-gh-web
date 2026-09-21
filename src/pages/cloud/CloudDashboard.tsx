import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudAcademicStandardsService, type ClassAcademicStandards } from "@services/cloud/AcademicStandardsService";
import { AcademicStandardsPanel } from "@components/AcademicStandardsPanel";
import type { SchoolRow, StudentRow, SchoolAcademicStandards } from "@/types/database";

/** Roles that can legitimately have a single school_id of their own AND
 *  are meant to see that one school's card/standards on this page. A
 *  district_admin/platform_admin is excluded even if their own account
 *  data happens to carry a school_id (it shouldn't - see
 *  edulink_gh_phase1i_dashboard_and_standards_fixes.sql - but this page
 *  no longer trusts that alone; the role itself decides). */
function hasOwnSchoolScope(role: string | undefined): boolean {
  return role === "school_admin" || role === "bursar" || role === "teacher";
}

/**
 * First real cloud page: proves the whole stack end to end - Supabase
 * Auth session -> RLS-scoped REST reads -> rendered UI. Deliberately
 * minimal (school card + student count) rather than trying to land
 * every dashboard widget from the roadmap in one go; assessments,
 * report generation and the district rollup views are the natural next
 * additions on top of this same shell.
 *
 * Academic standards section: a school_admin sees the existing
 * school-wide summary (every level, KG included) - that's correct for
 * them, it's their whole school. A teacher instead sees a summary
 * scoped to just the ONE class they teach (get_class_academic_standards,
 * added in edulink_gh_phase1i_dashboard_and_standards_fixes.sql) -
 * previously this page called the school-wide summary for a teacher
 * too, which is how a JHS teacher with a single pupil ended up looking
 * at primary-wide averages and KG skill ratings that had nothing to do
 * with their class. A bursar sees neither - they don't teach a class,
 * and a school-wide academic view isn't part of their job here.
 */
export function CloudDashboard() {
  const { profile } = useCloudAuth();
  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [standards, setStandards] = useState<SchoolAcademicStandards | null>(null);
  const [classStandards, setClassStandards] = useState<ClassAcademicStandards | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSingleSchoolRole = hasOwnSchoolScope(profile?.role);

  useEffect(() => {
    let cancelled = false;
    // A district_admin/platform_admin has no single school of their own
    // - RLS lets them read EVERY school, so calling getProfile() (a
    // bare "give me a school row" with no filter) for one of them would
    // return an arbitrary row from the whole table, not "their" school.
    // Checked by ROLE here, not just by whether school_id happens to be
    // set - a stray school_id on an admin account (which shouldn't
    // exist, but see the cleanup in edulink_gh_phase1i) must not be
    // enough on its own to trigger this.
    const schoolPromise =
      profile?.school_id && isSingleSchoolRole ? CloudSchoolService.getProfile() : Promise.resolve(null);
    Promise.all([schoolPromise, CloudStudentService.list()])
      .then(([schoolRow, studentRows]) => {
        if (cancelled) return;
        setSchool(schoolRow);
        setStudents(studentRows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load dashboard data.");
      });

    // School-wide standards: only for the role that's actually meant to
    // see a whole school's picture here (school_admin). district_admin/
    // platform_admin get their own dedicated standards views elsewhere
    // (District overview / Super Admin), so this page doesn't duplicate
    // that for them even if they somehow have a school_id.
    if (profile?.role === "school_admin" && profile.school_id) {
      CloudAcademicStandardsService.getForSchool()
        .then((data) => !cancelled && setStandards(data))
        .catch(() => {
          /* academic standards are a bonus panel - a load failure here
             shouldn't block the rest of the dashboard from rendering */
        });
    }

    // Class-scoped standards for a teacher: find the one class they're
    // assigned to (class_teacher_id) and ask only for that class's
    // numbers. A teacher assigned to more than one class sees the first
    // - covering more than one class on this summary card is future
    // work, not something reported as broken.
    if (profile?.role === "teacher" && profile.school_id) {
      CloudClassService.list(undefined, profile.school_id)
        .then((classes) => {
          if (cancelled) return null;
          const ownClasses = CloudClassService.forRole(classes, profile);
          const myClass = ownClasses[0];
          if (!myClass) return null;
          return CloudAcademicStandardsService.getForClass(myClass.id);
        })
        .then((data) => !cancelled && data && setClassStandards(data))
        .catch(() => {
          /* same bonus-panel treatment as the school-wide fetch above */
        });
    }

    return () => {
      cancelled = true;
    };
  }, [profile?.role, profile?.school_id]);

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
                {!isSingleSchoolRole ? "District/platform-level account (no single school)" : "Loading…"}
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

      {classStandards && (
        <AcademicStandardsPanel
          subjectLevelStats={classStandards.subjectLevelStats}
          kgSkillStats={classStandards.kgSkillStats}
          termName={classStandards.termName}
          title="My class — academic standards"
          subtitle={classStandards.className}
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
