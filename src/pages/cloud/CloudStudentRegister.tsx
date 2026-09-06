import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudAcademicYearService } from "@services/cloud/AcademicYearService";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudDistrictService } from "@services/cloud/DistrictService";
import { PhotoPickerField } from "@components/PhotoPickerField";
import type { AcademicYearRow, TermRow, LevelRow, ClassRow, DistrictSchoolOverviewRow } from "@/types/database";

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandparent", "Sibling", "Other"];

/**
 * First data-entry screen in the cloud app - registers a student and
 * their initial class placement in one atomic step. For a school_admin
 * or teacher this is always their own school (register_student()); for
 * a district/platform admin, a "choose a school" step comes first, and
 * submission goes through register_student_for_district() instead - see
 * edulink_gh_phase0t_district_registration.sql. Everything downstream
 * (assessment entry, report generation) depends on a student having a
 * current enrollment, so this is the natural starting point for
 * actually exercising the report pipeline with real data.
 *
 * The academic year and term are auto-selected (whichever the target
 * school has marked current/active) rather than asked for - nobody
 * registers a student into anything but "now."
 */
export function CloudStudentRegister() {
  const navigate = useNavigate();
  const { profile } = useCloudAuth();
  const isDistrictLevel = profile?.role === "district_admin" || profile?.role === "platform_admin";

  const [academicYear, setAcademicYear] = useState<AcademicYearRow | null>(null);
  const [term, setTerm] = useState<TermRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [allClasses, setAllClasses] = useState<ClassRow[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

  const [districtSchools, setDistrictSchools] = useState<DistrictSchoolOverviewRow[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [districtClasses, setDistrictClasses] = useState<ClassRow[]>([]);
  const [loadingSchoolSetup, setLoadingSchoolSetup] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<"M" | "F">("F");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [levelId, setLevelId] = useState("");
  const [classId, setClassId] = useState("");
  const [guardianFullName, setGuardianFullName] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState(RELATIONSHIPS[0]);
  const [guardianPhone, setGuardianPhone] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{ studentId: string; fullName: string; photoWarning: string | null } | null>(
    null
  );

  // Own-school setup (school_admin/teacher), or the district/platform
  // admin's list of schools to choose from - never both.
  useEffect(() => {
    let cancelled = false;
    if (isDistrictLevel) {
      CloudDistrictService.getSchoolsOverview()
        .then((rows) => !cancelled && setDistrictSchools(rows))
        .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load schools."))
        .finally(() => !cancelled && setLoadingContext(false));
    } else {
      Promise.all([
        CloudAcademicYearService.getCurrent(),
        CloudTermService.getActive(),
        CloudLevelService.list(),
        CloudClassService.list(),
      ])
        .then(([year, activeTerm, levelRows, classRows]) => {
          if (cancelled) return;
          setAcademicYear(year);
          setTerm(activeTerm);
          setLevels(levelRows);
          setAllClasses(classRows);
        })
        .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load setup data."))
        .finally(() => !cancelled && setLoadingContext(false));
    }
    return () => {
      cancelled = true;
    };
  }, [isDistrictLevel]);

  // Once a district/platform admin picks a school, pull ITS levels,
  // classes, current academic year and active term in one call - the
  // ordinary per-service reads only ever see the caller's own school.
  useEffect(() => {
    if (!isDistrictLevel || !selectedSchoolId) return;
    let cancelled = false;
    setLoadingSchoolSetup(true);
    setContextError(null);
    CloudDistrictService.getSchoolRegistrationContext(selectedSchoolId)
      .then((ctx) => {
        if (cancelled) return;
        setLevels(ctx.levels);
        setDistrictClasses(ctx.classes);
        setAcademicYear(ctx.academicYears.find((y) => y.is_current) ?? ctx.academicYears[0] ?? null);
        setTerm(ctx.terms.find((t) => t.is_active) ?? ctx.terms[0] ?? null);
        setLevelId("");
        setClassId("");
      })
      .catch((err) => !cancelled && setContextError(err instanceof Error ? err.message : "Could not load that school's setup."))
      .finally(() => !cancelled && setLoadingSchoolSetup(false));
    return () => {
      cancelled = true;
    };
  }, [isDistrictLevel, selectedSchoolId]);

  useEffect(() => {
    if (!levelId) {
      setClasses([]);
      setClassId("");
      return;
    }
    if (isDistrictLevel) {
      const scoped = districtClasses.filter((c) => c.level_id === levelId);
      setClasses(scoped);
      setClassId((current) => (scoped.some((c) => c.id === current) ? current : ""));
      return;
    }
    let cancelled = false;
    CloudClassService.list(levelId).then((rows) => {
      if (cancelled) return;
      const scoped = CloudClassService.forRole(rows, profile);
      setClasses(scoped);
      setClassId((current) => (scoped.some((c) => c.id === current) ? current : ""));
    });
    return () => {
      cancelled = true;
    };
  }, [levelId, isDistrictLevel, districtClasses]);

  const isTeacher = profile?.role === "teacher";
  const teacherClasses = useMemo(
    () => CloudClassService.forRole(allClasses, profile),
    [allClasses, profile]
  );

  // A teacher (almost always assigned to exactly one class) skips the
  // level-then-class cascade entirely - it picks itself. See phase0l's
  // teacher-scoped RLS: this UI narrowing matches what the server would
  // reject anyway, so there's no point offering a choice that can't
  // actually be submitted.
  useEffect(() => {
    if (!isTeacher || teacherClasses.length !== 1) return;
    const only = teacherClasses[0];
    setLevelId((current) => current || only.level_id);
    setClassId((current) => current || only.id);
  }, [isTeacher, teacherClasses]);

  const readyToSubmit = useMemo(
    () =>
      (!isDistrictLevel || !!selectedSchoolId) &&
      !!academicYear &&
      !!term &&
      !!classId &&
      !!levelId &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      dateOfBirth.length > 0 &&
      guardianFullName.trim().length > 0 &&
      guardianPhone.trim().length > 0,
    [isDistrictLevel, selectedSchoolId, academicYear, term, classId, levelId, firstName, lastName, dateOfBirth, guardianFullName, guardianPhone]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const schoolId = isDistrictLevel ? selectedSchoolId : profile?.school_id;
    if (!schoolId || !academicYear || !term) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        schoolId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        dateOfBirth,
        academicYearId: academicYear.id,
        termId: term.id,
        levelId,
        classId,
        guardianFullName: guardianFullName.trim(),
        guardianRelationship,
        guardianPhone: guardianPhone.trim(),
      };
      const student = isDistrictLevel
        ? await CloudStudentService.registerForDistrict(payload)
        : await CloudStudentService.register(payload);

      // The photo is saved as a second step (register_student() doesn't
      // take one) rather than blocking registration itself on it - a
      // school record with no photo yet is fine; one that silently
      // failed to register because of a photo problem would not be.
      let photoWarning: string | null = null;
      if (photoDataUrl) {
        try {
          await CloudStudentService.updateStudent(student.id, { photo_url: photoDataUrl });
        } catch (photoErr) {
          photoWarning =
            "The student was registered, but the photo couldn't be saved: " +
            (photoErr instanceof Error ? photoErr.message : "unknown error") +
            ". You can try adding it again from the student's profile.";
        }
      }

      setRegistered({
        studentId: student.student_id,
        fullName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
        photoWarning,
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not register this student.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setGender("F");
    setDateOfBirth("");
    setLevelId("");
    setClassId("");
    setGuardianFullName("");
    setGuardianRelationship(RELATIONSHIPS[0]);
    setGuardianPhone("");
    setPhotoDataUrl(null);
    setRegistered(null);
  }

  if (loadingContext) {
    return <p className="text-muted">Loading…</p>;
  }

  if (contextError) {
    return (
      <div className="alert alert-danger" role="alert">
        {contextError}
      </div>
    );
  }

  const selectedSchool = districtSchools.find((s) => s.school_id === selectedSchoolId);

  if (isDistrictLevel && !selectedSchoolId) {
    return (
      <div>
        <h1 className="h4 mb-1">Register a student</h1>
        <p className="text-muted mb-4">Choose which school in your district this pupil is being admitted to.</p>
        <div className="actrs-card p-4" style={{ maxWidth: 520 }}>
          <label className="form-label small">School</label>
          <select className="form-select" value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)}>
            <option value="">Select a school…</option>
            {districtSchools.map((s) => (
              <option key={s.school_id} value={s.school_id}>
                {s.school_name}
              </option>
            ))}
          </select>
          {districtSchools.length === 0 && (
            <p className="text-muted small mb-0 mt-2">No schools found in your district yet.</p>
          )}
        </div>
      </div>
    );
  }

  if (isDistrictLevel && loadingSchoolSetup) {
    return <p className="text-muted">Loading {selectedSchool?.school_name ?? "school"}'s setup…</p>;
  }

  if (!academicYear || !term) {
    return (
      <div className="alert alert-warning" role="alert">
        {isDistrictLevel ? selectedSchool?.school_name ?? "This school" : "Your school"} doesn't have a current
        academic year and active term set up yet, so students can't be registered there until that's configured.
        {isDistrictLevel && (
          <div className="mt-2">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedSchoolId("")}>
              Choose a different school
            </button>
          </div>
        )}
      </div>
    );
  }

  if (registered) {
    return (
      <div className="actrs-card p-4" style={{ maxWidth: 520 }}>
        <div className="d-flex align-items-center gap-2 mb-2 text-success">
          <i className="bi bi-check-circle-fill fs-4" />
          <h1 className="h5 mb-0">Student registered</h1>
        </div>
        <p className="mb-1">
          <strong>{registered.fullName}</strong> has been registered.
        </p>
        <p className="text-muted small mb-3">Student ID: {registered.studentId}</p>
        {registered.photoWarning && <div className="alert alert-warning small py-2 mb-3">{registered.photoWarning}</div>}
        <div className="d-flex gap-2">
          <button className="btn btn-primary" onClick={resetForm}>
            Register another
          </button>
          <button className="btn btn-outline-secondary" onClick={() => navigate("/students")}>
            View students
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="h4 mb-1">Register a student</h1>
      <p className="text-muted mb-4">
        {isDistrictLevel && (
          <>
            <strong>{selectedSchool?.school_name}</strong> ·{" "}
            <button
              type="button"
              className="btn btn-link btn-sm p-0 align-baseline"
              onClick={() => setSelectedSchoolId("")}
            >
              change school
            </button>{" "}
            ·{" "}
          </>
        )}
        {academicYear.label} &middot; {term.term_name}
      </p>

      {submitError && (
        <div className="alert alert-danger" role="alert">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="actrs-card p-4" style={{ maxWidth: 720 }}>
        <h2 className="h6 mb-3">Student photo (optional)</h2>
        <div className="mb-4">
          <PhotoPickerField value={photoDataUrl} onChange={setPhotoDataUrl} />
        </div>

        <h2 className="h6 mb-3">Student details</h2>
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <label className="form-label small">First name</label>
            <input className="form-control" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Middle name</label>
            <input className="form-control" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Last name</label>
            <input className="form-control" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Gender</label>
            <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value as "M" | "F")}>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small">Date of birth</label>
            <input
              type="date"
              className="form-control"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              required
            />
          </div>
        </div>

        <h2 className="h6 mb-3">Class placement</h2>
        <div className="row g-3 mb-4">
          {isTeacher ? (
            teacherClasses.length === 0 ? (
              <div className="col-12">
                <div className="alert alert-warning py-2 mb-0">
                  You haven't been assigned to a class yet - ask your school admin to assign you one under
                  Settings → Classes before registering students.
                </div>
              </div>
            ) : teacherClasses.length === 1 ? (
              <div className="col-md-6">
                <label className="form-label small">Class</label>
                <input className="form-control" value={teacherClasses[0].name} disabled readOnly />
              </div>
            ) : (
              <div className="col-md-6">
                <label className="form-label small">Class</label>
                <select
                  className="form-select"
                  value={classId}
                  onChange={(e) => {
                    const picked = teacherClasses.find((c) => c.id === e.target.value);
                    setClassId(picked?.id ?? "");
                    setLevelId(picked?.level_id ?? "");
                  }}
                  required
                >
                  <option value="">Select a class…</option>
                  {teacherClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : (
            <>
              <div className="col-md-6">
                <label className="form-label small">Level</label>
                <select className="form-select" value={levelId} onChange={(e) => setLevelId(e.target.value)} required>
                  <option value="">Select a level…</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small">Class</label>
                <select
                  className="form-select"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={!levelId}
                  required
                >
                  <option value="">{levelId ? "Select a class…" : "Choose a level first"}</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <h2 className="h6 mb-3">Parent / guardian</h2>
        <div className="row g-3 mb-4">
          <div className="col-md-5">
            <label className="form-label small">Full name</label>
            <input
              className="form-control"
              value={guardianFullName}
              onChange={(e) => setGuardianFullName(e.target.value)}
              required
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small">Relationship</label>
            <select
              className="form-select"
              value={guardianRelationship}
              onChange={(e) => setGuardianRelationship(e.target.value)}
            >
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label small">Phone number</label>
            <input
              type="tel"
              className="form-control"
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="e.g. 024 000 0000"
              required
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={!readyToSubmit || submitting}>
          {submitting ? "Registering…" : "Register student"}
        </button>
      </form>
    </div>
  );
}
