/**
 * Cloud counterpart of src/services/PdfService.ts.
 *
 * The rasterize-and-embed logic (html2canvas -> jsPDF) is copied
 * verbatim - it only ever operates on already-rendered
 * `.actrs-report-page` DOM nodes (see ReportPrintSurface.tsx, which is
 * shared unchanged between offline and cloud, since it only reads the
 * backend-agnostic ReportSnapshot type). The one thing deliberately NOT
 * carried over is the call to the offline `recordPerformanceMetric`,
 * which writes to the local Dexie `performanceMetrics` table - a cloud
 * page has no Dexie database open at all, and pulling one in just for
 * fire-and-forget local timing instrumentation would be a pointless
 * dependency. A cloud performance-metrics table can be added later if
 * this ever needs to be measured server-side; for now PDF generation
 * simply isn't instrumented on the cloud side.
 */
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { PaperSize, Orientation } from "@models/AppSettings";
import { downloadBlob } from "@utils/downloadBlob";

export { downloadBlob };

export interface PdfPageOptions {
  paperSize: PaperSize;
  orientation: Orientation;
}

/** Renders one or more already-mounted `.actrs-report-page` DOM nodes to
 *  a single PDF, one node per page, at the same physical paper size the
 *  on-screen preview uses - see PdfService.ts (offline) for the full
 *  rationale behind rasterizing (html2canvas) rather than generating
 *  native PDF text, and PNG over JPEG for crisp text edges. */
export async function generatePdfFromPages(pageElements: HTMLElement[], options: PdfPageOptions): Promise<Blob> {
  if (pageElements.length === 0) {
    throw new Error("No report pages were ready to export.");
  }

  const format = options.paperSize === "Letter" ? "letter" : "a4";
  const orientation = options.orientation === "Landscape" ? "landscape" : "portrait";
  const pdf = new jsPDF({ unit: "mm", format, orientation });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  for (let i = 0; i < pageElements.length; i++) {
    const canvas = await html2canvas(pageElements[i], {
      scale: 3,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");

    if (i > 0) pdf.addPage(format, orientation);
    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight, undefined, "NONE");

    if (pageElements.length > 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(130);
      pdf.text(`Page ${i + 1} of ${pageElements.length}`, pageWidth - 10, pageHeight - 6, { align: "right" });
    }
  }

  return pdf.output("blob");
}

export function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "report";
}
