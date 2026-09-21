import type { ReactNode } from "react";

/**
 * Shared "nothing here yet" panel - used anywhere a list/table can be
 * legitimately empty (no students registered, no reports generated,
 * search with no matches) instead of a single grey line of text. Sits
 * inside the existing table/card structure (pass colSpan when used as
 * a <tr><td>), so this doesn't change any data-loading logic - it's
 * purely the "nothing to show" presentation.
 *
 * The illustration is a small flat-style icon (an open box) sourced
 * from Unsplash - see HOW_TO_APPLY.txt in this batch for the
 * attribution line to keep somewhere in the app (About/Settings), per
 * Unsplash's usage guidelines.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="d-flex flex-column align-items-center text-center py-5 px-3">
      <img
        src="https://images.unsplash.com/vector-1739893036068-726b6e976b0e?auto=format&fit=crop&w=160&q=80"
        alt=""
        width={96}
        height={96}
        style={{ opacity: 0.85, marginBottom: "0.75rem" }}
        loading="lazy"
      />
      <div className="fw-semibold mb-1">{title}</div>
      {body && <div className="text-muted small mb-3" style={{ maxWidth: 320 }}>{body}</div>}
      {action}
    </div>
  );
}
