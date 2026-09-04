import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Link } from "react-router-dom";
import { PageHeader } from "@components/PageHeader";
import { Breadcrumb } from "@components/Breadcrumb";
import { Card } from "@components/Card";
import { Modal } from "@components/Modal";
import { EmptyState } from "@components/EmptyState";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { useConfirm } from "@contexts/ConfirmContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { TermService } from "@services/TermService";
import { AcademicYearService } from "@services/AcademicYearService";
import { ArchiveService } from "@services/ArchiveService";
import { compareAcademicYears, type YearComparisonRow } from "@services/AnalyticsService";

type Tab = "browse" | "compare";

export function Archives() {
  const [tab, setTab] = useState<Tab>("browse");
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const { name: currentUser } = useCurrentUser();

  const terms = useLiveQuery(() => TermService.getAll(), []);
  const years = useLiveQuery(() => AcademicYearService.getAll(), []);
  const archives = useLiveQuery(() => ArchiveService.getArchivedTerms(), []);

  const [archiveModalTermId, setArchiveModalTermId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [compareYearIds, setCompareYearIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<YearComparisonRow[] | null>(null);
  const [comparing, setComparing] = useState(false);

  const archivedTermIds = new Set((archives ?? []).map((a) => a.termId));

  const yearLabel = (academicYearId: number) => years?.find((y) => y.id === academicYearId)?.label ?? "—";

  async function handleArchive(termId: number) {
    setBusy(true);
    try {
      await ArchiveService.archiveTerm(termId, currentUser, note.trim() || undefined);
      showToast("Term archived and locked.", "success");
      setArchiveModalTermId(null);
      setNote("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not archive term.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnarchive(termId: number) {
    const ok = await confirm({
      title: "Unarchive term?",
      message:
        "This is a safety valve for an accidental archive, not a routine action. The term's scores, remarks and enrollments become editable again. This will be recorded in the system log.",
      confirmLabel: "Unarchive",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await ArchiveService.unarchiveTerm(termId, currentUser, "Unarchived from Archives screen");
      showToast("Term unarchived.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not unarchive term.", "error");
    }
  }

  async function runComparison() {
    if (compareYearIds.length < 2) {
      showToast("Select at least two academic years to compare.", "error");
      return;
    }
    setComparing(true);
    try {
      setComparison(await compareAcademicYears(compareYearIds));
    } finally {
      setComparing(false);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Archives" }]} />
      <PageHeader
        title="Archives"
        description="Permanently preserved historical terms - browse, reprint and compare past academic years"
      />

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
            Browse terms
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}>
            Compare academic years
          </button>
        </li>
      </ul>

      {tab === "browse" && (
        <Card>
          {!terms ? (
            <LoadingSpinner />
          ) : terms.length === 0 ? (
            <EmptyState
              icon="bi-archive"
              title="No terms yet"
              message="Terms will appear here once configured under Terms. A term can be archived once its report cards are complete."
            />
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Academic Year</th>
                    <th>Status</th>
                    <th>Archived</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...terms]
                    .sort((a, b) => b.openingDate.localeCompare(a.openingDate))
                    .map((term) => {
                      const archived = archivedTermIds.has(term.id!);
                      const archiveRow = archives?.find((a) => a.termId === term.id);
                      return (
                        <tr key={term.id}>
                          <td>{term.termName}</td>
                          <td>{yearLabel(term.academicYearId)}</td>
                          <td>
                            {archived ? (
                              <span className="badge text-bg-secondary">Archived / Locked</span>
                            ) : term.isActive ? (
                              <span className="badge text-bg-success">Active</span>
                            ) : (
                              <span className="badge text-bg-light border">Open</span>
                            )}
                          </td>
                          <td className="small text-muted">
                            {archiveRow ? (
                              <>
                                {new Date(archiveRow.archivedAt).toLocaleDateString()} by {archiveRow.archivedBy}
                                <br />
                                {archiveRow.studentCount} students · {archiveRow.generatedReportCount} reports
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="text-end">
                            <div className="d-flex gap-2 justify-content-end">
                              <Link
                                to={`/archives/${term.id}`}
                                className="btn btn-sm btn-outline-primary"
                              >
                                Browse reports
                              </Link>
                              {archived ? (
                                <button
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleUnarchive(term.id!)}
                                >
                                  Unarchive
                                </button>
                              ) : (
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  onClick={() => setArchiveModalTermId(term.id!)}
                                >
                                  Archive term
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === "compare" && (
        <Card>
          <h2 className="h6 mb-3">Select academic years to compare</h2>
          <div className="row g-2 mb-3">
            {(years ?? []).map((y) => (
              <div className="col-auto" key={y.id}>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`year-${y.id}`}
                    checked={compareYearIds.includes(y.id!)}
                    onChange={(e) => {
                      setCompareYearIds((prev) =>
                        e.target.checked ? [...prev, y.id!] : prev.filter((id) => id !== y.id),
                      );
                    }}
                  />
                  <label className="form-check-label" htmlFor={`year-${y.id}`}>
                    {y.label}
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-sm mb-4" onClick={runComparison} disabled={comparing}>
            {comparing ? "Comparing…" : "Compare"}
          </button>

          {comparison && (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Academic Year</th>
                    <th>Students</th>
                    <th>Average score</th>
                    <th>Pass rate</th>
                    <th>Promoted</th>
                    <th>Repeated</th>
                    <th>Transferred</th>
                    <th>Graduated</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.academicYearId}>
                      <td className="fw-semibold">{row.label}</td>
                      <td>{row.studentCount}</td>
                      <td>{row.averageScore}</td>
                      <td>{row.passRatePct}%</td>
                      <td>{row.promotions.PROMOTED}</td>
                      <td>{row.promotions.REPEATED}</td>
                      <td>{row.promotions.TRANSFERRED}</td>
                      <td>{row.promotions.GRADUATED}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal
        title="Archive this term?"
        isOpen={archiveModalTermId !== null}
        onClose={() => setArchiveModalTermId(null)}
      >
        <p className="text-muted">
          This permanently locks the term: scores, KG ratings, remarks/attendance, class assignments and
          finalized-assessment reopening will no longer be possible for this term. Report cards can still be
          viewed and reprinted at any time. This is intended for a term whose report cards are complete.
        </p>
        <div className="mb-3">
          <label className="form-label small">Note (optional)</label>
          <textarea className="form-control" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="d-flex justify-content-end gap-2">
          <button className="btn btn-outline-secondary" onClick={() => setArchiveModalTermId(null)}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => archiveModalTermId !== null && handleArchive(archiveModalTermId)}
          >
            {busy ? "Archiving…" : "Archive term"}
          </button>
        </div>
      </Modal>
    </>
  );
}
