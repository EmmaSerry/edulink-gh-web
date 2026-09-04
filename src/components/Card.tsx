import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={`actrs-card ${padded ? "p-3 p-md-4" : ""} ${className}`}>
      {children}
    </div>
  );
}
