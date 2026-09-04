import type { TemplateSettings } from "@models/TemplateSettings";

/** Shared class-teacher / headteacher sign-off block, reused by every
 *  template. Signature title labels come from `TemplateSettings`
 *  (Module 12) so a school can rename them (e.g. "Form Master" instead
 *  of "Class Teacher") without any template code changing. */
export function SignatureBlock({
  settings,
  classTeacherName,
  headTeacherName,
}: {
  settings: TemplateSettings;
  classTeacherName?: string;
  headTeacherName?: string;
}) {
  return (
    <div className="actrs-report-signatures">
      <div className="signature">
        <div className="line">{classTeacherName || " "}</div>
        <div className="text-muted">{settings.signatureTitleClassTeacher}'s Signature</div>
      </div>
      <div className="signature">
        <div className="line">{headTeacherName || " "}</div>
        <div className="text-muted">{settings.signatureTitleHeadTeacher}'s Signature</div>
      </div>
    </div>
  );
}
