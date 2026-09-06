import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudStudentService } from "@services/cloud/StudentService";
import { CloudGuardianService } from "@services/cloud/GuardianService";
import { CloudEnrollmentService } from "@services/cloud/EnrollmentService";
import { CloudClassService } from "@services/cloud/ClassService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudPromotionService } from "@services/cloud/PromotionService";
import { PhotoPickerField } from "@components/PhotoPickerField";
import type {
  StudentRow,
  StudentStatus,
  GuardianRow,
  EnrollmentRow,
  ClassRow,
  LevelRow,
  PromotionHistoryRow,
} from "@/types/database";

const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandparent", "Sibling", "Other"];

const STATUS_LABEL: Record<StudentStatus, string> = {
  ACTIVE: "Active",
  TRANSFERRED_OUT: "Transferred out",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
  DECEASED: "Deceased",
};

type BioForm = {
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  gender: "M" | "F";
  dateOfBirth: string;
  nationality: string;
  admissionNumber: string;
  ghanaCardNumber: string;
  specialEducationalNeeds: string;
  status: StudentStatus;
  statusReason: string;
};

type GuardianForm = {
  fullName: string;
  relationship: string;
  phone: string;
  alternativePhone: string;
  email: string;
  residentialAddress: string;
  smsOptIn: boolean;
};

function toBioForm(s: StudentRow): BioForm {
  return {
    firstName: s.first_name,
    middleName: s.middle_name ?? "",
    lastName: s.last_name,
    preferredName: s.preferred_name ?? "",
    gender: s.gender,
    dateOfBirth: s.date_of_birth,
    nationality: s.nationality ?? "",
    admissionNumber: s.admission_number ?? "",
    ghanaCardNumber: s.ghana_card_number ?? "",
    specialEducationalNeeds: s.special_educational_needs ?? "",
    status: s.status,
    statusReason: s.status_reason ?? "",
  };
}

function toGuardianForm(g: GuardianRow | null): GuardianForm {
  return {
    fullName: g?.full_name ?? "",
    relationship: g?.relationship ?? RELATIONSHIPS[0],
    phone: g?.phone ?? "",
    alternativePhone: g?.alternative_phone ?? "",
    email: g?.email ?? "",
    residentialAddress: g?.residential_address ?? "",
    smsOptIn: g?.sms_opt_in ?? true,
  };
}

/**
 * Edit an existing student's bio-data, photo, guardian contact, and
 * status (the "archive a student" control - status away from ACTIVE is
 * a soft-delete, same as the offline app), plus - since
 * edulink_gh_phase0r_promotion.sql - a "Class placement" card for
 * moving this one pupil to a different class right now. Bulk-promoting
 * a whole class at year end is its own screen (CloudPromoteClass),
 * reached from Settings -> Classes; this one always acts on the
 * CURRENT term/academic year (a correction, not a new enrollment
 * period), and saves immediately rather than waiting for the big form's
 * "Save changes" button below, since it's a structurally different kind
 * of write (bulk_promote_class(), not a plain student/guardian PATCH).
 */
