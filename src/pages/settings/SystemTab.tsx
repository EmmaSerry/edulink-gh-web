import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { Card } from "@components/Card";
import { FormField } from "@components/FormField";
import { LoadingSpinner } from "@components/LoadingSpinner";
import { useToast } from "@contexts/ToastContext";
import { SettingsService } from "@services/SettingsService";
import { systemSettingsSchema, type SystemSettingsFormValues } from "@validation/settingsSchema";

export function SystemTab() {
  const settings = useLiveQuery(() => SettingsService.get(), []);
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SystemSettingsFormValues>({ resolver: zodResolver(systemSettingsSchema) });

  useEffect(() => {
    if (settings) reset(settings);
  }, [settings, reset]);

  if (!settings) return <LoadingSpinner />;

  const onSubmit = async (values: SystemSettingsFormValues) => {
    setSaving(true);
    try {
      // The form only covers general/report/assessment/backup - the
      // studentId section (prefix/sequence) is deliberately not exposed
      // here, since changing it after IDs have already been issued could
      // break uniqueness. Merge the edited sections over the existing
      // full settings record so `studentId` is always carried forward
      // unchanged, and SettingsService.save() - which requires the
      // complete SystemSettings shape - always gets a complete object.
      await SettingsService.save({ ...settings, ...values });
      showToast("Settings saved.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not save settings.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="row g-4">
        <div className="col-md-6">
          <Card className="mb-4">
            <h2 className="h6 mb-3">General</h2>
            <FormField label="Application name" required error={errors.general?.applicationName?.message}>
              <input className="form-control" {...register("general.applicationName")} />
            </FormField>
            <FormField label="Version" required error={errors.general?.version?.message}>
              <input className="form-control" {...register("general.version")} />
            </FormField>
            <FormField label="Default language" required error={errors.general?.defaultLanguage?.message}>
              <input className="form-control" {...register("general.defaultLanguage")} />
            </FormField>
            <FormField label="Date format" required error={errors.general?.dateFormat?.message}>
              <select className="form-select" {...register("general.dateFormat")}>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </FormField>
          </Card>

          <Card>
            <h2 className="h6 mb-3">Assessment</h2>
            <div className="form-check mb-2">
              <input className="form-check-input" type="checkbox" id="enableRanking" {...register("assessment.enableRanking")} />
              <label className="form-check-label small" htmlFor="enableRanking">Enable ranking</label>
            </div>
            <div className="form-check mb-2">
              <input className="form-check-input" type="checkbox" id="autoTotals" {...register("assessment.autoCalculateTotals")} />
              <label className="form-check-label small" htmlFor="autoTotals">Auto-calculate totals</label>
            </div>
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="autoPositions" {...register("assessment.autoGeneratePositions")} />
              <label className="form-check-label small" htmlFor="autoPositions">Auto-generate positions</label>
            </div>
          </Card>
        </div>

        <div className="col-md-6">
          <Card className="mb-4">
            <h2 className="h6 mb-3">Report Settings</h2>
            <div className="row">
              <div className="col-6">
                <FormField label="Paper size" required error={errors.report?.paperSize?.message}>
                  <select className="form-select" {...register("report.paperSize")}>
                    <option value="A4">A4</option>
                    <option value="Letter">Letter</option>
                  </select>
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Orientation" required error={errors.report?.orientation?.message}>
                  <select className="form-select" {...register("report.orientation")}>
                    <option value="Portrait">Portrait</option>
                    <option value="Landscape">Landscape</option>
                  </select>
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Margins (mm)" required error={errors.report?.marginMm?.message}>
                  <input type="number" className="form-control" {...register("report.marginMm", { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="col-6">
                <FormField label="Font size (pt)" required error={errors.report?.fontSizePt?.message}>
                  <input type="number" className="form-control" {...register("report.fontSizePt", { valueAsNumber: true })} />
                </FormField>
              </div>
              <div className="col-12">
                <FormField label="Font family" required error={errors.report?.fontFamily?.message}>
                  <input className="form-control" {...register("report.fontFamily")} />
                </FormField>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="h6 mb-3">Backup</h2>
            <div className="form-check mb-2">
              <input className="form-check-input" type="checkbox" id="backupReminder" {...register("backup.backupReminderEnabled")} />
              <label className="form-check-label small" htmlFor="backupReminder">Enable backup reminders</label>
            </div>
            <FormField label="Auto-backup frequency (days)" required error={errors.backup?.autoBackupFrequencyDays?.message}>
              <input type="number" className="form-control" {...register("backup.autoBackupFrequencyDays", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Export format" required error={errors.backup?.exportFormat?.message}>
              <select className="form-select" {...register("backup.exportFormat")}>
                <option value="JSON">JSON</option>
                <option value="XLSX">XLSX</option>
              </select>
            </FormField>
          </Card>
        </div>
      </div>

      <button type="submit" className="btn btn-primary mt-4" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
