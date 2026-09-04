import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  phaseBadge?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, phaseBadge, actions }: Props) {
  return (
    <div className="d-flex flex-wrap justify-content-between align-items-start mb-4 gap-3">
      <div>
        <div className="d-flex align-items-center gap-2">
          <h1 className="h4 mb-0">{title}</h1>
          {phaseBadge && <span className="actrs-phase-badge">{phaseBadge}</span>}
        </div>
        {description && <p className="text-muted mb-0 mt-1">{description}</p>}
      </div>
      {actions && <div className="d-flex gap-2">{actions}</div>}
    </div>
  );
}
