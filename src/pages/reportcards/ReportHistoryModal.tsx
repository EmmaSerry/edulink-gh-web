import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { db } from "@database/db";
import { Modal } from "@components/Modal";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { EmptyState } from "@components/EmptyState";

interface Props {
  studentId: number;
  studentName: string;
  onClose: () => void;
}

/**
 * Module 13 - Report History. Every `ReportVersionEntry` ever generated
 * for this student, across every term, newest first. Print/PDF-export
 * counts are tracked on the CURRENT `GeneratedReport` row per term (not
 * per historical version, since a reprint of an older version still
 * counts toward that term's totals) - this view looks them up per term
 * for context alongside each version.
 */
export function ReportHistoryModal({ studentId, studentName, onClose }: Props) {
  const navigate = useNavigate();

  const versions = useLiveQuery(async () => {
    const rows = await db.reportVersions.where("studentId").equals(studentId).sortBy("generatedAt");
    return rows.reverse();
  }, [studentId]);
  const terms = useLiveQuery(() => db.terms.toArray(), []);
  const academicYears = useLiveQuery(() => db.academicYears.toArray(), []);
  const currentReports = useLiveQuery(() => db.generatedReports.where("studentId").equals(studentId).toArray(), [studentId]);

  const termById = new Map((terms ?? []).map((t) => [t.id!, t]));
  const yearById = new Map((academicYears ?? []).map((y) => [y.id!, y]));
  const currentByTerm = new Map((currentReports ?? []).map((r) => [r.termId, r]));

  const loading = !versions || !terms || !academicYears || !currentReports;

  return (
    <Modal title={`Report History - ${studentName}`} isOpen onClose={onClose} size="lg">
      {loading ? (
        <LoadingSpinner />
      ) : versions.length === 0 ? (
        <EmptyState icon="bi-clock-history" title="No reports generated yet" message="This student has no report history yet." />
      ) : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Term</th>
                <th>Version</th>
                <th>Generated</th>
                <th>By</th>
                <th>Prints</th>
                <th>PDF Exports</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => {
                const term = termById.get(v.termId);
                const year = term ? yearById.get(term.academicYearId) : undefined;
                const current = currentByTerm.get(v.termId);
                const isCurrent = current?.versionNumber === v.versionNumber;
                return (
                  <tr key={v.id}>
                    <td>
                      {year?.label ?? "-"} - {term?.termName ?? "-"}
                    </td>
                    <td>
                      v{v.versionNumber}
                      {isCurrent && <span className="badge text-bg-success ms-1">Current</span>}
                    </td>
                    <td className="text-muted small">{new Date(v.generatedAt).toLocaleString()}</td>
                    <td className="text-muted small">{v.generatedBy}</td>
                    <td>{isCurrent ? current?.printCount ?? 0 : "-"}</td>
                    <td>{isCurrent ? current?.pdfExportCount ?? 0 : "-"}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => navigate(`/report-cards/preview?mode=frozen&reportId=${v.id}`)}
                      >
                        View / Reprint
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
