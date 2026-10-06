import type { TemplateSettings } from "@models/TemplateSettings";

/** Shared class-teacher / headteacher sign-off block, reused by every
 *  template. Signature title labels come from `TemplateSettings`
 *  (Module 12) so a school can rename them (e.g. "Form Master" instead
 *  of "Class Teacher") without any template code changing. If the
 *  school uploaded a head teacher specimen signature (Settings ->
 *  Report template), it is printed just above the head teacher line. */
export function SignatureBlock({
  settings,
  classTeacherName,
  headTeacherName,
}: {
  settings: TemplateSettings;
  classTeacherName?: string;
  headTeacherName?: string;
}) {
  const specimen = settings.headTeacherSignatureDataUrl;
  return (
    <div className="actrs-report-signatures">
      <div className="signature">
        <div className="line">{classTeacherName || " "}</div>
        <div className="text-muted">{settings.signatureTitleClassTeacher}'s Signature</div>
      </div>
      <div className="signature">
        {specimen && (
          <div style={{ height: 52, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
            <img src={specimen} alt="" style={{ maxHeight: 50, maxWidth: "100%", objectFit: "contain" }} />
          </div>
        )}
        <div className="line">{headTeacherName || " "}</div>
        <div className="text-muted">{settings.signatureTitleHeadTeacher}'s Signature</div>
      </div>
    </div>
  );
}
