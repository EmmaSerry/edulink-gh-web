export function LoadingSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="d-flex align-items-center gap-2 text-muted py-5 justify-content-center">
      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
