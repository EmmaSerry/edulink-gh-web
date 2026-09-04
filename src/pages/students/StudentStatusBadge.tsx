import type { StudentStatus } from "@models/Student";

const STYLES: Record<StudentStatus, string> = {
  ACTIVE: "text-bg-success",
  TRANSFERRED_OUT: "text-bg-warning",
  GRADUATED: "text-bg-primary",
  WITHDRAWN: "text-bg-secondary",
  DECEASED: "text-bg-dark",
};

const LABELS: Record<StudentStatus, string> = {
  ACTIVE: "Active",
  TRANSFERRED_OUT: "Transferred Out",
  GRADUATED: "Graduated",
  WITHDRAWN: "Withdrawn",
  DECEASED: "Deceased",
};

export function StudentStatusBadge({ status }: { status: StudentStatus }) {
  return <span className={`badge rounded-pill ${STYLES[status]}`}>{LABELS[status]}</span>;
}
