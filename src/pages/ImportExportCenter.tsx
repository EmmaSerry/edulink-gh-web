import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Breadcrumb } from "@components/Breadcrumb";
import { Card } from "@components/Card";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import { TermService } from "@services/TermService";
import { ClassService } from "@services/ClassService";
import { ImportWizard } from "@pages/students/ImportWizard";
import { ConfigImportPanel } from "@pages/importexport/ConfigImportPanel";
import { CenterExportService } from "@services/CenterExportService";
import type { ConfigEntityKey } from "@services/ConfigImportExportService";
import type { ExportFileFormat } from "@services/ExportService";

type MainTab = "import" | "export" | "history";
const CONFIG_ENTITIES: ConfigEntityKey[] = ["subjects", "learningAreas", "skills", "remarksBank"];

export function ImportExportCenter() {
  const [tab, setTab] = useState<MainTab>("import");
  const { showToast } = useToast();
  const { name: currentUser } = useCurrentUser();

  const [studentWizardOpen, setStudentWizardOpen] = useState(false);
  const [configEntity, setConfigEntity] = useState<ConfigEntityKey | null>(null);

  const terms = useLiveQuery(() => TermService.getAll(), []);
  const classes = useLiveQuery(() => ClassService.getAll(), []);
  const exportHistory = useLiveQuery(() => CenterExportService.getHistory(), [tab]);

  const [assessmentTermId, setAssessmentTermId] = useState(0);
  const [assessmentClassId, setAssessmentClassId] = useState(0);
  const [reportsTermId, setReportsTermId] = useState(0);
  const [statsTermId, setStatsTermId] = useState(0);
  const [format, setFormat] = useState<ExportFileFormat>("xlsx");
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<number | void>) {
    setBusy(key);
    try {
      const count = await fn();
      showToast(typeof count === "number" ? `Exported ${count} record(s).` : "Export complete.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Export failed.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Import & Export Centre" }]} />
      <PageHeader
        title="Import & Export Centre"
        description="Bring data in and take data out, all in one place - offline, with validation and error reporting"
      />

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button className={`nav-link ${tab === "import" ? "active" : ""}`} onClick={() => setTab("import")}>
            Import
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "export" ? "active" : ""}`} onClick={() => setTab("export")}>
            Export
          </button>
        </li>
        <li className="nav-item">
          <button className={`nav-link ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
            Export history
          </button>
        </li>
      </ul>

      {tab === "import" && (
        <div className="row g-4">
          <div className="col-md-4">
            <Card className="h-100">
              <h2 className="h6">Students</h2>
              <p className="text-muted small">Bulk-register students with guardians and class assignment.</p>
              <button className="btn btn-sm btn-primary" onClick={() => setStudentWizardOpen(true)}>
                Import students
              </button>
            </Card>
          </div>
          {CONFIG_ENTITIES.map((entity) => (
            <div className="col-md-4" key={entity}>
              <Card className="h-100">
                <h2 className="h6 text-capitalize">{entity.replace(/([A-Z])/g, " $1")}</h2>
                <p className="text-muted small">Bulk-import from a spreadsheet, with a downloadable template and per-row validation.</p>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setConfigEntity(entity)}>
                  Import {entity === "remarksBank" ? "Remarks Bank" : entity === "learningAreas" ? "Learning Areas" : entity}
                </button>
              </Card>
            </div>
          ))}
        </div>
      )}

      {tab === "export" && (
        <div className="row g-4">
          <div className="col-md-6">
            <Card>
              <h2 className="h6">Configuration</h2>
              <p className="text-muted small">School profile, academic structure, subjects, learning areas, skills, remarks and settings.</p>
              <div className="d-flex gap-2 align-items-end">
                <select className="form-select form-select-sm" style={{ maxWidth: 140 }} value={format} onChange={(e) => setFormat(e.target.value as ExportFileFormat)}>
                  <option value="xlsx">Excel</option>
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>
                <button
                  className="btn btn-sm btn-outline-primary"
                  disabled={busy === "config"}
                  onClick={() => run("config", () => CenterExportService.exportConfiguration(format, currentUser))}
                >
                  {busy === "config" ? "Exporting…" : "Export"}
                </button>
              </div>
            </Card>
          </div>

          <div className="col-md-6">
            <Card>
              <h2 className="h6">Archives</h2>
              <p className="text-muted small">Index of every archived (closed) term, with counts.</p>
              <div className="d-flex gap-2 align-items-end">
                <button
                  className="btn btn-sm btn-outline-primary"
                  disabled={busy === "archives"}
                  onClick={() => run("archives", () => CenterExportService.exportArchives(format, currentUser))}
                >
                  {busy === "archives" ? "Exporting…" : "Export archives index"}
                </button>
              </div>
            </Card>
          </div>

          <div className="col-md-6">
            <Card>
              <h2 className="h6">Assessment sheet</h2>
              <p className="text-muted small">SBA / Exam / Total / Grade for every subject, for one class and term.</p>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <select className="form-select form-select-sm" value={assessmentTermId} onChange={(e) => setAssessmentTermId(Number(e.target.value))}>
                    <option value={0}>Select term…</option>
                    {(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.termName}</option>)}
                  </select>
                </div>
                <div className="col-6">
                  <select className="form-select form-select-sm" value={assessmentClassId} onChange={(e) => setAssessmentClassId(Number(e.target.value))}>
                    <option value={0}>Select class…</option>
                    {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <button
                className="btn btn-sm btn-outline-primary"
                disabled={!assessmentTermId || !assessmentClassId || busy === "assessment"}
                onClick={() => run("assessment", () => CenterExportService.exportAssessmentSheet(assessmentClassId, assessmentTermId, format, currentUser))}
              >
                {busy === "assessment" ? "Exporting…" : "Export"}
              </button>
            </Card>
          </div>

          <div className="col-md-6">
            <Card>
              <h2 className="h6">Reports (metadata list)</h2>
              <p className="text-muted small">Which report cards have been generated for a term, versions and print/export counts.</p>
              <select className="form-select form-select-sm mb-2" value={reportsTermId} onChange={(e) => setReportsTermId(Number(e.target.value))}>
                <option value={0}>Select term…</option>
                {(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.termName}</option>)}
              </select>
              <button
                className="btn btn-sm btn-outline-primary"
                disabled={!reportsTermId || busy === "reports"}
                onClick={() => run("reports", () => CenterExportService.exportReportsList(reportsTermId, format, currentUser))}
              >
                {busy === "reports" ? "Exporting…" : "Export"}
              </button>
            </Card>
          </div>

          <div className="col-md-6">
            <Card>
              <h2 className="h6">Statistics</h2>
              <p className="text-muted small">Subject/class averages, grade-band distribution and pass rate for a term.</p>
              <select className="form-select form-select-sm mb-2" value={statsTermId} onChange={(e) => setStatsTermId(Number(e.target.value))}>
                <option value={0}>Select term…</option>
                {(terms ?? []).map((t) => <option key={t.id} value={t.id}>{t.termName}</option>)}
              </select>
              <button
                className="btn btn-sm btn-outline-primary"
                disabled={!statsTermId || busy === "stats"}
                onClick={() => run("stats", () => CenterExportService.exportStatistics(statsTermId, format, currentUser))}
              >
                {busy === "stats" ? "Exporting…" : "Export"}
              </button>
            </Card>
          </div>

          <div className="col-md-6">
            <Card>
              <h2 className="h6">Student list</h2>
              <p className="text-muted small">Full student roster export - see the Students page for level/class-scoped export.</p>
              <button
                className="btn btn-sm btn-outline-primary"
                disabled={busy === "students"}
                onClick={() => run("students", () => CenterExportService.exportStudents({ type: "all" }, format, currentUser))}
              >
                {busy === "students" ? "Exporting…" : "Export all students"}
              </button>
            </Card>
          </div>
        </div>
      )}

      {tab === "history" && (
        <Card>
          {!exportHistory ? (
            <LoadingSpinner />
          ) : exportHistory.length === 0 ? (
            <p className="text-muted mb-0">No exports yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>File</th>
                    <th>Format</th>
                    <th>Records</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {exportHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="small">{new Date(h.performedAt).toLocaleString()}</td>
                      <td className="text-capitalize">{h.exportType}</td>
                      <td className="small">{h.fileName}</td>
                      <td className="text-uppercase small">{h.format}</td>
                      <td>{h.recordCount}</td>
                      <td className="small">{h.performedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <ImportWizard isOpen={studentWizardOpen} onClose={() => setStudentWizardOpen(false)} />
      {configEntity && <ConfigImportPanel entity={configEntity} onClose={() => setConfigEntity(null)} />}
    </>
  );
}