export function CloudStudentEdit() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useCloudAuth();

  const [student, setStudent] = useState<StudentRow | null>(null);
  const [bio, setBio] = useState<BioForm | null>(null);
  const [guardian, setGuardian] = useState<GuardianForm | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [enrollment, setEnrollment] = useState<EnrollmentRow | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [history, setHistory] = useState<PromotionHistoryRow[]>([]);
  const [moveLevelId, setMoveLevelId] = useState("");
  const [moveClassId, setMoveClassId] = useState("");
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [moveSaved, setMoveSaved] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    Promise.all([
      CloudStudentService.getById(id),
      CloudGuardianService.getByStudentId(id),
      CloudEnrollmentService.getCurrentEnrollment(id),
      CloudClassService.list(),
      CloudLevelService.list(),
      CloudPromotionService.getHistoryForStudent(id),
    ])
      .then(([s, g, enr, classRows, levelRows, historyRows]) => {
        if (cancelled || !s) return;
        setStudent(s);
        setBio(toBioForm(s));
        setGuardian(toGuardianForm(g));
        setPhotoDataUrl(s.photo_url);
        setEnrollment(enr);
        setClasses(classRows);
        setLevels(levelRows);
        setHistory(historyRows);
        if (enr) setMoveLevelId(enr.level_id);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Could not load this student."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);
  const levelById = useMemo(() => new Map(levels.map((l) => [l.id, l])), [levels]);
  const classesForMoveLevel = useMemo(
    () => classes.filter((c) => c.level_id === moveLevelId),
    [classes, moveLevelId]
  );

  async function handleMoveClass() {
    if (!id || !enrollment || !moveClassId) return;
    setMoving(true);
    setMoveError(null);
    setMoveSaved(false);
    try {
      const [result] = await CloudPromotionService.bulkPromote({
        fromClassId: enrollment.class_id,
        studentIds: [id],
        outcome: "TRANSFERRED",
        toClassId: moveClassId,
        toAcademicYearId: enrollment.academic_year_id,
        toTermId: enrollment.term_id,
      });
      if (!result.ok) throw new Error(result.message ?? "Could not move this pupil.");
      const [newEnrollment, newHistory] = await Promise.all([
        CloudEnrollmentService.getCurrentEnrollment(id),
        CloudPromotionService.getHistoryForStudent(id),
      ]);
      setEnrollment(newEnrollment);
      setHistory(newHistory);
      setMoveClassId("");
      setMoveSaved(true);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Could not move this pupil.");
    } finally {
      setMoving(false);
    }
  }

  function setBioField<K extends keyof BioForm>(key: K, value: BioForm[K]) {
    setBio((f) => f && { ...f, [key]: value });
  }
  function setGuardianField<K extends keyof GuardianForm>(key: K, value: GuardianForm[K]) {
    setGuardian((f) => f && { ...f, [key]: value });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || !bio || !guardian || !profile?.school_id) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await CloudStudentService.updateStudent(id, {
        first_name: bio.firstName.trim(),
        middle_name: bio.middleName.trim() || null,
        last_name: bio.lastName.trim(),
        preferred_name: bio.preferredName.trim() || null,
        gender: bio.gender,
        date_of_birth: bio.dateOfBirth,
        nationality: bio.nationality.trim() || null,
        admission_number: bio.admissionNumber.trim() || null,
        ghana_card_number: bio.ghanaCardNumber.trim() || null,
        special_educational_needs: bio.specialEducationalNeeds.trim() || null,
        photo_url: photoDataUrl,
      });
      await CloudStudentService.updateStatus(id, bio.status, bio.statusReason.trim() || undefined);
      await CloudGuardianService.upsertForStudent(id, profile.school_id, {
        full_name: guardian.fullName.trim(),
        relationship: guardian.relationship,
        phone: guardian.phone.trim(),
        alternative_phone: guardian.alternativePhone.trim() || null,
        email: guardian.email.trim() || null,
        residential_address: guardian.residentialAddress.trim() || null,
        sms_opt_in: guardian.smsOptIn,
      });
      setSaved(true);
      const refreshed = await CloudStudentService.getById(id);
      if (refreshed) {
        setStudent(refreshed);
        setBio(toBioForm(refreshed));
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>;
  if (loadError) return <div className="alert alert-danger">{loadError}</div>;
  if (!student || !bio || !guardian) return <div className="alert alert-warning">Student not found.</div>;

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-1">
        <h1 className="h4 mb-0">Edit student</h1>
        <Link to="/students" className="btn btn-outline-secondary btn-sm">
          Back to Students
        </Link>
      </div>
      <p className="text-muted mb-4">{student.student_id}</p>

      <form onSubmit={handleSubmit}>
        {saveError && <div className="alert alert-danger py-2">{saveError}</div>}
        {saved && (
          <div className="alert alert-success py-2" role="status">
            Changes saved.
          </div>
        )}

        <div className="actrs-card p-4 mb-3">
          <h2 className="h6 fw-bold mb-3">Photo</h2>
          <PhotoPickerField value={photoDataUrl} onChange={setPhotoDataUrl} />
        </div>

        <div className="actrs-card p-4 mb-3">
          <h2 className="h6 fw-bold mb-3">Bio-data</h2>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small">First name</label>
              <input
                className="form-control"
                value={bio.firstName}
                onChange={(e) => setBioField("firstName", e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Middle name</label>
              <input
                className="form-control"
                value={bio.middleName}
                onChange={(e) => setBioField("middleName", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Last name</label>
              <input
                className="form-control"
                value={bio.lastName}
                onChange={(e) => setBioField("lastName", e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Preferred name</label>
              <input
                className="form-control"
                value={bio.preferredName}
                onChange={(e) => setBioField("preferredName", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Gender</label>
              <select
                className="form-select"
                value={bio.gender}
                onChange={(e) => setBioField("gender", e.target.value as "M" | "F")}
              >
                <option value="F">Female</option>
                <option value="M">Male</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Date of birth</label>
              <input
                type="date"
                className="form-control"
                value={bio.dateOfBirth}
                onChange={(e) => setBioField("dateOfBirth", e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Nationality</label>
              <input
                className="form-control"
                value={bio.nationality}
                onChange={(e) => setBioField("nationality", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Admission number</label>
              <input
                className="form-control"
                value={bio.admissionNumber}
                onChange={(e) => setBioField("admissionNumber", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Ghana Card number</label>
              <input
                className="form-control"
                value={bio.ghanaCardNumber}
                onChange={(e) => setBioField("ghanaCardNumber", e.target.value)}
              />
            </div>
            <div className="col-12">
              <label className="form-label small">Special educational needs (if any)</label>
              <textarea
                className="form-control"
                rows={2}
                value={bio.specialEducationalNeeds}
                onChange={(e) => setBioField("specialEducationalNeeds", e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="actrs-card p-4 mb-3">
          <h2 className="h6 fw-bold mb-3">Class placement</h2>
          {enrollment ? (
            <>
              <p className="mb-3">
                Currently in <strong>{classById.get(enrollment.class_id)?.name ?? "an unknown class"}</strong> (
                {levelById.get(enrollment.level_id)?.name ?? "unknown level"}).
              </p>
              {moveError && <div className="alert alert-danger py-2">{moveError}</div>}
              {moveSaved && (
                <div className="alert alert-success py-2" role="status">
                  Moved to the new class.
                </div>
              )}
              <div className="row g-3 align-items-end">
                <div className="col-md-4">
                  <label className="form-label small">Move to level</label>
                  <select
                    className="form-select"
                    value={moveLevelId}
                    onChange={(e) => {
                      setMoveLevelId(e.target.value);
                      setMoveClassId("");
                    }}
                  >
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small">Move to class</label>
                  <select
                    className="form-select"
                    value={moveClassId}
                    onChange={(e) => setMoveClassId(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {classesForMoveLevel.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.id === enrollment.class_id}>
                        {c.name}
                        {c.id === enrollment.class_id ? " (current)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4">
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    disabled={!moveClassId || moving}
                    onClick={handleMoveClass}
                  >
                    {moving ? "Moving…" : "Move class"}
                  </button>
                </div>
              </div>
              <p className="text-muted small mb-0 mt-2">
                This corrects placement for the current term right away. To promote a whole class to a new
                academic year, use Settings → Classes → Promote instead.
              </p>
            </>
          ) : (
            <p className="text-muted small mb-0">
              This pupil has no current class placement (they may already be inactive).
            </p>
          )}
          {history.length > 0 && (
            <div className="mt-3 pt-3 border-top">
              <h3 className="h6 small fw-bold text-muted mb-2">Promotion history</h3>
              <ul className="list-unstyled small mb-0">
                {history.map((h) => (
                  <li key={h.id} className="mb-1">
                    {new Date(h.decided_at).toLocaleDateString()} —{" "}
                    {classById.get(h.from_class_id ?? "")?.name ?? "—"} →{" "}
                    {classById.get(h.to_class_id ?? "")?.name ?? "—"} ({h.outcome.toLowerCase()})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="actrs-card p-4 mb-3">
          <h2 className="h6 fw-bold mb-3">Status</h2>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small">Status</label>
              <select
                className="form-select"
                value={bio.status}
                onChange={(e) => setBioField("status", e.target.value as StudentStatus)}
              >
                {(Object.keys(STATUS_LABEL) as StudentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            {bio.status !== "ACTIVE" && (
              <div className="col-md-8">
                <label className="form-label small">Reason / note</label>
                <input
                  className="form-control"
                  placeholder="e.g. Transferred to St. Mary's, Kumasi"
                  value={bio.statusReason}
                  onChange={(e) => setBioField("statusReason", e.target.value)}
                />
              </div>
            )}
          </div>
          {bio.status !== "ACTIVE" && (
            <p className="text-muted small mb-0 mt-2">
              Setting a status other than Active removes this student from active class lists and assessment entry,
              without deleting their record - their history stays intact and this can be reversed at any time.
            </p>
          )}
        </div>

        <div className="actrs-card p-4 mb-4">
          <h2 className="h6 fw-bold mb-3">Guardian</h2>
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label small">Full name</label>
              <input
                className="form-control"
                value={guardian.fullName}
                onChange={(e) => setGuardianField("fullName", e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Relationship</label>
              <select
                className="form-select"
                value={guardian.relationship}
                onChange={(e) => setGuardianField("relationship", e.target.value)}
              >
                {RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small">Phone</label>
              <input
                className="form-control"
                value={guardian.phone}
                onChange={(e) => setGuardianField("phone", e.target.value)}
                required
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Alternative phone</label>
              <input
                className="form-control"
                value={guardian.alternativePhone}
                onChange={(e) => setGuardianField("alternativePhone", e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <label className="form-label small">Email</label>
              <input
                type="email"
                className="form-control"
                value={guardian.email}
                onChange={(e) => setGuardianField("email", e.target.value)}
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <div className="form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="smsOptIn"
                  checked={guardian.smsOptIn}
                  onChange={(e) => setGuardianField("smsOptIn", e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="smsOptIn">
                  Receives SMS notifications
                </label>
              </div>
            </div>
            <div className="col-12">
              <label className="form-label small">Residential address</label>
              <input
                className="form-control"
                value={guardian.residentialAddress}
                onChange={(e) => setGuardianField("residentialAddress", e.target.value)}
              />
            </div>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}
