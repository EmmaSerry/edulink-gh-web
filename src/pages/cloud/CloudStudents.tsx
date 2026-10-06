import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListEmptyState } from "@components/ListEmptyState";
import { downloadCsv } from "@/lib/csvExport";
import {
  LearnerService,
  LEVEL_GROUP_LABEL,
  type LearnerFilterOptions,
  type LearnerFilters,
  type LearnerRow,
  type LevelGroup,
} from "@services/cloud/LearnerService";

const PAGE_SIZE = 50;

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "text-bg-success",
  TRANSFERRED_OUT: "text-bg-secondary",
  GRADUATED: "text-bg-primary",
  WITHDRAWN: "text-bg-warning",
  DECEASED: "text-bg-dark",
};

function fullNameOf(s: LearnerRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

function StudentThumb({ student }: { student: LearnerRow }) {
  if (student.photo_url) {
    return (
      <img
        src={student.photo_url}
        alt=""
        style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
      />
    );
  }
  return (
    <div
      className="d-flex align-items-center justify-content-center text-white"
      style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--actrs-navy)", fontSize: "0.8rem" }}
    >
      {student.first_name.trim().charAt(0).toUpperCase()}
    </div>
  );
}

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * The learner list for every role. The database limits it to the right
 * schools (own school / whole district / everything for the Super Admin);
 * the filters narrow it further by school, class, level group and gender.
 */
export function CloudStudents() {
  const [options, setOptions] = useState<LearnerFilterOptions>({ schools: [], classNames: [] });
  const [filters, setFilters] = useState<LearnerFilters>({ status: "ACTIVE" });
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LearnerRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    LearnerService.filterOptions().then(setOptions).catch(() => {});
  }, []);

  // Wait a moment after typing before searching.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setFilters((f) => (f.search === searchText ? f : { ...f, search: searchText }));
      setPage(0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [searchText]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    LearnerService.list(filters, PAGE_SIZE, page * PAGE_SIZE)
      .then((data) => !cancelled && setRows(data))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load learners."));
    return () => {
      cancelled = true;
    };
  }, [filters, page]);

  function update(patch: Partial<LearnerFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  }

  const total = rows && rows.length > 0 ? Number(rows[0].total_count) : 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  const showSchoolFilter = options.schools.length > 1;

  async function handleExport() {
    setExporting(true);
    try {
      const all = await LearnerService.list(filters, 5000, 0);
      downloadCsv(
        "learners.csv",
        ["No.", "Student ID", "Name", "Gender", "Date of birth", "Age", "School", "Class", "Level", "Status"],
        all.map((s, i) => [
          i + 1,
          s.student_id,
          fullNameOf(s),
          s.gender === "M" ? "Male" : "Female",
          s.date_of_birth,
          s.age ?? "",
          s.school_name,
          s.class_name ?? "",
          s.level_group ? LEVEL_GROUP_LABEL[s.level_group] ?? s.level_group : "",
          s.status.replace("_", " "),
        ])
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-0">Learners</h1>
          <div className="text-muted small">{rows === null ? "Loading…" : `${total} learner${total === 1 ? "" : "s"}`}</div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary text-nowrap"
            disabled={exporting || total === 0}
            onClick={handleExport}
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

      <div className="actrs-card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-4">
            <input
              type="search"
              className="form-control"
              placeholder="Search by name or student ID…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
          {showSchoolFilter && (
            <div className="col-md-4">
              <select
                className="form-select"
                value={filters.schoolId ?? ""}
                onChange={(e) => update({ schoolId: e.target.value || undefined })}
              >
                <option value="">All schools</option>
                {options.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={filters.levelGroup ?? ""}
              onChange={(e) => update({ levelGroup: (e.target.value || undefined) as LevelGroup | undefined })}
            >
              <option value="">All levels</option>
              <option value="KG">KG</option>
              <option value="LOWER_PRIMARY">Lower Primary</option>
              <option value="UPPER_PRIMARY">Upper Primary</option>
              <option value="JHS">JHS</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={filters.className ?? ""}
              onChange={(e) => update({ className: e.target.value || undefined })}
            >
              <option value="">All classes</option>
              {[...options.classNames].sort(naturalSort).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={filters.gender ?? ""}
              onChange={(e) => update({ gender: (e.target.value || undefined) as "M" | "F" | undefined })}
            >
              <option value="">All genders</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <select
              className="form-select"
              value={filters.status ?? "ACTIVE"}
              onChange={(e) => update({ status: e.target.value })}
            >
              <option value="ACTIVE">Active</option>
              <option value="">Every status</option>
              <option value="TRANSFERRED_OUT">Transferred out</option>
              <option value="GRADUATED">Graduated</option>
              <option value="WITHDRAWN">Withdrawn</option>
            </select>
          </div>
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
                <th style={{ width: 56 }}>No.</th>
                <th style={{ width: 48 }}></th>
                <th>Student ID</th>
                <th>Name</th>
                <th>School</th>
                <th>Class</th>
                <th>Level</th>
                <th>Gender</th>
                <th>Age</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows === null && !error && (
                <tr>
                  <td colSpan={10} className="text-center text-muted py-4">
                    Loading…
                  </td>
                </tr>
              )}
              {rows !== null && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-0">
                    <ListEmptyState
                      title="No learners found"
                      body="Try changing or clearing the filters, or register a learner."
                      action={
                        <Link to="/students/register" className="btn btn-primary btn-sm">
                          <i className="bi bi-person-plus me-1" />
                          Register a student
                        </Link>
                      }
                    />
                  </td>
                </tr>
              )}
              {(rows ?? []).map((s, i) => (
                <tr key={s.id}>
                  <td className="text-muted">{page * PAGE_SIZE + i + 1}</td>
                  <td>
                    <StudentThumb student={s} />
                  </td>
                  <td className="text-muted">{s.student_id}</td>
                  <td className="fw-medium">{fullNameOf(s)}</td>
                  <td>{s.school_name}</td>
                  <td>{s.class_name ?? <span className="text-muted">-</span>}</td>
                  <td>{s.level_group ? LEVEL_GROUP_LABEL[s.level_group] ?? s.level_group : <span className="text-muted">-</span>}</td>
                  <td>{s.gender === "M" ? "Male" : "Female"}</td>
                  <td>{s.age ?? "-"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[s.status] ?? "text-bg-secondary"}`}>
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > PAGE_SIZE && (
          <div className="d-flex align-items-center justify-content-between p-3 border-top">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="text-muted small">
              Page {page + 1} of {lastPage + 1}
            </span>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              disabled={page >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
