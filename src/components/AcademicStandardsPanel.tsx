import type { SubjectLevelStat, KgSkillStat, SchoolBreakdownStat, ReportTemplateCode } from "@/types/database";

/**
 * Hand-built bars rather than a charting library - this sandbox's npm
 * registry access is blocked, so nothing like recharts/Chart.js can be
 * installed. Plain divs sized by percentage width cover the "infographic"
 * ask without a new dependency the build environment can't fetch.
 */

const LEVEL_GROUP_ORDER: ReportTemplateCode[] = ["KG", "LOWER_PRIMARY", "UPPER_PRIMARY", "JHS"];
const LEVEL_GROUP_LABEL: Record<ReportTemplateCode, string> = {
  KG: "Kindergarten",
  LOWER_PRIMARY: "Lower Primary",
  UPPER_PRIMARY: "Upper Primary",
  JHS: "JHS",
};

function scoreColor(pct: number): string {
  if (pct >= 70) return "#2f9e44";
  if (pct >= 50) return "#f2b705";
  return "#e03131";
}

function Bar({ pct, color, height = 8 }: { pct: number; color: string; height?: number }) {
  return (
    <div style={{ background: "#e9ecef", borderRadius: height, height, overflow: "hidden" }}>
      <div
        style={{
          width: `${Math.max(0, Math.min(100, pct))}%`,
          background: color,
          height: "100%",
          borderRadius: height,
        }}
      />
    </div>
  );
}

function SubjectLevelGrid({ stats }: { stats: SubjectLevelStat[] }) {
  const byGroup = new Map<ReportTemplateCode, SubjectLevelStat[]>();
  for (const s of stats) {
    const list = byGroup.get(s.level_group) ?? [];
    list.push(s);
    byGroup.set(s.level_group, list);
  }
  const groupsPresent = LEVEL_GROUP_ORDER.filter((g) => g !== "KG" && byGroup.has(g));

  if (groupsPresent.length === 0) {
    return <p className="text-muted small mb-0">No subject scores recorded for the current term yet.</p>;
  }

  return (
    <div className="row g-3">
      {groupsPresent.map((group) => {
        const rows = [...(byGroup.get(group) ?? [])].sort((a, b) => a.subject_name.localeCompare(b.subject_name));
        return (
          <div className="col-md-6" key={group}>
            <div className="fw-semibold small mb-2">{LEVEL_GROUP_LABEL[group]}</div>
            <div className="d-flex flex-column gap-2">
              {rows.map((r) => (
                <div key={r.subject_name}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span>{r.subject_name}</span>
                    <span className="text-muted">
                      {r.avg_total.toFixed(0)}/100 · {r.participant_count} pupil{r.participant_count === 1 ? "" : "s"}
                    </span>
                  </div>
                  <Bar pct={r.avg_total} color={scoreColor(r.avg_total)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KgBreakdown({ stats }: { stats: KgSkillStat[] }) {
  const kgStats = stats.filter((s) => s.level_group === "KG");
  if (kgStats.length === 0) return null;

  const total = kgStats.reduce((sum, s) => sum + s.rating_count, 0);
  const byRating = new Map<string, number>();
  for (const s of kgStats) byRating.set(s.rating, (byRating.get(s.rating) ?? 0) + s.rating_count);
  const ratings = Array.from(byRating.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const colors: Record<string, string> = { G: "#2f9e44", S: "#2f6fb0", B: "#f2b705", X: "#868e96", O: "#e03131" };

  return (
    <div className="mt-4 pt-3 border-top">
      <div className="fw-semibold small mb-2">Kindergarten (skill-checklist ratings)</div>
      <div className="d-flex rounded overflow-hidden mb-2" style={{ height: 10 }}>
        {ratings.map(([rating, count]) => (
          <div
            key={rating}
            style={{ width: `${(count / total) * 100}%`, background: colors[rating] ?? "#adb5bd" }}
            title={`${rating}: ${count}`}
          />
        ))}
      </div>
      <div className="d-flex flex-wrap gap-3 small text-muted">
        {ratings.map(([rating, count]) => (
          <span key={rating}>
            <span
              className="d-inline-block me-1"
              style={{ width: 10, height: 10, borderRadius: 2, background: colors[rating] ?? "#adb5bd" }}
            />
            {rating}: {count} ({((count / total) * 100).toFixed(0)}%)
          </span>
        ))}
      </div>
    </div>
  );
}

export function AcademicStandardsPanel({
  subjectLevelStats,
  kgSkillStats,
  termName,
}: {
  subjectLevelStats: SubjectLevelStat[];
  kgSkillStats: KgSkillStat[];
  termName?: string | null;
}) {
  return (
    <div className="actrs-card p-3 mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h6 mb-0">Academic standards</h2>
        {termName && <span className="text-muted small">{termName}</span>}
      </div>
      <SubjectLevelGrid stats={subjectLevelStats} />
      <KgBreakdown stats={kgSkillStats} />
    </div>
  );
}

/** District-only: a ranked list of schools by average mark, so a
 *  district admin can see which schools need attention at a glance. */
export function SchoolBreakdownPanel({ schools }: { schools: SchoolBreakdownStat[] }) {
  const withScores = schools.filter((s) => s.avg_total !== null);
  if (withScores.length === 0) {
    return (
      <div className="actrs-card p-3 mb-4">
        <h2 className="h6 mb-3">School by school</h2>
        <p className="text-muted small mb-0">No subject scores recorded for the current term yet.</p>
      </div>
    );
  }

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 mb-3">School by school (average mark, current term)</h2>
      <div className="d-flex flex-column gap-2">
        {withScores.map((s) => (
          <div key={s.school_id}>
            <div className="d-flex justify-content-between small mb-1">
              <span>{s.school_name}</span>
              <span className="text-muted">
                {s.avg_total!.toFixed(0)}/100 · {s.participant_count} record{s.participant_count === 1 ? "" : "s"}
              </span>
            </div>
            <Bar pct={s.avg_total!} color={scoreColor(s.avg_total!)} height={10} />
          </div>
        ))}
      </div>
    </div>
  );
}
