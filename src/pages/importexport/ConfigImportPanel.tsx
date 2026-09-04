import { useState } from "react";
import { Modal } from "@components/Modal";
import { FormField } from "@components/FormField";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { useCurrentUser } from "@hooks/useCurrentUser";
import {
  ConfigImportExportService,
  CONFIG_ENTITY_LABELS,
  CONFIG_ENTITY_TEMPLATE_HEADERS,
  type ConfigEntityKey,
  type ConfigValidationResult,
} from "@services/ConfigImportExportService";

interface Props {
  entity: ConfigEntityKey;
  onClose: () => void;
}

type Step = "upload" | "review" | "done";

/** Module 3 - the shared import flow for Subjects/Learning Areas/
 *  Skills/Remarks Bank: upload -> validate against fixed expected
 *  headers -> commit only the valid rows. Simpler than the Student
 *  wizard's column-mapping step (see ConfigImportExportService.ts's
 *  doc comment for why that tradeoff is appropriate here). */
export function ConfigImportPanel({ entity, onClose }: Props) {
  const { showToast } = useToast();
  const { name: currentUser } = useCurrentUser();
  const [step, setStep] = useState<Step>("upload");
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ConfigValidationResult | null>(null);
  const [result, setResult] = useState<number | null>(null);

  async function onFileChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const { rows } = await ConfigImportExportService.parseFile(file);
      const validated = await ConfigImportExportService.validateRows(entity, rows);
      setValidation(validated);
      setStep("review");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not read that file.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (!validation) return;
    setBusy(true);
    try {
      const count = await ConfigImportExportService.commitImport(entity, validation.validRows, currentUser);
      setResult(count);
      setStep("done");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Import failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Import ${CONFIG_ENTITY_LABELS[entity]}`} isOpen onClose={onClose} size="lg">
      {busy && <LoadingSpinner label="Working…" />}

      {!busy && step === "upload" && (
        <div>
          <p className="text-muted small">
            Expected columns: <strong>{CONFIG_ENTITY_TEMPLATE_HEADERS[entity].join(", ")}</strong>.
          </p>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary mb-3"
            onClick={() => ConfigImportExportService.downloadTemplate(entity)}
          >
            <i className="bi bi-download me-1" /> Download template
          </button>
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

      {!busy && step === "review" && validation && (
        <div>
          <div className="d-flex gap-3 mb-3">
            <span className="badge text-bg-success">{validation.validRows.length} valid</span>
            <span className="badge text-bg-danger">{validation.invalidRows.length} with errors</span>
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

          <div className="d-flex justify-content-between">
            <button className="btn btn-outline-secondary btn-sm" onClick={() => setStep("upload")}>Back</button>
            <button className="btn btn-primary btn-sm" disabled={validation.validRows.length === 0} onClick={commit}>
              Import {validation.validRows.length} valid record(s)
            </button>
          </div>
        </div>
      )}

      {!busy && step === "done" && result !== null && (
        <div className="text-center py-3">
          <i className="bi bi-check-circle-fill text-success" style={{ fontSize: "2rem" }} />
          <h2 className="h6 mt-3">Import complete</h2>
          <p className="text-muted">{result} record(s) imported successfully.</p>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}
