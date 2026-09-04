import { useEffect, useRef } from "react";
import type { ReportSnapshot } from "./ReportSnapshot.types";
import type { TemplateSettings } from "@models/TemplateSettings";
import { ReportRenderer } from "./templateRegistry";

interface Props {
  snapshots: ReportSnapshot[];
  settings: TemplateSettings;
  /** Called once, after the next paint, with every rendered
   *  `.actrs-report-page` DOM node in document order - used by both the
   *  PDF service (Module 8) and the print service (Module 10) so
   *  on-screen preview, PDF export and native print all rasterize/print
   *  from the identical rendered markup. */
  onReady?: (pageElements: HTMLElement[]) => void;
  /** Set to true for an off-screen export surface (PDF generation
   *  outside the visible Preview) so it never flashes on screen. */
  hidden?: boolean;
  className?: string;
}

export function ReportPrintSurface({ snapshots, settings, onReady, hidden, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!onReady || !containerRef.current) return;
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const nodes = Array.from(containerRef.current.querySelectorAll<HTMLElement>(".actrs-report-page"));
      onReady(nodes);
    });
    return () => cancelAnimationFrame(raf);
  }, [snapshots, settings, onReady]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={hidden ? { position: "fixed", left: -10000, top: 0, zIndex: -1 } : undefined}
    >
      {snapshots.map((snapshot, i) => (
        <ReportRenderer
          key={`${snapshot.student.studentId}-${snapshot.term.termName}-${i}`}
          snapshot={snapshot}
          settings={settings}
          isLastPage={i === snapshots.length - 1}
        />
      ))}
    </div>
  );
}
