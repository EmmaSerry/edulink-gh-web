import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@database/db";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { StudentService } from "@services/StudentService";
import { GuardianService } from "@services/GuardianService";
import { EnrollmentService } from "@services/EnrollmentService";
import { PromotionService } from "@services/PromotionService";
import { PhotoService } from "@services/PhotoService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { AcademicYearService } from "@services/AcademicYearService";
import { TermService } from "@services/TermService";
import { SubjectService } from "@services/SubjectService";
import { SkillService } from "@services/SkillService";
import { getFullName, calculateAge } from "@models/Student";
import { formatDateForDisplay } from "@utils/dateUtils";
import { StudentStatusBadge } from "./students/StudentStatusBadge";
import { ClassAssignmentModal } from "./students/ClassAssignmentModal";
import { PromotionModal } from "./students/PromotionModal";
import { StatusChangeModal } from "./students/StatusChangeModal";

type Tab = "academic" | "parent" | "enrollment" | "promotion" | "assessment" | "reports" | "attendance" | "audit";

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: "academic", label: "Academic Details", icon: "bi-mortarboard" },
  { key: "parent", label: "Parent Information", icon: "bi-person-heart" },
  { key: "enrollment", label: "Enrollment History", icon: "bi-clock-history" },
  { key: "promotion", label: "Promotion History", icon: "bi-arrow-up-right-circle" },
  { key: "assessment", label: "Assessment History", icon: "bi-clipboard-data" },
  { key: "reports", label: "Report Card History", icon: "bi-file-earmark-text" },
  { key: "attendance", label: "Attendance Summary", icon: "bi-calendar-check" },
  { key: "audit", label: "Audit Information", icon: "bi-shield-check" },
];

