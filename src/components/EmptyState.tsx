interface Props {
  icon?: string;
  title: string;
  message: string;
  availableFromPhase?: number;
}

/** Standard "not built yet" placeholder used by every Phase-0 page, so
 *  every module looks and behaves consistently until real content lands. */
export function EmptyState({ icon = "bi-hourglass-split", title, message, availableFromPhase }: Props) {
  return (
    <div className="text-center py-5">
      <i className={`bi ${icon}`} style={{ fontSize: "2.5rem", color: "var(--actrs-blue)" }} />
      <h2 className="h5 mt-3">{title}</h2>
      <p className="text-muted mx-auto" style={{ maxWidth: 480 }}>
        {message}
      </p>
      {availableFromPhase !== undefined && (
        <span className="actrs-phase-badge">Planned for Phase {availableFromPhase}</span>
      )}
    </div>
  );
}
