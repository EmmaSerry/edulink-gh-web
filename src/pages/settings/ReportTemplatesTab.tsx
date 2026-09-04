import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "@components/Card";
import { FormField } from "@components/FormField";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { TemplateSettingsService } from "@services/TemplateSettingsService";
import { ReportTemplateService } from "@services/ReportTemplateService";
import { LevelService } from "@services/LevelService";
import { templateSettingsSchema, type TemplateSettingsFormValues } from "@validation/templateSettingsSchema";
import type { ReportTemplateCode } from "@models/ReportTemplate";

/**
 * Module 12 - Report Customization, plus the Module 2 admin control for
 * (re)assigning a Level to a report template. Everything here writes to
 * `TemplateSettings` / `ReportTemplate.appliesToLevelIds` - never to a
 * template's rendering code - which is what "apply automatically to all
 * generated reports" and "future templates easily added without
 * changing application logic" mean in practice (see
 * docs/PHASE4_REPORTS.md).
 */
export function ReportTemplatesTab() {
  const settings = useLiveQuery(() => TemplateSettingsService.get(), []);
  const templates = useLiveQuery(() => ReportTemplateService.getAll(), []);
  const levels = useLiveQuery(() => LevelService.getAll(), []);
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TemplateSettingsFormValues>({ resolver: zodResolver(templateSettingsSchema) });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  async function onSubmit(values: TemplateSettingsFormValues) {
    setSaving(true);
    try {
      await TemplateSettingsService.save(values);
      showToast("Report appearance settings saved.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not save report settings.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReassign(levelId: number, code: ReportTemplateCode) {
    try {
      await ReportTemplateService.assignLevelToTemplate(levelId, code);
      showToast("Template assignment updated.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not update the template assignment.", "error");
    }
  }

  if (!settings || !templates || !levels) return <LoadingSpinner />;

  return (
    <div className="row g-4">
      <div className="col-lg-7">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="mb-4">
            <h2 className="h6 mb-3">Report appearance</h2>
            <div className="row">
              <div className="col-6">
                <FormField label="Paper size" required error={errors.paperSize?.message}>
                  <select className="form-select" {...register("paperSize")}>
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                  </select>
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Orientation" required error={errors.orientation?.message}>
                  <select className="form-select" {...register("orientation")}>
                    <option value="Portrait">Portrait</option>
                    <option value="Landscape">Landscape</option>
                  </select>
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Margins (mm)" required error={errors.marginMm?.message}>
                  <input type="number" className="form-control" {...register("marginMm", { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Font size (pt)" required error={errors.fontSizePt?.message}>
                  <input type="number" className="form-control" {...register("fontSizePt", { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="col-12">
                <FormField label="Font family" required error={errors.fontFamily?.message}>
                  <input className="form-control" {...register("fontFamily")} />
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Primary colour" required error={errors.primaryColorHex?.message}>
                  <input type="color" className="form-control form-control-color" {...register("primaryColorHex")} />
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Secondary colour" required error={errors.secondaryColorHex?.message}>
                  <input type="color" className="form-control form-control-color" {...register("secondaryColorHex")} />
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Class teacher signature title" required error={errors.signatureTitleClassTeacher?.message}>
                  <input className="form-control" {...register("signatureTitleClassTeacher")} />
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Headteacher signature title" required error={errors.signatureTitleHeadTeacher?.message}>
                  <input className="form-control" {...register("signatureTitleHeadTeacher")} />
                </FormField>
              </div>
              <div className="col-12">
                <div className="form-check mb-2">
                  <input className="form-check-input" type="checkbox" id="showWatermark" {...register("showWatermark")} />
                  <label className="form-check-label small" htmlFor="showWatermark">
                    Show watermark (uses the School Setup watermark image)
                  </label>
                </div>
                <FormField label="Watermark opacity" error={errors.watermarkOpacity?.message}>
                  <input type="number" step="0.01" className="form-control" {...register("watermarkOpacity", { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="col-12">
                <FormField label="Batch PDF export (Module 9)" error={errors.batchPdfMode?.message}>
                  <select className="form-select" {...register("batchPdfMode")}>
                    <option value="individual">One PDF file per student</option>
                    <option value="single">One combined multi-page PDF</option>
                  </select>
                </FormField>
              </div>
            </div>
          </Card>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save report appearance"}
          </button>
        </form>
      </div>

      <div className="col-lg-5">
        <Card>
          <h2 className="h6 mb-1">Level → Template assignment</h2>
          <p className="text-muted small mb-3">
            Which report layout each level uses. A new or renamed level can be pointed at any existing template of the
            matching assessment mode - no code change required.
          </p>
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Level</th>
                <th>Template</th>
              </tr>
            </thead>
            <tbody>
              {levels
                .filter((l) => l.isActive)
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((level) => {
                  const current = templates.find((t) => t.appliesToLevelIds.includes(level.id!));
                  const options = templates.filter((t) => t.assessmentMode === level.assessmentMode);
                  return (
                    <tr key={level.id}>
                      <td>{level.name}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          value={current?.code ?? ""}
                          onChange={(e) => handleReassign(level.id!, e.target.value as ReportTemplateCode)}
                        >
                          <option value="" disabled>
                            Unassigned
                          </option>
                          {options.map((t) => (
                            <option key={t.code} value={t.code}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
