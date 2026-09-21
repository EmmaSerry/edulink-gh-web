import { useEffect, useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { rest } from "@/lib/supabaseClient";

/**
 * A persistent, impossible-to-miss strip shown across the top of the
 * app whenever the signed-in account belongs to the training school or
 * training district (see edulink_gh_phase1j_training_mode.sql) - so
 * nobody using a training login ever mistakes what they're looking at
 * for real data, and nobody reading a screenshot from a trainee gets
 * confused either. Renders nothing at all for every real account -
 * this makes exactly one extra, cheap read (the caller's own school or
 * district row, which RLS already lets them read) and only ever shows
 * itself when that row's is_training flag is true.
 */
export function TrainingModeBanner() {
  const { profile } = useCloudAuth();
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (profile?.school_id) {
        const rows = await rest.select<{ is_training: boolean }>("schools", {
          select: "is_training",
          filters: { id: `eq.${profile.school_id}` },
          limit: 1,
        });
        if (!cancelled) setIsTraining(rows[0]?.is_training ?? false);
        return;
      }
      if (profile?.district_id) {
        const rows = await rest.select<{ is_training: boolean }>("districts", {
          select: "is_training",
          filters: { id: `eq.${profile.district_id}` },
          limit: 1,
        });
        if (!cancelled) setIsTraining(rows[0]?.is_training ?? false);
        return;
      }
      if (!cancelled) setIsTraining(false);
    }
    void check().catch(() => !cancelled && setIsTraining(false));
    return () => {
      cancelled = true;
    };
  }, [profile?.school_id, profile?.district_id]);

  if (!isTraining) return null;

  return (
    <div
      className="no-print text-center py-1 small fw-semibold"
      style={{ background: "#f2b705", color: "#141a2b", letterSpacing: "0.03em" }}
      role="status"
    >
      TRAINING MODE - nothing entered here is real or counted anywhere. For practice only.
    </div>
  );
}
