import type { CSSProperties, ReactNode } from "react";
import type { TemplateSettings } from "@models/TemplateSettings";
import type { ReportSnapshotSchoolInfo } from "./ReportSnapshot.types";
import { readableOn, safeHex, shade } from "./colorContrast";
import "@styles/report-print.css";
import "@styles/report-stats.css";

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
 * Text that sits on the school's colours (banner, table header, label pills)
 * is chosen automatically - white or near-black, whichever reads better - so
 * any colour an admin picks stays legible.
 */
export function ReportPage({ settings, school, children, isLastPage = true }: Props) {
  const primary = safeHex(settings.primaryColorHex, "#1f3864");
  const secondary = safeHex(settings.secondaryColorHex, "#2f6fb0");

  // the banner has a 16% darkening layer over the colour gradient
  const onHeader = readableOn(shade(primary, -0.16), shade(secondary, -0.16));
  const onTh = readableOn(primary, secondary);
  const onPrimary = readableOn(primary);

  const style: CSSProperties & Record<string, string> = {
    "--report-primary": primary,
    "--report-secondary": secondary,
    "--report-font": settings.fontFamily,
    "--report-font-size": `${settings.fontSizePt}pt`,
    "--report-margin": `${settings.marginMm}mm`,
    "--on-header": onHeader.text,
    "--on-header-soft": onHeader.muted,
    "--on-header-shadow": onHeader.isLightText ? "0 1px 2px rgba(0, 0, 0, 0.25)" : "none",
    "--on-th": onTh.text,
    "--on-th-line": onTh.faint,
    "--on-primary": onPrimary.text,
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
