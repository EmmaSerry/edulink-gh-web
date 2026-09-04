import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudAcademicYearService } from "@services/cloud/AcademicYearService";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudStudentService } from "@services/cloud/StudentService";
import type { AcademicYearRow, TermRow, LevelRow, ClassRow } from "@/types/database";

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandparent", "Sibling", "Other"];

/**
 * First data-entry screen in the cloud app - registers a student and
 * their initial class placement in one atomic step via
 * CloudStudentService.register() (register_student() RPC). Everything
 * downstream (assessment entry, report generation) depends on a student
 * having a current enrollment, so this is the natural starting point
 * for actually exercising the report pipeline with real data.
 *
 * The academic year and term are auto-selected (whichever the school
 * has marked current/active) rather than asked for - a school only
 * ever registers students into "now," and Settings screens to change
 * which year/term is current are future work, not this form's job.
 */
export function CloudStudentRegister() {
  const navigate = useNavigate();
  const { profile } = useCloudAuth();

  const [academicYear, setAcademicYear] = useState<AcademicYearRow | null>(null);
  const [term, setTerm] = useState<TermRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);
  const [contextError, setContextError] = useState<string | null>(null);

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

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<{ studentId: string; fullName: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([CloudAcademicYearService.getCurrent(), CloudTermService.getActive(), CloudLevelService.list()])
      .then(([year, activeTerm, levelRows]) => {
        if (cancelled) return;
        setAcademicYear(year);
        setTerm(activeTerm);
        setLevels(levelRows);
      })
      .catch((err) => {
        if (!cancelled) setContextError(err instanceof Error ? err.message : "Could not load setup data.");
      })
      .finally(() => !cancelled && setLoadingContext(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!levelId) {
      setClasses([]);
      setClassId("");
      return;
    }
    let cancelled = false;
    CloudClassService.list(levelId).then((rows) => {
      if (cancelled) return;
      setClasses(rows);
      setClassId((current) => (rows.some((c) => c.id === current) ? current : ""));
    });
    return () => {
      cancelled = true;
    };
  }, [levelId]);

  const readyToSubmit = useMemo(
    () =>
      !!academicYear &&
      !!term &&
      !!classId &&
      !!levelId &&
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      dateOfBirth.length > 0 &&
      guardianFullName.trim().length > 0 &&
      guardianPhone.trim().length > 0,
    [academicYear, term, classId, levelId, firstName, lastName, dateOfBirth, guardianFullName, guardianPhone]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!profile?.school_id || !academicYear || !term) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const student = await CloudStudentService.register({
        schoolId: profile.school_id,
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
      });
      setRegistered({
        studentId: student.student_id,
        fullName: [student.first_name, student.middle_name, student.last_name].filter(Boolean).join(" "),
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

  if (!academicYear || !term) {
    return (
      <div className="alert alert-warning" role="alert">
        Your school doesn't have a current academic year and active term set up yet, so students can't be registered
        until that's configured. (This will move into a Settings screen - for now, ask your platform admin to set
        one via the database.)
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
        <p className="text-muted small mb-4">Student ID: {registered.studentId}</p>
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
        {academicYear.label} &middot; {term.term_name}
      </p>

      {submitError && (
        <div className="alert alert-danger" role="alert">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="actrs-card p-4" style={{ maxWidth: 720 }}>
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
