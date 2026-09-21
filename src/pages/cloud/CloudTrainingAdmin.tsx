import { useEffect, useState } from "react";
import { CloudTrainingService } from "@services/cloud/TrainingService";

type SetupState = "idle" | "working" | "done" | "error";
type ResetState = "idle" | "working" | "done" | "error";

/**
 * Platform-admin-only control panel for the shared training
 * environment - see edulink_gh_phase1j_training_mode.sql for the full
 * design. Two actions:
 *   - Set up (idempotent): creates the training district/school the
 *     first time this is ever run. Safe to click again later - it just
 *     confirms the training school already exists rather than making a
 *     second one.
 *   - Reset training data: wipes every pupil (and everything that
 *     hangs off one - guardians, scores, skill ratings, reports,
 *     attendance) from the training school, so a new group of trainees
 *     always starts from an empty roster. Classes/levels/terms/staff
 *     accounts are left alone - that's reusable setup, not per-cohort
 *     progress.
 * Creating the actual training LOGINS (school_admin/teacher/bursar/
 * district_admin) still goes through Supabase Auth directly, same as
 * every other test account in this project - see the instructions
 * below the buttons.
 */
export function CloudTrainingAdmin() {
  const [trainingSchool, setTrainingSchool] = useState<{ id: string; name: string } | null | "loading">("loading");
  const [setupState, setSetupState] = useState<SetupState>("idle");
  const [setupError, setSetupError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<ResetState>("idle");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<number | null>(null);

  function refresh() {
    setTrainingSchool("loading");
    CloudTrainingService.findTrainingSchool()
      .then(setTrainingSchool)
      .catch(() => setTrainingSchool(null));
  }

  useEffect(refresh, []);

  async function handleSetup() {
    setSetupState("working");
    setSetupError(null);
    try {
      await CloudTrainingService.setup();
      setSetupState("done");
      refresh();
    } catch (err) {
      setSetupError(err instanceof Error ? err.message : "Could not set up the training environment.");
      setSetupState("error");
    }
  }

  async function handleReset() {
    if (!confirm("Remove every pupil from the training school? Classes, levels, terms and staff logins are kept - only pupils and their records are wiped.")) {
      return;
    }
    setResetState("working");
    setResetError(null);
    setResetResult(null);
    try {
      const result = await CloudTrainingService.reset();
      setResetResult(result.studentsRemoved);
      setResetState("done");
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "Could not reset the training environment.");
      setResetState("error");
    }
  }

  return (
    <div>
      <h1 className="h4 mb-1">Training environment</h1>
      <p className="text-muted mb-4">
        A shared practice space, kept completely separate from every real school - see the notes below for how to
        give someone a login into it.
      </p>

      <div className="actrs-card p-4 mb-4">
        <h2 className="h6 fw-bold mb-2">1. Set up</h2>
        {trainingSchool === "loading" && <p className="text-muted small mb-0">Checking…</p>}
        {trainingSchool && trainingSchool !== "loading" && (
          <p className="text-success small mb-3">
            <i className="bi bi-check-circle me-1" />
            Already set up - "{trainingSchool.name}".
          </p>
        )}
        {trainingSchool === null && (
          <p className="text-muted small mb-3">Not set up yet - click below to create it. This only needs doing once.</p>
        )}
        {setupError && <div className="alert alert-danger py-2">{setupError}</div>}
        <button type="button" className="btn btn-primary btn-sm" disabled={setupState === "working"} onClick={handleSetup}>
          {setupState === "working" ? "Setting up…" : trainingSchool ? "Set up again" : "Set up training environment"}
        </button>
      </div>

      <div className="actrs-card p-4 mb-4">
        <h2 className="h6 fw-bold mb-2">2. Reset training data</h2>
        <p className="text-muted small mb-3">
          Removes every pupil registered in the training school, along with their guardians, scores, skill ratings,
          reports and attendance. Classes, levels, terms, subjects, print settings and staff logins are left exactly
          as they are - so the next group of trainees can start again from a clean, empty roster without you having
          to reconfigure anything.
        </p>
        {resetError && <div className="alert alert-danger py-2">{resetError}</div>}
        {resetState === "done" && resetResult !== null && (
          <div className="alert alert-success py-2">
            {resetResult === 0 ? "Nothing to remove - the training school was already empty." : `Removed ${resetResult} pupil${resetResult === 1 ? "" : "s"} and everything attached to them.`}
          </div>
        )}
        <button
          type="button"
          className="btn btn-outline-danger btn-sm"
          disabled={resetState === "working" || !trainingSchool || trainingSchool === "loading"}
          onClick={handleReset}
        >
          {resetState === "working" ? "Resetting…" : "Reset training data"}
        </button>
      </div>

      <div className="actrs-card p-4">
        <h2 className="h6 fw-bold mb-2">3. Give someone a training login</h2>
        <p className="text-muted small mb-2">
          Same two-step process used for every test account in this project so far:
        </p>
        <ol className="text-muted small mb-3 ps-3">
          <li className="mb-1">In Supabase, Authentication → Users → Add user, with the email/password you want them to sign in with.</li>
          <li className="mb-1">Copy that new user's ID, then in the SQL Editor run:</li>
        </ol>
        <pre className="bg-body-tertiary p-2 rounded small mb-2" style={{ whiteSpace: "pre-wrap" }}>
{`select public.create_training_account(
  'paste-the-user-id-here',
  'Trainee''s full name',
  'teacher',   -- or 'school_admin' / 'bursar' / 'district_admin'
  '0240000000' -- phone, optional
);`}
        </pre>
        <p className="text-muted small mb-0">
          They can then sign in normally, in either app - the cloud dashboard or the offline Capture app - and
          they'll see the yellow "TRAINING MODE" banner across the top the whole time, on every screen.
        </p>
      </div>
    </div>
  );
}
