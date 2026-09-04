import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import type { PaperSize, Orientation } from "@models/AppSettings";
import { recordPerformanceMetric } from "./PerformanceMetricService";
import { downloadBlob } from "@utils/downloadBlob";

// Re-exported so existing call sites (e.g. ReportPreview.tsx) that
// import downloadBlob from this service keep working unchanged - the
// implementation itself now lives in one shared place, see
// @utils/downloadBlob.ts (Phase 6 architecture review, Module 1).
export { downloadBlob };

export interface PdfPageOptions {
  paperSize: PaperSize;
  orientation: Orientation;
}

/**
 * Module 8 - PDF generation. Renders one or more already-mounted
 * `.actrs-report-page` DOM nodes (see `ReportPrintSurface`) to a single
 * PDF, one node per page, at the SAME physical paper size the on-screen
 * preview and native print use (`TemplateSettings.paperSize`/
 * `orientation`) - this is what keeps preview/PDF/print visually
 * identical, since all three render through the exact same React
 * component tree and CSS.
 *
 * `html2canvas` rasterizes each page (so any font actually renders
 * pixel-for-pixel as shown on screen, avoiding PDF font-embedding
 * mismatches across OSes/browsers with no internet access to fetch web
 * fonts); `scale: 3` gives a crisp ~288dpi-equivalent output. The
 * canvas is encoded as lossless PNG (not JPEG) before being embedded -
 * JPEG's block compression visibly smears sharp black-on-white text
 * edges (the "pixelated report card text" defect), which a flat,
 * mostly-text/table document like a report card is exactly the wrong
 * content type for; PNG has no such artifact. File size stays
 * reasonable since these pages are simple, not photographic.
 */
export async function generatePdfFromPages(pageElements: HTMLElement[], options: PdfPageOptions): Promise<Blob> {
  if (pageElements.length === 0) {
    throw new Error("No report pages were ready to export.");
  }
  const startedAt = performance.now();

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

  void recordPerformanceMetric("PDF_GENERATION_MS", performance.now() - startedAt, `${pageElements.length} page(s)`);
  return pdf.output("blob");
}

export function sanitizeFileNamePart(value: string): string {
  return value.replace(/[^a-z0-9\-_. ]/gi, "_").trim() || "report";
}
