import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** Stagger successive Reveal-wrapped siblings by giving each an
   *  increasing delay, in milliseconds. */
  delayMs?: number;
  className?: string;
}

/**
 * Fades + slides a section into place the first time it scrolls into
 * view, using IntersectionObserver rather than a scroll-position
 * calculation - cheaper, and correct regardless of page layout shifts.
 * Public marketing page only; the authenticated app deliberately stays
 * static/immediate everywhere else (a data-entry screen re-animating
 * every time a teacher scrolls it is a distraction, not a delight).
 */
export function Reveal({ children, delayMs = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`ph-reveal ${visible ? "ph-reveal-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
