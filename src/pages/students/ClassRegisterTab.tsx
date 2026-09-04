import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { FormField } from "@components/FormField";
import { EmptyState } from "@components/EmptyState";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { TermService } from "@services/TermService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { GuardianService } from "@services/GuardianService";
import { EnrollmentService } from "@services/EnrollmentService";
import { StudentService } from "@services/StudentService";
import { ExportService, type ExportFileFormat } from "@services/ExportService";
import { getFullName, calculateAge } from "@models/Student";
import { StudentStatusBadge } from "../students/StudentStatusBadge";

/** Module 12 - Class Lists: a live, printable/exportable class register. */
export function ClassRegisterTab() {
  const { showToast } = useToast();
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);
  const [termId, setTermId] = useState(0);
  const [levelId, setLevelId] = useState(0);
  const [classId, setClassId] = useState(0);

  const classesForLevel = classes?.filter((c) => !levelId || c.levelId === levelId);

  const roster = useLiveQuery(async () => {
    if (!termId || !classId) return undefined;
    const enrollments = await EnrollmentService.getRoster(termId, classId);
    const rows = await Promise.all(
      enrollments.map(async (e) => {
        const student = await StudentService.getById(e.studentId);
        const guardian = student ? await GuardianService.getByStudentId(student.id!) : undefined;
        return student ? { student, guardian } : null;
      }),
    );
    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => getFullName(a.student).localeCompare(getFullName(b.student)));
  }, [termId, classId]);

  const selectedClassName = useMemo(() => classes?.find((c) => c.id === classId)?.name, [classes, classId]);

  const onExport = async (format: ExportFileFormat) => {
    if (!classId) return;
    const count = await ExportService.export({ type: "class", classId }, format, "class-register");
    showToast(`Exported ${count} student record(s).`, "success");
  };

  return (
    <div>
      <div className="row g-2 mb-3 no-print">
        <div className="col-md-3">
          <FormField label="Term">
            <select className="form-select form-select-sm" value={termId} onChange={(e) => setTermId(Number(e.target.value))}>
              <option value={0}>Select…</option>
              {terms?.map((t) => <option key={t.id} value={t.id}>{t.termName}</option>)}
            </select>
          </FormField>
        </div>
        <div className="col-md-3">
          <FormField label="Level">
            <select className="form-select form-select-sm" value={levelId} onChange={(e) => { setLevelId(Number(e.target.value)); setClassId(0); }}>
              <option value={0}>Select…</option>
              {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </FormField>
        </div>
        <div className="col-md-3">
          <FormField label="Class">
            <select className="form-select form-select-sm" value={classId} onChange={(e) => setClassId(Number(e.target.value))}>
              <option value={0}>Select…</option>
              {classesForLevel?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FormField>
        </div>
        <div className="col-md-3 d-flex align-items-end gap-2 mb-3">
          <button className="btn btn-outline-secondary btn-sm" disabled={!classId} onClick={() => window.print()}>
            <i className="bi bi-printer me-1" /> Print
          </button>
          <div className="btn-group btn-group-sm">
            <button className="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" type="button" disabled={!classId}>
              Export
            </button>
            <ul className="dropdown-menu">
              <li><button className="dropdown-item" onClick={() => onExport("xlsx")}>Excel (.xlsx)</button></li>
              <li><button className="dropdown-item" onClick={() => onExport("csv")}>CSV</button></li>
              <li><button className="dropdown-item" onClick={() => onExport("json")}>JSON</button></li>
            </ul>
          </div>
        </div>
      </div>

      {!termId || !classId ? (
        <EmptyState icon="bi-people" title="Select a term and class" message="Choose a term and class above to view its live register." />
      ) : roster === undefined ? (
        <LoadingSpinner />
      ) : roster.length === 0 ? (
        <EmptyState icon="bi-inbox" title="No students enrolled" message="No students are currently enrolled in this class for the selected term." />
      ) : (
        <div>
          <h2 className="h6 mb-3">{selectedClassName} - Class Register ({roster.length} students)</h2>
          <table className="table table-sm table-bordered">
            <thead>
              <tr>
                <th>Student ID</th><th>Admission No.</th><th>Name</th><th>Gender</th><th>Age</th><th>Parent Contact</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => (
                <tr key={r.student.id}>
                  <td>{r.student.studentId}</td>
                  <td>{r.student.admissionNumber || "—"}</td>
                  <td>{getFullName(r.student)}</td>
                  <td>{r.student.gender}</td>
                  <td>{calculateAge(r.student.dateOfBirth)}</td>
                  <td>{r.guardian?.phone ?? "—"}</td>
                  <td><StudentStatusBadge status={r.student.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
