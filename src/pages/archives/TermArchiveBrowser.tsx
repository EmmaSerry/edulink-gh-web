import { useParams, Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { EmptyState } from "@components/EmptyState";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { db } from "@database/db";
import { getFullName } from "@models/Student";
import { TermService } from "@services/TermService";
import { ArchiveService } from "@services/ArchiveService";

/**
 * Module 1 - browse (and reprint) every report card generated for one
 * term, archived or not. Reads straight from the live `enrollments` /
 * `reportVersions` tables - see Archive.ts for why there is no separate
 * archived copy of this data to read from instead.
 */
export function TermArchiveBrowser() {
  const { termId: termIdParam } = useParams();
  const termId = Number(termIdParam);

  const term = useLiveQuery(() => TermService.getById(termId), [termId]);
  const archiveRow = useLiveQuery(() => ArchiveService.getArchiveForTerm(termId), [termId]);

  const rows = useLiveQuery(async () => {
    const enrollments = await db.enrollments.where("termId").equals(termId).toArray();
    const [students, classes, reportVersions] = await Promise.all([
      db.students.bulkGet(enrollments.map((e) => e.studentId)),
      db.classes.toArray(),
      db.reportVersions.where("termId").equals(termId).toArray(),
    ]);

    return enrollments
      .map((e, i) => {
        const student = students[i];
        if (!student) return null;
        const cls = classes.find((c) => c.id === e.classId);
        const versions = reportVersions
          .filter((v) => v.studentId === e.studentId)
          .sort((a, b) => b.versionNumber - a.versionNumber);
        const latest = versions[0];
        return {
          studentId: e.studentId,
          name: getFullName(student),
          className: cls?.name ?? "—",
          versionNumber: latest?.versionNumber,
          reportVersionId: latest?.id,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [termId]);

  return (
    <>
      <Breadcrumb items={[{ label: "Archives", path: "/archives" }, { label: term?.termName ?? "Term" }]} />
      <PageHeader
        title={term ? `${term.termName} - Archived Reports` : "Archived Reports"}
        description={
          archiveRow
            ? `Archived ${new Date(archiveRow.archivedAt).toLocaleDateString()} by ${archiveRow.archivedBy}`
            : "This term has not been archived yet - reports shown here are still live and editable."
        }
        actions={
          <Link to="/archives" className="btn btn-sm btn-outline-secondary">
            <i className="bi bi-arrow-left me-1" /> Back to Archives
          </Link>
        }
      />

      <Card>
        {!rows ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="bi-file-earmark-text"
            title="No report cards yet"
            message="No student in this term has a generated report card yet."
          />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Version</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.name}</td>
                    <td>{row.className}</td>
                    <td>{row.versionNumber ? `v${row.versionNumber}` : "—"}</td>
                    <td className="text-end">
                      {row.reportVersionId ? (
                        <Link
                          to={`/report-cards/preview?mode=frozen&reportId=${row.reportVersionId}`}
                          className="btn btn-sm btn-outline-primary"
                        >
                          View / Reprint
                        </Link>
                      ) : (
                        <span className="text-muted small">Not generated</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
