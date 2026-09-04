import { useEffect, useId, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}

/** Reusable modal used by every module's Add/Edit form - no bootstrap.js
 *  bundle dependency, just conditional rendering + a backdrop.
 *
 *  Phase 6 (Module 6 - UI consistency/accessibility review): this one
 *  component backs all ~16 Add/Edit dialogs across the app, so it was the
 *  single highest-leverage place to fix a genuine, systemic accessibility
 *  gap found during the review - none of them closed on Escape, and none
 *  exposed dialog semantics to screen readers. Fixed once, here, for every
 *  caller at once; no per-page changes needed. */
export function Modal({ title, isOpen, onClose, children, size = "md" }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // Move focus into the dialog so keyboard/screen-reader users land
    // somewhere sensible instead of on whatever was focused underneath.
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-start justify-content-center overflow-auto"
      style={{ background: "rgba(15,23,32,0.45)", zIndex: 1070, padding: "3rem 1rem" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="actrs-card actrs-surface w-100"
        style={{ maxWidth: size === "lg" ? 760 : 520, outline: "none" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom">
          <h2 className="h6 mb-0" id={titleId}>{title}</h2>
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={onClose}
          />
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
