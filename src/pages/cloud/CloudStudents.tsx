import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CloudStudentService } from "@services/cloud/StudentService";
import { downloadCsv } from "@/lib/csvExport";
import type { StudentRow } from "@/types/database";

function fullNameOf(s: StudentRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

/** Thumbnail if the student has a photo (stored as a small data URL -
 *  see PassportPhotoCropper), otherwise a plain initials circle so the
 *  column stays useful even for the majority of students without one
 *  yet, rather than an empty gap. */
function StudentThumb({ student }: { student: StudentRow }) {
  if (student.photo_url) {
    return (
      <img
        src={student.photo_url}
        alt=""
        style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  const initial = student.first_name.trim().charAt(0).toUpperCase();
  return (
    <div
      className="d-flex align-items-center justify-content-center text-white"
      style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--actrs-navy)", fontSize: "0.8rem" }}
    >
      {initial}
    </div>
  );
}

const STATUS_BADGE: Record<StudentRow["status"], string> = {
  ACTIVE: "text-bg-success",
  TRANSFERRED_OUT: "text-bg-secondary",
  GRADUATED: "text-bg-primary",
  WITHDRAWN: "text-bg-warning",
  DECEASED: "text-bg-dark",
};

export function CloudStudents() {
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    CloudStudentService.list()
      .then((rows) => !cancelled && setStudents(rows))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load students."));
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!students) return [];
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => fullNameOf(s).toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q)
    );
  }, [students, query]);

  function handleExport() {
    downloadCsv(
      "students.csv",
      ["Student ID", "First name", "Middle name", "Last name", "Gender", "Date of birth", "Status"],
      filtered.map((s) => [s.student_id, s.first_name, s.middle_name ?? "", s.last_name, s.gender, s.date_of_birth, s.status])
    );
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3">
        <h1 className="h4 mb-0">Students</h1>
        <div className="d-flex align-items-center gap-2">
          <input
            type="search"
            className="form-control"
            style={{ maxWidth: 280 }}
            placeholder="Search by name or student ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline-secondary text-nowrap"
            onClick={handleExport}
            disabled={!students || filtered.length === 0}
          >
            <i className="bi bi-download me-1" />
            Export CSV
          </button>
          <Link to="/students/register" className="btn btn-primary text-nowrap">
            <i className="bi bi-person-plus me-1" />
            Register student
          </Link>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="actrs-card p-0">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: 48 }}></th>
                <th>Student ID</th>
                <th>Name</th>
                <th>Gender</th>
                <th>Date of birth</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {students === null && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    Loading…
                  </td>
                </tr>
              )}
              {students !== null && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    {students.length === 0 ? "No students registered yet." : "No students match your search."}
                  </td>
                </tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td>
                    <StudentThumb student={s} />
                  </td>
                  <td className="text-muted">{s.student_id}</td>
                  <td className="fw-medium">{fullNameOf(s)}</td>
                  <td>{s.gender === "M" ? "Male" : "Female"}</td>
                  <td>{s.date_of_birth}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.status]}`}>{s.status.replace("_", " ")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
