import { createRoot } from "react-dom/client";
import { createElement } from "react";
import type { ReportSnapshot } from "@reporting/ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportPrintSurface } from "@reporting/ReportPrintSurface";

/**
 * Module 10 - browser-native printing. Mounts a temporary, detached
 * print surface (reusing the exact same `ReportPrintSurface` /
 * template-registry components the Preview and PDF export use), calls
 * `window.print()`, then tears the surface down once the print dialog
 * closes. The `.actrs-report-print-area` / `@media print` rules in
 * `src/styles/report-print.css` are what make ONLY this surface visible
 * to the printer while the rest of the app is hidden - letterhead,
 * tables, margins, page breaks, images and signature lines all print
 * exactly as they appear in the on-screen Preview, because it is the
 * same DOM tree.
 */
export function printReports(snapshots: ReportSnapshot[], settings: TemplateSettings): Promise<void> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.className = "actrs-report-print-area";
    document.body.appendChild(container);
    const root = createRoot(container);
    let settled = false;

    function cleanup() {
      if (settled) return;
      settled = true;
      window.removeEventListener("afterprint", cleanup);
      root.unmount();
      container.remove();
      resolve();
    }

    window.addEventListener("afterprint", cleanup);

    root.render(
      createElement(ReportPrintSurface, {
        snapshots,
        settings,
        onReady: () => {
          // One extra frame so logos/watermark images finish painting
          // before the print dialog opens.
          requestAnimationFrame(() => window.print());
        },
      }),
    );

    // Safety net - some browsers don't reliably fire `afterprint` when
    // the print dialog is cancelled a certain way; never leave the
    // detached root/DOM node mounted forever.
    setTimeout(cleanup, 60000);
  });
}
