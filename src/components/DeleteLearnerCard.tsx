import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { rest } from "@/lib/supabaseClient";

/**
 * "Delete permanently" for a learner who is no longer Active (archived,
 * withdrawn, transferred...). Only shown to school / district / platform
 * admins. Uses the same remove_learner() database function as the Capture
 * app, which re-checks the caller's permission on the server.
 */
export function DeleteLearnerCard({ studentId, fullName }: { studentId: string; fullName: string }) {
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim().toLowerCase() === fullName.trim().toLowerCase();

  async function handleDelete() {
    if (!matches) return;
    setBusy(true);
    setError(null);
    try {
      await rest.rpc<void>("remove_learner", { p_student_id: studentId, p_mode: "delete", p_reason: null });
      navigate("/students");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this learner.");
      setBusy(false);
    }
  }

  return (
    <div className="actrs-card p-4 mb-4" style={{ borderColor: "#dc3545" }}>
      <h2 className="h6 fw-bold text-danger mb-2">Delete permanently</h2>
      <p className="small mb-2">
        This removes <strong>{fullName}</strong> and ALL their records (marks, attendance, fees, reports, guardian) for good.
        It cannot be undone. If the learner only left the school, keep the record and set the status instead.
      </p>
      {error && <div className="alert alert-danger py-2">{error}</div>}
      <label className="form-label small">Type the learner's full name to confirm</label>
      <div className="d-flex gap-2 flex-wrap">
        <input
          className="form-control"
          style={{ maxWidth: 360 }}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={fullName}
        />
        <button type="button" className="btn btn-danger" disabled={!matches || busy} onClick={handleDelete}>
          {busy ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </div>
  );
}
