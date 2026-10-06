import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LearnerService, LEVEL_GROUP_LABEL, type LearnerStatistics } from "@services/cloud/LearnerService";
import { CountUp, GlowBars, GlowCard, GlowDonut } from "@components/Infographics";

/**
 * Compact, glowing learner statistics for the Dashboard. The database
 * limits the numbers to the signed-in person's own school (or district /
 * everything, for a district or Super Admin). The full filterable version
 * is the Statistics page.
 */
export function LearnerStatsPanel() {
  const [stats, setStats] = useState<LearnerStatistics | null>(null);

  useEffect(() => {
    let cancelled = false;
    LearnerService.statistics({})
      .then((s) => !cancelled && setStats(s))
      .catch(() => {
        /* bonus panel - never block the dashboard */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return null;

  return (
    <div className="row g-4 mb-4">
      <div className="col-12 d-flex align-items-center justify-content-between">
        <h2 className="h6 fw-bold mb-0">Learner statistics</h2>
        <Link to="/statistics" className="btn btn-sm btn-outline-primary">
          Open full statistics
        </Link>
      </div>
      <div className="col-lg-4">
        <GlowCard title="Active learners">
          <div className="ig-hero-number mb-3">
            <CountUp value={stats.total} />
          </div>
          <GlowDonut male={stats.male} female={stats.female} />
        </GlowCard>
      </div>
      <div className="col-lg-4">
        <GlowCard title="By level" delay={150}>
          <GlowBars
            items={stats.byLevelGroup.map((g) => ({
              label: LEVEL_GROUP_LABEL[g.group] ?? g.group,
              male: g.male,
              female: g.female,
              total: g.total,
            }))}
          />
        </GlowCard>
      </div>
      <div className="col-lg-4">
        <GlowCard title="By class" delay={300}>
          <GlowBars
            items={stats.byClass.map((c) => ({ label: c.label, male: c.male, female: c.female, total: c.total }))}
          />
        </GlowCard>
      </div>
    </div>
  );
}
