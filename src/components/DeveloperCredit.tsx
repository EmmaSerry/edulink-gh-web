import { useAppInfo } from "@hooks/useAppInfo";

interface Props {
  /** "full" for About/Login/User Manual, "inline" for footers/reports. */
  variant?: "full" | "inline";
}

/**
 * Renders the developer credit required to appear on the Login page,
 * Dashboard, About page, User Manual, exported documentation and every
 * generated report where appropriate. Defined once, used everywhere -
 * never hand-typed at each call site.
 */
export function DeveloperCredit({ variant = "inline" }: Props) {
  const { developer, app } = useAppInfo();

  if (variant === "full") {
    return (
      <div className="text-center">
        <div className="fw-semibold">{developer.name}</div>
        <div className="text-muted small">{developer.title}</div>
        <div className="text-muted small">{developer.organisation}</div>
        <div className="text-muted small mt-1">
          {app.name} &middot; v{app.version}
        </div>
      </div>
    );
  }

  return (
    <span className="text-muted small">
      Developed by {developer.name}, {developer.title} &mdash;{" "}
      {developer.organisation}
    </span>
  );
}
