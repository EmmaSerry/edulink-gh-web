import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLiveQuery } from "dexie-react-hooks";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { FormField } from "@components/FormField";
import { Breadcrumb } from "@components/Breadcrumb";
import { useToast } from "@contexts/ToastContext";
import { SchoolService } from "@services/SchoolService";
import { schoolSchema, type SchoolFormValues } from "@validation/schoolSchema";

const EMPTY_VALUES: SchoolFormValues = {
  name: "",
  schoolCode: "",
  circuit: "",
  district: "",
  region: "",
  postalAddress: "",
  digitalAddress: "",
  physicalAddress: "",
  telephone: "",
  alternativeTelephone: "",
  email: "",
  website: "",
  headTeacherName: "",
  headTeacherPhone: "",
  assistantHeadTeacherName: "",
  assistantHeadTeacherPhone: "",
  motto: "",
  vision: "",
  mission: "",
  reportHeader: "",
  reportFooter: "",
  officialSignatoryTitles: "",
};

export function SchoolSetup() {
  const { showToast } = useToast();
  const profile = useLiveQuery(() => SchoolService.getProfile(), []);
  const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(schoolSchema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (profile) {
      reset({ ...EMPTY_VALUES, ...profile });
      setLogoDataUrl(profile.logoDataUrl);
    }
  }, [profile, reset]);

  const onLogoChange = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: SchoolFormValues) => {
    setSaving(true);
    try {
      await SchoolService.saveProfile({ ...values, logoDataUrl });
      showToast("School profile saved successfully.", "success");
    } catch (err) {
      console.error(err);
      showToast("Could not save the school profile. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Breadcrumb items={[{ label: "School Setup" }]} />
      <PageHeader
        title="School Setup"
        description="The school's profile, branding and report information - used across every generated report card."
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="row g-4">
          <div className="col-lg-8">
            <Card className="mb-4">
              <h2 className="h6 mb-3">School information</h2>
              <div className="row">
                <div className="col-md-6">
                  <FormField label="School name" required error={errors.name?.message}>
                    <input className="form-control" {...register("name")} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label="School code" required error={errors.schoolCode?.message}>
                    <input className="form-control" {...register("schoolCode")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Circuit" required error={errors.circuit?.message}>
                    <input className="form-control" {...register("circuit")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="District" required error={errors.district?.message}>
                    <input className="form-control" {...register("district")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Region" required error={errors.region?.message}>
                    <input className="form-control" {...register("region")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Postal address" error={errors.postalAddress?.message}>
                    <input className="form-control" {...register("postalAddress")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Digital address (GPS)" error={errors.digitalAddress?.message}>
                    <input className="form-control" {...register("digitalAddress")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Physical address" error={errors.physicalAddress?.message}>
                    <input className="form-control" {...register("physicalAddress")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Telephone" error={errors.telephone?.message}>
                    <input className="form-control" {...register("telephone")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Alternative telephone" error={errors.alternativeTelephone?.message}>
                    <input className="form-control" {...register("alternativeTelephone")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Email" error={errors.email?.message}>
                    <input className="form-control" type="email" {...register("email")} />
                  </FormField>
                </div>
                <div className="col-md-4">
                  <FormField label="Website (optional)" error={errors.website?.message}>
                    <input className="form-control" {...register("website")} />
                  </FormField>
                </div>
              </div>
            </Card>

            <Card className="mb-4">
              <h2 className="h6 mb-3">Administrative information</h2>
              <div className="row">
                <div className="col-md-6">
                  <FormField label="Headteacher name" error={errors.headTeacherName?.message}>
                    <input className="form-control" {...register("headTeacherName")} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label="Headteacher phone" error={errors.headTeacherPhone?.message}>
                    <input className="form-control" {...register("headTeacherPhone")} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label="Assistant headteacher" error={errors.assistantHeadTeacherName?.message}>
                    <input className="form-control" {...register("assistantHeadTeacherName")} />
                  </FormField>
                </div>
                <div className="col-md-6">
                  <FormField label="Assistant headteacher phone" error={errors.assistantHeadTeacherPhone?.message}>
                    <input className="form-control" {...register("assistantHeadTeacherPhone")} />
                  </FormField>
                </div>
              </div>
            </Card>

            <Card className="mb-4">
              <h2 className="h6 mb-3">Report information</h2>
              <FormField label="Report header" error={errors.reportHeader?.message}>
                <textarea className="form-control" rows={2} {...register("reportHeader")} />
              </FormField>
              <FormField label="Report footer" error={errors.reportFooter?.message}>
                <textarea className="form-control" rows={2} {...register("reportFooter")} />
              </FormField>
              <FormField
                label="Official signatory titles"
                hint="e.g. Class Teacher, Headteacher"
                error={errors.officialSignatoryTitles?.message}
              >
                <input className="form-control" {...register("officialSignatoryTitles")} />
              </FormField>
            </Card>
          </div>

          <div className="col-lg-4">
            <Card className="mb-4">
              <h2 className="h6 mb-3">Branding</h2>
              <FormField label="School logo">
                <input
                  type="file"
                  accept="image/*"
                  className="form-control"
                  onChange={(e) => onLogoChange(e.target.files?.[0] ?? null)}
                />
              </FormField>
              {logoDataUrl && (
                <img
                  src={logoDataUrl}
                  alt="School logo preview"
                  className="img-fluid rounded border mb-3"
                  style={{ maxHeight: 120 }}
                />
              )}
              <FormField label="School motto" error={errors.motto?.message}>
                <input className="form-control" {...register("motto")} />
              </FormField>
              <FormField label="School vision" error={errors.vision?.message}>
                <textarea className="form-control" rows={2} {...register("vision")} />
              </FormField>
              <FormField label="School mission" error={errors.mission?.message}>
                <textarea className="form-control" rows={2} {...register("mission")} />
              </FormField>
            </Card>

            <button type="submit" className="btn btn-primary w-100" disabled={saving}>
              {saving ? "Saving…" : "Save school profile"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
