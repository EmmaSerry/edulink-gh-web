import type { ReactNode } from "react";

interface Props {
  label: string;
  htmlFor?: string;
  error?: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
  className?: string;
}

/** Consistent label + control + validation-message layout for every form
 *  in every configuration module - see docs/CODING_STANDARDS.md. */
export function FormField({ label, htmlFor, error, required, hint, children, className = "" }: Props) {
  return (
    <div className={`mb-3 ${className}`}>
      <label htmlFor={htmlFor} className="form-label small fw-semibold">
        {label}
        {required && <span className="text-danger ms-1">*</span>}
      </label>
      {children}
      {hint && !error && <div className="form-text">{hint}</div>}
      {error && <div className="text-danger small mt-1">{error}</div>}
    </div>
  );
}
