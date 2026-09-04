import { useState } from "react";
import { SESSION_STATUS_ORDER, type AssessmentSessionStatus } from "@models/AssessmentSession";
import { AssessmentSessionService } from "@services/AssessmentSessionService";

/**
 * Shared lifecycle status badge + step-tracker/action-panel for an
 * AssessmentSession (Draft -> Completed -> Verified -> Finalized,
 * Module 11). Originally lived only inside AssessmentWorkspace.tsx,
 * hidden behind a collapsed "Lifecycle" toggle button - a teacher
 * producing report cards on the separate Report Cards screen had no
 * visibility into (or way to change) this status at all without
 * leaving that screen, going back to Assessments, opening the class,
 * and finding the toggle. Extracted here so both screens can show the
 * SAME status badge and change-status controls, expanded by default
 * rather than tucked behind a toggle.
 */
export const STATUS_META: Record<AssessmentSessionStatus, { label: string; badge: string }> = {
  DRAFT: { label: "Draft", badge: "text-bg-warning" },
  COMPLETED: { label: "Completed", badge: "text-bg-info" },
  VERIFIED: { label: "Verified", badge: "text-bg-primary" },
  FINALIZED: { label: "Finalized", badge: "text-bg-success" },
};

export function LifecycleStatusBadge({ status }: { status: AssessmentSessionStatus }) {
  return <span className={`badge rounded-pill ${STATUS_META[status].badge}`}>{STATUS_META[status].label}</span>;
}

export function LifecyclePanel({
  session,
  onChange,
}: {
  session: { status: AssessmentSessionStatus };
  onChange: (status: AssessmentSessionStatus, reopenReason?: string) => void;
}) {
  const [reopenReason, setReopenReason] = useState("");
  const options = AssessmentSessionService.nextStatusOptions(session.status);
  const currentStep = SESSION_STATUS_ORDER.indexOf(session.status);

  return (
    <div>
      <div className="d-flex gap-2 mb-3">
        {SESSION_STATUS_ORDER.map((s, i) => (
          <div
            key={s}
            className={`flex-fill text-center small py-2 rounded ${i <= currentStep ? "bg-primary-subtle fw-semibold" : "bg-light text-muted"}`}
          >
            {STATUS_META[s].label}
          </div>
        ))}
      </div>
      {options.length === 0 ? (
        <p className="text-muted small mb-0">This assessment is finalized. Reopening requires administrator action.</p>
      ) : (
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {options.map((opt) =>
            opt === "DRAFT" ? (
              <div key={opt} className="d-flex gap-2 align-items-center">
                <input
                  className="form-control form-control-sm"
                  style={{ width: 220 }}
                  placeholder="Reason for reopening (required)"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-outline-warning btn-sm"
                  disabled={!reopenReason.trim()}
                  onClick={() => onChange(opt, reopenReason.trim())}
                >
                  Reopen to Draft
                </button>
              </div>
            ) : (
              <button key={opt} type="button" className="btn btn-primary btn-sm" onClick={() => onChange(opt)}>
                Mark as {STATUS_META[opt].label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