export function StudentProfile() {
  const { id } = useParams();
  const studentId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [tab, setTab] = useState<Tab>("academic");
  const [deleting, setDeleting] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const student = useLiveQuery(() => StudentService.getById(studentId), [studentId]);
  const guardian = useLiveQuery(() => GuardianService.getByStudentId(studentId), [studentId]);
  const currentEnrollment = useLiveQuery(() => EnrollmentService.getCurrentEnrollment(studentId), [studentId]);
  const enrollmentHistory = useLiveQuery(() => EnrollmentService.getHistoryForStudent(studentId), [studentId]);
  const promotionHistory = useLiveQuery(() => PromotionService.getHistoryForStudent(studentId), [studentId]);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);
  const years = useLiveQuery(() => AcademicYearService.getAll(), []);
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const subjects = useLiveQuery(() => SubjectService.getAll(), []);
  const skills = useLiveQuery(() => SkillService.getAll(), []);

  // Phase 6 (Module 6 - UI consistency review): the Assessment History and
  // Report Card History tabs previously showed a permanent "coming in a
  // future phase" placeholder even though Assessment Management (Phase 3)
  // and Report Generation (Phase 4) have both been live for phases. These
  // three queries surface the real historical data that already exists in
  // Dexie for this student, across every term.
  const scoreHistory = useLiveQuery(
    () => db.scoreRecords.where("studentId").equals(studentId).toArray(),
    [studentId],
  );
  const skillHistory = useLiveQuery(
    () => db.skillAssessmentRecords.where("studentId").equals(studentId).toArray(),
    [studentId],
  );
  const reportHistory = useLiveQuery(
    () => db.generatedReports.where("studentId").equals(studentId).toArray(),
    [studentId],
  );

  const levelName = (levelId?: number) => levels?.find((l) => l.id === levelId)?.name ?? "—";
  const className = (classId?: number) => classes?.find((c) => c.id === classId)?.name ?? "—";
  const yearLabel = (yearId?: number) => years?.find((y) => y.id === yearId)?.label ?? "—";
  const termName = (termId?: number) => terms?.find((t) => t.id === termId)?.termName ?? "—";
  const subjectName = (subjectId: number) => subjects?.find((s) => s.id === subjectId)?.name ?? `Subject #${subjectId}`;
  const skillName = (skillId: number) => skills?.find((s) => s.id === skillId)?.description ?? `Skill #${skillId}`;
  const ratingLabel = (rating: string | null) =>
    ({ G: "Gold", S: "Silver", B: "Bronze", X: "Not yet assessed", O: "Absent" }[rating ?? ""] ?? "—");

  const onPhotoChange = async (file: File | null) => {
    if (!file || !student?.id) return;
    try {
      await PhotoService.upload(student.id, file);
      showToast("Photo updated.", "success");
    } catch (err) {
      console.error(err);
      // Phase 6 (Module 9): surface the actual validation message (e.g.
      // "not an image" / "too large") instead of a generic string, to
      // match the error-handling convention used by every other page.
      showToast(err instanceof Error ? err.message : "Could not upload photo.", "error");
    }
  };

  const onPhotoRemove = async () => {
    if (!student?.id) return;
    await PhotoService.remove(student.id);
    showToast("Photo removed.", "success");
  };

  const onDeleteStudent = async () => {
    if (!student?.id) return;
    const ok = await confirm({
      title: "Permanently delete this student?",
      message: `This removes ${getFullName(student)} and every record linked to them (guardian, enrollment history, scores, skill ratings, remarks, generated reports) completely - it cannot be undone. If this is a real student who has left the school, use "Update status" instead so their historical record is kept. Only use this for a duplicate or test/example entry.`,
      confirmLabel: "Delete permanently",
      variant: "danger",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await StudentService.deleteStudent(student.id);
      showToast(`${getFullName(student)} was permanently deleted.`, "success");
      navigate("/students");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Could not delete this student.", "error");
    } finally {
      setDeleting(false);
    }
  };

  if (student === undefined) return <LoadingSpinner />;
  if (student === null || !student) {
    return (
      <Card>
        <EmptyState icon="bi-person-x" title="Student not found" message="This student record may have been removed." />
      </Card>
    );
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Students", path: "/students" }, { label: getFullName(student) }]} />
      <PageHeader
        title={getFullName(student)}
        description={`${student.studentId}${student.admissionNumber ? ` · Admission No. ${student.admissionNumber}` : ""}`}
        actions={
          <>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setStatusOpen(true)}>
              <i className="bi bi-toggle2-on me-1" /> Update status
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setAssignOpen(true)}>
              <i className="bi bi-people me-1" /> Assign class
            </button>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setPromoteOpen(true)}>
              <i className="bi bi-arrow-up-right-circle me-1" /> Promote
            </button>
            <Link to={`/students/${studentId}/edit`} className="btn btn-primary btn-sm">
              <i className="bi bi-pencil me-1" /> Edit
            </Link>
            <button className="btn btn-outline-danger btn-sm" onClick={onDeleteStudent} disabled={deleting}>
              <i className="bi bi-trash3 me-1" /> {deleting ? "Deleting…" : "Delete"}
            </button>
          </>
        }
      />

      <div className="row g-4">
        <div className="col-lg-4">
          <Card className="mb-4 text-center">
            {student.photoDataUrl ? (
              <img src={student.photoDataUrl} alt="" className="rounded-circle mb-3" style={{ width: 120, height: 120, objectFit: "cover" }} />
            ) : (
              <div className="rounded-circle bg-light border mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: 120, height: 120 }}>
                <i className="bi bi-person" style={{ fontSize: "2.5rem" }} />
              </div>
            )}
            <div className="d-flex justify-content-center gap-2 mb-3">
              <label className="btn btn-outline-secondary btn-sm mb-0">
                Upload/Replace
                <input type="file" accept="image/*" hidden onChange={(e) => onPhotoChange(e.target.files?.[0] ?? null)} />
              </label>
              {student.photoDataUrl && (
                <button className="btn btn-outline-danger btn-sm" onClick={onPhotoRemove}>Remove</button>
              )}
            </div>
            <h2 className="h6 mb-1">{getFullName(student)}</h2>
            <div className="mb-2"><StudentStatusBadge status={student.status} /></div>
            <p className="text-muted small mb-0">
              {student.gender === "M" ? "Male" : "Female"} · Age {calculateAge(student.dateOfBirth)}
            </p>
          </Card>

          <Card>
            <h2 className="h6 mb-3">Personal details</h2>
            <dl className="row small mb-0">
              <dt className="col-6">Date of birth</dt><dd className="col-6">{formatDateForDisplay(student.dateOfBirth)}</dd>
              <dt className="col-6">Nationality</dt><dd className="col-6">{student.nationality}</dd>
              <dt className="col-6">EMIS number</dt><dd className="col-6">{student.emisNumber || "—"}</dd>
              <dt className="col-6">Ghana Card</dt><dd className="col-6">{student.ghanaCardNumber || "—"}</dd>
              <dt className="col-6">SEN</dt><dd className="col-6">{student.specialEducationalNeeds || "—"}</dd>
              <dt className="col-6">Current class</dt>
              <dd className="col-6">{currentEnrollment ? `${className(currentEnrollment.classId)} (${levelName(currentEnrollment.levelId)})` : "Not enrolled"}</dd>
            </dl>
          </Card>
        </div>

        <div className="col-lg-8">
          <ul className="nav nav-tabs mb-3 flex-nowrap overflow-auto">
            {TABS.map((t) => (
              <li className="nav-item" key={t.key}>
                <button className={`nav-link d-flex align-items-center gap-1 ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>
                  <i className={`bi ${t.icon}`} /> {t.label}
                </button>
              </li>
            ))}
          </ul>

          <Card>
            {tab === "academic" && (
              <dl className="row small mb-0">
                <dt className="col-5">Academic year of admission</dt><dd className="col-7">{yearLabel(student.academicYearOfAdmissionId)}</dd>
                <dt className="col-5">Admission date</dt><dd className="col-7">{formatDateForDisplay(student.admissionDate)}</dd>
                <dt className="col-5">Previous school</dt><dd className="col-7">{student.previousSchool || "—"}</dd>
                <dt className="col-5">Boarding/Day</dt><dd className="col-7">{student.boardingStatus || "—"}</dd>
                <dt className="col-5">Current level</dt><dd className="col-7">{levelName(currentEnrollment?.levelId)}</dd>
                <dt className="col-5">Current class</dt><dd className="col-7">{className(currentEnrollment?.classId)}</dd>
                <dt className="col-5">Current term</dt><dd className="col-7">{termName(currentEnrollment?.termId)}</dd>
              </dl>
            )}

            {tab === "parent" && (
              guardian ? (
                <dl className="row small mb-0">
                  <dt className="col-5">Name</dt><dd className="col-7">{guardian.fullName}</dd>
                  <dt className="col-5">Relationship</dt><dd className="col-7">{guardian.relationship}</dd>
                  <dt className="col-5">Phone</dt><dd className="col-7">{guardian.phone}</dd>
                  <dt className="col-5">Alternative phone</dt><dd className="col-7">{guardian.alternativePhone || "—"}</dd>
                  <dt className="col-5">Email</dt><dd className="col-7">{guardian.email || "—"}</dd>
                  <dt className="col-5">Occupation</dt><dd className="col-7">{guardian.occupation || "—"}</dd>
                  <dt className="col-5">Residential address</dt><dd className="col-7">{guardian.residentialAddress || "—"}</dd>
                  <dt className="col-5">Digital address</dt><dd className="col-7">{guardian.digitalAddress || "—"}</dd>
                  <dt className="col-5">Emergency contact</dt>
                  <dd className="col-7">{guardian.emergencyContactName || "—"} {guardian.emergencyContactPhone ? `(${guardian.emergencyContactPhone})` : ""}</dd>
                </dl>
              ) : (
                <EmptyState icon="bi-person-heart" title="No guardian on file" message="Edit this student to add parent/guardian information." />
              )
            )}

            {tab === "enrollment" && (
              enrollmentHistory && enrollmentHistory.length > 0 ? (
                <table className="table table-sm">
                  <thead><tr><th>Year</th><th>Term</th><th>Level</th><th>Class</th><th>Date</th><th>Status</th></tr></thead>
                  <tbody>
                    {enrollmentHistory.map((e) => (
                      <tr key={e.id}>
                        <td>{yearLabel(e.academicYearId)}</td>
                        <td>{termName(e.termId)}</td>
                        <td>{levelName(e.levelId)}</td>
                        <td>{className(e.classId)}{e.isCurrent && <span className="badge text-bg-primary ms-2">Current</span>}</td>
                        <td>{formatDateForDisplay(e.enrollmentDate)}</td>
                        <td>{e.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon="bi-clock-history" title="No enrollment history yet" message="This student has not been assigned to a class." />
              )
            )}

            {tab === "promotion" && (
              promotionHistory && promotionHistory.length > 0 ? (
                <table className="table table-sm">
                  <thead><tr><th>Year</th><th>From</th><th>To</th><th>Status</th><th>Date</th><th>Remarks</th></tr></thead>
                  <tbody>
                    {promotionHistory.map((p) => (
                      <tr key={p.id}>
                        <td>{yearLabel(p.academicYearId)}</td>
                        <td>{levelName(p.fromLevelId)} / {className(p.fromClassId)}</td>
                        <td>{levelName(p.toLevelId)} / {className(p.toClassId)}</td>
                        <td>{p.status}</td>
                        <td>{formatDateForDisplay(p.promotionDate)}</td>
                        <td className="small text-muted">{p.remarks || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon="bi-arrow-up-right-circle" title="No promotions recorded" message="Promotion records will appear here permanently once recorded - they are never overwritten." />
              )
            )}

            {tab === "assessment" && (
              (scoreHistory === undefined || skillHistory === undefined) ? (
                <LoadingSpinner />
              ) : scoreHistory.length === 0 && skillHistory.length === 0 ? (
                <EmptyState icon="bi-clipboard-data" title="No assessment history yet" message="Scores and skill ratings will appear here once this student has been assessed in a term." />
              ) : (
                <div className="d-flex flex-column gap-4">
                  {scoreHistory.length > 0 && (
                    <div>
                      <h3 className="h6">Subject scores</h3>
                      <table className="table table-sm">
                        <thead><tr><th>Term</th><th>Subject</th><th>SBA</th><th>Exam</th><th>Total</th></tr></thead>
                        <tbody>
                          {[...scoreHistory]
                            .sort((a, b) => (a.termId - b.termId) || subjectName(a.subjectId).localeCompare(subjectName(b.subjectId)))
                            .map((r) => (
                              <tr key={r.id}>
                                <td>{termName(r.termId)}</td>
                                <td>{subjectName(r.subjectId)}</td>
                                <td>{r.sbaScore ?? "—"}</td>
                                <td>{r.examScore ?? "—"}</td>
                                <td>{r.sbaScore != null && r.examScore != null ? r.sbaScore + r.examScore : "—"}</td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {skillHistory.length > 0 && (
                    <div>
                      <h3 className="h6">Skill ratings (KG)</h3>
                      <table className="table table-sm">
                        <thead><tr><th>Term</th><th>Skill</th><th>Rating</th><th>Comment</th></tr></thead>
                        <tbody>
                          {[...skillHistory]
                            .sort((a, b) => a.termId - b.termId)
                            .map((r) => (
                              <tr key={r.id}>
                                <td>{termName(r.termId)}</td>
                                <td>{skillName(r.skillId)}</td>
                                <td>{ratingLabel(r.rating)}</td>
                                <td className="small text-muted">{r.comment || "—"}</td>
                              </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            )}
            {tab === "reports" && (
              reportHistory === undefined ? (
                <LoadingSpinner />
              ) : reportHistory.length === 0 ? (
                <EmptyState icon="bi-file-earmark-text" title="No report cards yet" message="Report cards will be listed here once one has been generated for this student." />
              ) : (
                <table className="table table-sm">
                  <thead><tr><th>Term</th><th>Template</th><th>Version</th><th>Generated</th><th>Prints</th><th>PDF exports</th><th /></tr></thead>
                  <tbody>
                    {[...reportHistory]
                      .sort((a, b) => b.termId - a.termId)
                      .map((r) => (
                        <tr key={r.id}>
                          <td>{termName(r.termId)}</td>
                          <td className="text-capitalize">{r.templateCode}</td>
                          <td>v{r.versionNumber}</td>
                          <td>{formatDateForDisplay(r.generatedAt)}</td>
                          <td>{r.printCount}</td>
                          <td>{r.pdfExportCount}</td>
                          <td>
                            <Link
                              className="btn btn-sm btn-outline-secondary"
                              to={`/report-cards/preview?classId=${r.classId}&termId=${r.termId}&studentIds=${r.studentId}&mode=frozen&reportId=${r.id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}
            {tab === "attendance" && (
              <EmptyState icon="bi-calendar-check" title="Attendance Summary" message="Attendance tracking is a future module beyond the current roadmap." />
            )}
            {tab === "audit" && (
              <dl className="row small mb-0">
                <dt className="col-5">Student ID (permanent)</dt><dd className="col-7"><code>{student.studentId}</code></dd>
                <dt className="col-5">Created</dt><dd className="col-7">{formatDateForDisplay(student.createdAt)}</dd>
                <dt className="col-5">Last updated</dt><dd className="col-7">{formatDateForDisplay(student.updatedAt)}</dd>
                <dt className="col-5">Status changed</dt><dd className="col-7">{student.statusChangedAt ? formatDateForDisplay(student.statusChangedAt) : "—"}</dd>
                <dt className="col-5">Status reason</dt><dd className="col-7">{student.statusReason || "—"}</dd>
              </dl>
            )}
          </Card>
        </div>
      </div>

      {assignOpen && (
        <ClassAssignmentModal isOpen studentIds={[studentId]} onClose={() => setAssignOpen(false)} />
      )}
      {promoteOpen && (
        <PromotionModal studentId={studentId} onClose={() => setPromoteOpen(false)} />
      )}
      {statusOpen && (
        <StatusChangeModal student={student} onClose={() => setStatusOpen(false)} />
      )}
    </>
  );
}
