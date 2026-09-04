import { useEffect, useState } from "react";
import { getDatabaseSummary } from "@database/db";

/** Lightweight status hook for the Dashboard - Phase 0 only reads
 *  counts, it does not write or manage any domain records. */
export function useDatabaseSummary() {
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof getDatabaseSummary>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getDatabaseSummary().then((result) => {
      if (!cancelled) {
        setSummary(result);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, loading };
}
