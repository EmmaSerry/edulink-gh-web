import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { TermService } from "@services/TermService";
import {
  ImportService,
  REQUIRED_IMPORT_FIELDS,
  FIELD_LABELS,
  type ColumnMapping,
  type ParsedSheet,
  type ValidationResult,
} from "@services/ImportService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type Step = "upload" | "map" | "review" | "done";

/** Module 7 - Bulk Import wizard: upload -> map columns -> preview &
 *  validate -> commit only the valid rows. */
export function ImportWizard({ isOpen, onClose, onImported }: Props) {
  const { showToast } = useToast();
  const terms = useLiveQuery(() => TermService.getAll(), []);
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<ParsedSheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [termId, setTermId] = useState(0);
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null);

  // Default to the currently active term, same as Student Registration
  // and the "Assign class" tool - previously this started unselected,
  // so it was easy to pick a different term than the one everything
  // else defaults to without noticing, leaving newly imported students
  // enrolled in a term the Assessment Dashboard isn't currently showing
  // (it also defaults to the active term) even though the import itself
  // reported success. Only sets it once terms have loaded, and only if
  // the user hasn't already picked something.
  useEffect(() => {
    if (termId === 0 && terms && terms.length > 0) {
      const active = terms.find((t) => t.isActive);
      if (active?.id) setTermId(active.id);
    }
  }, [terms, termId]);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setSheet(null);
    setMapping({});
    setValidation(null);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onFileChange = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await ImportService.parseFile(file);
      setFileName(file.name);
      setSheet(parsed);
      setMapping(ImportService.autoMapColumns(parsed.headers));
      setStep("map");
    } catch (err) {
      console.error(err);
      showToast("Could not read that file. Please upload a valid .xlsx or .csv file.", "error");
    } finally {
      setBusy(false);
    }
  };

  const runValidation = async () => {
    if (!sheet) return;
    setBusy(true);
    try {
      const result = await ImportService.validateRows(sheet.rows, mapping);
      setValidation(result);
      setStep("review");
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!validation || !termId) {
      showToast("Select the term these students should be enrolled in.", "error");
      return;
    }
    setBusy(true);
    try {
      const log = await ImportService.commitImport(fileName, validation.validRows, termId);
      setResult({ success: log.successCount, errors: log.errorCount });
      setStep("done");
      onImported?.();
    } catch (err) {
      console.error(err);
      showToast("Import failed. Please try again.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import students" isOpen={isOpen} onClose={handleClose} size="lg">
      {busy && <LoadingSpinner label="Working…" />}

      {!busy && step === "upload" && (
        <div>
          <p className="text-muted small">
            Upload an Excel (.xlsx) or CSV file. The first row must contain column headers - the wizard will
            try to match them to system fields automatically, and you can adjust the mapping on the next step.
          </p>
          <div className="d-flex align-items-center justify-content-between actrs-card p-3 mb-3">
            <div>
              <div className="fw-semibold small">New to bulk import?</div>
              <div className="text-muted small">
                Download a ready-to-fill spreadsheet with just the required columns and an example row.
              </div>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm text-nowrap ms-3"
              onClick={() => ImportService.generateTemplate()}
            >
              <i className="bi bi-download me-1" />
              Download template
            </button>
          </div>
          <FormField label="File">
            <input
              type="file"
              accept=".xlsx,.csv"
              className="form-control"
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
          </FormField>
        </div>
      )}

      {!busy && step === "map" && sheet && (
        <div>
          <p className="text-muted small">
            Confirm which spreadsheet column maps to each system field. Required fields are marked with *.
          </p>
          <div className="row">
            {Object.keys(FIELD_LABELS).map((field) => (
              <div className="col-md-6" key={field}>
                <FormField label={FIELD_LABELS[field] + (REQUIRED_IMPORT_FIELDS.includes(field as any) ? " *" : "")}>
                  <select
                    className="form-select form-select-sm"
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || null }))}
                  >
                    <option value="">Not mapped</option>
                    {sheet.headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            ))}
          </div>
          <div className="d-flex justify-content-between">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setStep("upload")}>Back</button>
            <button className="btn btn-primary btn-sm" onClick={runValidation}>Preview &amp; validate</button>
          </div>
        </div>
      )}

      {!busy && step === "review" && validation && (
        <div>
          <div className="d-flex gap-3 mb-3">
            <span className="badge text-bg-success">{validation.validRows.length} valid</span>
            <span className="badge text-bg-danger">{validation.invalidRows.length} with errors</span>
            <span className="badge text-bg-warning">{validation.duplicateCount} duplicates</span>
          </div>

          {validation.invalidRows.length > 0 && (
            <div className="mb-3" style={{ maxHeight: 220, overflowY: "auto" }}>
              <table className="table table-sm">
                <thead><tr><th>Row</th><th>Errors</th></tr></thead>
                <tbody>
                  {validation.invalidRows.map((r) => (
                    <tr key={r.rowNumber}>
                      <td>{r.rowNumber}</td>
                      <td className="text-danger small">{r.errors.join("; ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <FormField label="Enroll all valid students into term" required hint="Only used for rows that don't already fail validation">
            <select className="form-select" value={termId} onChange={(e) => setTermId(Number(e.target.value))}>
              <option value={0}>Select…</option>
              {terms?.map((t) => (
                <option key={t.id} value={t.id}>{t.termName}{t.isActive ? " (active)" : ""}</option>
              ))}
            </select>
          </FormField>

          <div className="d-flex justify-content-between">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setStep("map")}>Back</button>
            <button
              className="btn btn-primary btn-sm"
              disabled={validation.validRows.length === 0}
              onClick={commit}
            >
              Import {validation.validRows.length} valid record(s)
            </button>
          </div>
        </div>
      )}

      {!busy && step === "done" && result && (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2rem" }} />
          <h2 className="h6 mt-3">Import complete</h2>
          <p className="text-muted">
            {result.success} student(s) imported successfully
            {result.errors > 0 ? `, ${result.errors} row(s) failed at commit time.` : "."}
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}
