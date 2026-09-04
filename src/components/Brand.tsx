import { useAppInfo } from "@hooks/useAppInfo";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { app } = useAppInfo();
  return (
    <div className="d-flex align-items-center gap-2">
      <span className="actrs-brand-mark">AC</span>
      {!compact && (
        <div className="lh-sm">
          <div className="fw-bold">{app.shortName}</div>
          <div className="text-muted" style={{ fontSize: "0.7rem" }}>
            {app.tagline}
          </div>
        </div>
      )}
    </div>
  );
}
