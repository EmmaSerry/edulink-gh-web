import type { CSSProperties, ReactNode } from "react";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { ReportSnapshotSchoolInfo } from "./ReportSnapshot.types";
import "@styles/report-print.css";

interface Props {
  settings: TemplateSettings;
  school: ReportSnapshotSchoolInfo;
  children: ReactNode;
  /** Distinguishes each page in a multi-page batch PDF/print run so
   *  `page-break-after` in report-print.css only fires between reports,
   *  never after the very last one. */
  isLastPage?: boolean;
}

/**
 * The one shared page wrapper every template (KG, Lower Primary, Upper
 * Primary, JHS) renders through. Paper size, orientation, margins, font and
 * colours all come from `TemplateSettings`, so an administrator's changes
 * apply automatically everywhere without touching any template component.
 *
 * Redesign: every page now sits inside a decorative double-line frame with
 * corner studs, drawn in the school's own two brand colours. The frame is
 * purely visual - it never affects the content area or the print pipeline.
 */
export function ReportPage({ settings, school, children, isLastPage = true }: Props) {
  const style: CSSProperties & Record<string, string> = {
    "--report-primary": settings.primaryColorHex,
    "--report-secondary": settings.secondaryColorHex,
    "--report-font": settings.fontFamily,
    "--report-font-size": `${settings.fontSizePt}pt`,
    "--report-margin": `${settings.marginMm}mm`,
  };

  const classes = [
    "actrs-report-page",
    settings.paperSize === "Letter" ? "paper-letter" : "",
    settings.orientation === "Landscape" ? "orientation-landscape" : "",
    isLastPage ? "is-last-page" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      <div className="actrs-report-frame" aria-hidden="true">
        <i className="stud tl" />
        <i className="stud tr" />
        <i className="stud bl" />
        <i className="stud br" />
      </div>
      {settings.showWatermark && school.reportWatermarkDataUrl && (
        <div className="actrs-report-watermark" style={{ opacity: settings.watermarkOpacity }}>
          <img src={school.reportWatermarkDataUrl} alt="" />
        </div>
      )}
      <div className="actrs-report-content">{children}</div>
    </div>
  );
}
