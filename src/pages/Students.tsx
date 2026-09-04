import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { DataTable, type DataTableColumn } from "@components/DataTable";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { AcademicYearService } from "@services/AcademicYearService";
import { TermService } from "@services/TermService";
import { LevelService } from "@services/LevelService";
import { ClassService } from "@services/ClassService";
import { ExportService, type ExportFileFormat, type ExportScope } from "@services/ExportService";
import { StudentService } from "@services/StudentService";
import { useStudentDirectory, type StudentDirectoryRow } from "@hooks/useStudentDirectory";
import { StudentStatusBadge } from "./students/StudentStatusBadge";
import { ClassAssignmentModal } from "./students/ClassAssignmentModal";
import { ImportWizard } from "./students/ImportWizard";
import { StatusChangeModal } from "./students/StatusChangeModal";
import type { Student, StudentStatus } from "@models/Student";

const AGE_GROUPS: Array<{ label: string; min: number; max: number }> = [
  { label: "Under 5", min: 0, max: 4 },
  { label: "5–8", min: 5, max: 8 },
  { label: "9–12", min: 9, max: 12 },
  { label: "13–15", min: 13, max: 15 },
  { label: "16+", min: 16, max: 200 },
];

export function Students() {
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const rows = useStudentDirectory();
  const academicYears = useLiveQuery(() => AcademicYearService.getAll(), []);
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);

  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    academicYearId: 0,
    termId: 0,
    levelId: 0,
    classId: 0,
    gender: "" as "" | "M" | "F",
    status: "" as "" | StudentStatus,
    admissionYearId: 0,
    ageGroup: "",
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [assignModalIds, setAssignModalIds] = useState<number[] | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [statusStudent, setStatusStudent] = useState<Student | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const onDeleteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Permanently delete ${ids.length} student(s)?`,
      message:
        "This removes every selected student and everything linked to them (guardian, enrollment history, scores, skill ratings, remarks, generated reports) completely - it cannot be undone. Only use this for duplicates or test/example entries; a real student who has left should be marked with Update Status instead so their record is kept.",
      confirmLabel: "Delete permanently",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingSelected(true);
    try {
      const { deleted, failed } = await StudentService.deleteMany(ids);
      setSelected(new Set());
      showToast(
        failed > 0 ? `Deleted ${deleted} student(s), ${failed} could not be deleted.` : `Deleted ${deleted} student(s).`,
        failed > 0 ? "error" : "success",
      );
    } finally {
      setDeletingSelected(false);
    }
  };

  const filtered = useMemo(() => {
    if (!rows) return undefined;
    return rows.filter((r) => {
      if (filters.academicYearId && r.academicYearId !== filters.academicYearId) return false;
      if (filters.termId && r.termId !== filters.termId) return false;
      if (filters.levelId && r.levelId !== filters.levelId) return false;
      if (filters.classId && r.classId !== filters.classId) return false;
      if (filters.gender && r.student.gender !== filters.gender) return false;
      if (filters.status && r.student.status !== filters.status) return false;
      if (filters.admissionYearId && r.student.academicYearOfAdmissionId !== filters.admissionYearId) return false;
      if (filters.ageGroup) {
        const group = AGE_GROUPS.find((g) => g.label === filters.ageGroup);
        if (group && (r.age < group.min || r.age > group.max)) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          r.student.studentId,
          r.student.admissionNumber ?? "",
          r.student.emisNumber ?? "",
          r.fullName,
          r.guardianName,
          r.guardianPhone,
          r.className,
          r.levelName,
          r.student.gender,
          r.student.status,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters, search]);

  const classesForLevel = classes?.filter((c) => !filters.levelId || c.levelId === filters.levelId);

  const toggleSelected = (row: StudentDirectoryRow) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const id = row.student.id!;
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = (pageRows: StudentDirectoryRow[], checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageRows.forEach((r) => {
        if (checked) next.add(r.student.id!);
        else next.delete(r.student.id!);
      });
      return next;
    });
  };

  const runExport = async (scope: ExportScope, format: ExportFileFormat) => {
    try {
      const count = await ExportService.export(scope, format, "students");
      showToast(`Exported ${count} student record(s).`, "success");
    } catch (err) {
      console.error(err);
      showToast("Export failed.", "error");
    }
  };

  const columns: DataTableColumn<StudentDirectoryRow>[] = [
    {
      key: "photo",
      header: "",
      render: (r) =>
        r.student.photoDataUrl ? (
          <img src={r.student.photoDataUrl} alt="" className="rounded-circle" style={{ width: 32, height: 32, objectFit: "cover" }} />
        ) : (
          <span className="rounded-circle bg-light border d-inline-flex align-items-center justify-content-center" style={{ width: 32, height: 32 }}>
            <i className="bi bi-person text-muted" />
          </span>
        ),
      className: "text-center",
    },
    {
      key: "name",
      header: "Student",
      render: (r) => (
        <div>
          <Link to={`/students/${r.student.id}`} className="fw-semibold text-decoration-none">
            {r.fullName}
          </Link>
          <div className="text-muted small">{r.student.studentId}</div>
        </div>
      ),
      sortValue: (r) => r.fullName,
    },
    { key: "admissionNumber", header: "Admission No.", render: (r) => r.student.admissionNumber || "—" },
    { key: "gender", header: "Gender", render: (r) => r.student.gender },
    { key: "age", header: "Age", render: (r) => r.age, sortValue: (r) => r.age },
    { key: "class", header: "Class", render: (r) => r.className },
    { key: "level", header: "Level", render: (r) => r.levelName },
    { key: "guardian", header: "Parent/Guardian", render: (r) => <span className="small">{r.guardianName}<br />{r.guardianPhone}</span> },
    { key: "status", header: "Status", render: (r) => <StudentStatusBadge status={r.student.status} /> },
  ];

  if (rows === undefined) return <LoadingSpinner />;

  return (
    <>
      <Breadcrumb items={[{ label: "Students" }]} />
      <PageHeader
        title="Students"
        description="Centralized, permanent student records across all levels, academic years and terms."
        actions={
          <>
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setImportOpen(true)}>
              <i className="bi bi-upload me-1" /> Import
            </button>
            <div className="btn-group btn-group-sm">
              <button className="btn btn-outline-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false" type="button">
                <i className="bi bi-download me-1" /> Export
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><h6 className="dropdown-header">Filtered results</h6></li>
                <li><button className="dropdown-item" onClick={() => runExport({ type: "all" }, "xlsx")}>Excel (.xlsx)</button></li>
                <li><button className="dropdown-item" onClick={() => runExport({ type: "all" }, "csv")}>CSV</button></li>
                <li><button className="dropdown-item" onClick={() => runExport({ type: "all" }, "json")}>JSON</button></li>
                {selected.size > 0 && (
                  <>
                    <li><hr className="dropdown-divider" /></li>
                    <li><h6 className="dropdown-header">Selected ({selected.size})</h6></li>
                    <li><button className="dropdown-item" onClick={() => runExport({ type: "selected", studentIds: [...selected] }, "xlsx")}>Excel (.xlsx)</button></li>
                  </>
                )}
              </ul>
            </div>
            <Link to="/students/new" className="btn btn-primary btn-sm">
              <i className="bi bi-plus-lg me-1" /> Register student
            </Link>
          </>
        }
      />

      <Card className="mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <input
            type="search"
            className="form-control"
            style={{ maxWidth: 340 }}
            placeholder="Search by ID, admission no., name, parent, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setShowFilters((v) => !v)}>
            <i className="bi bi-funnel me-1" /> Filters
          </button>
          {selected.size > 0 && (
            <div className="ms-auto d-flex align-items-center gap-2">
              <span className="text-muted small">{selected.size} selected</span>
              <button className="btn btn-outline-primary btn-sm" onClick={() => setAssignModalIds([...selected])}>
                Assign class
              </button>
              <button className="btn btn-outline-danger btn-sm" onClick={onDeleteSelected} disabled={deletingSelected}>
                <i className="bi bi-trash3 me-1" />
                {deletingSelected ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>

        {showFilters && (
          <div className="row g-2 mt-2">
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.academicYearId} onChange={(e) => setFilters((f) => ({ ...f, academicYearId: Number(e.target.value) }))}>
                <option value={0}>All academic years</option>
                {academicYears?.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.termId} onChange={(e) => setFilters((f) => ({ ...f, termId: Number(e.target.value) }))}>
                <option value={0}>All terms</option>
                {terms?.map((t) => <option key={t.id} value={t.id}>{t.termName}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.levelId} onChange={(e) => setFilters((f) => ({ ...f, levelId: Number(e.target.value), classId: 0 }))}>
                <option value={0}>All levels</option>
                {levels?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.classId} onChange={(e) => setFilters((f) => ({ ...f, classId: Number(e.target.value) }))}>
                <option value={0}>All classes</option>
                {classesForLevel?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-md-1">
              <select className="form-select form-select-sm" value={filters.gender} onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value as any }))}>
                <option value="">Gender</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}>
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="TRANSFERRED_OUT">Transferred Out</option>
                <option value="GRADUATED">Graduated</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="DECEASED">Deceased</option>
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.admissionYearId} onChange={(e) => setFilters((f) => ({ ...f, admissionYearId: Number(e.target.value) }))}>
                <option value={0}>Admission year</option>
                {academicYears?.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <select className="form-select form-select-sm" value={filters.ageGroup} onChange={(e) => setFilters((f) => ({ ...f, ageGroup: e.target.value }))}>
                <option value="">Age group</option>
                {AGE_GROUPS.map((g) => <option key={g.label} value={g.label}>{g.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={filtered}
          getRowKey={(r) => r.student.id!}
          emptyTitle="No students found"
          emptyMessage="Try clearing filters, or register the first student."
          pageSize={12}
          selection={{
            isSelected: (r) => selected.has(r.student.id!),
            onToggle: toggleSelected,
            onToggleAllOnPage: toggleAllOnPage,
          }}
          rowActions={(r) => (
            <div className="btn-group btn-group-sm">
              <Link to={`/students/${r.student.id}`} className="btn btn-outline-secondary">
                <i className="bi bi-eye" />
              </Link>
              <Link to={`/students/${r.student.id}/edit`} className="btn btn-outline-secondary">
                <i className="bi bi-pencil" />
              </Link>
              <button className="btn btn-outline-secondary" onClick={() => setStatusStudent(r.student)}>
                <i className="bi bi-toggle2-on" />
              </button>
            </div>
          )}
        />
      </Card>

      {assignModalIds && (
        <ClassAssignmentModal
          isOpen
          studentIds={assignModalIds}
          onClose={() => setAssignModalIds(null)}
          onDone={() => setSelected(new Set())}
        />
      )}
      <ImportWizard isOpen={importOpen} onClose={() => setImportOpen(false)} />
      <StatusChangeModal student={statusStudent} onClose={() => setStatusStudent(null)} />
    </>
  );
}
