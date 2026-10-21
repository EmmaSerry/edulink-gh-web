import { useEffect, useState, type ReactNode } from "react";
import "@/styles/report-lock.css";

/**
 * Wraps a report that has NOT been paid for. The report stays viewable on
 * screen, but under a heavy "UNPAID PREVIEW" watermark so a screenshot or
 * photo is useless, text can't be selected/copied, printing is blocked, and
 * the report blurs when the window loses focus (which is what screenshot
 * tools do) or when Print-Screen / Ctrl+P / Ctrl+S is pressed.
 *
 * Honest limit: a browser can never fully stop a screenshot or a phone
 * photo - the watermark is what makes them worthless. The real locks (PDF,
 * zip, print record, SMS) are enforced separately.
 */
export function ReportLockShield({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let timer: number | undefined;
    const flash = () => {
      setHidden(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setHidden(document.hidden || !document.hasFocus()), 1500);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "printscreen" || k === "meta" || ((e.ctrlKey || e.metaKey) && (k === "p" || k === "s"))) {
        if (k !== "printscreen" && k !== "meta") e.preventDefault();
        flash();
        try {
          void navigator.clipboard?.writeText("EduLink GH - unpaid preview");
        } catch {
          /* ignore */
        }
      }
    };
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onVis = () => setHidden(document.hidden);
    const beforePrint = () => setHidden(true);

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeprint", beforePrint);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeprint", beforePrint);
      document.removeEventListener("visibilitychange", onVis);
      window.clearTimeout(timer);
    };
  }, []);

  const stop = (e: { preventDefault: () => void }) => e.preventDefault();

  return (
    <>
      <div className="rl-print-msg">This report is an unpaid preview and cannot be printed. Please pay the report fee to unlock it.</div>
      <div
        className={`rl-shell ${hidden ? "rl-hidden" : ""}`}
        onContextMenu={stop}
        onCopy={stop}
        onCut={stop}
        onDragStart={stop}
      >
        <div className="rl-content">{children}</div>
        <div className="rl-watermark" aria-hidden="true">
          <div className="rl-tile">
            {Array.from({ length: 40 }).map((_, i) => (
              <span key={i}>UNPAID PREVIEW</span>
            ))}
          </div>
          <div className="rl-center">UNPAID<br />PREVIEW</div>
        </div>
      </div>
    </>
  );
}
