import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
} from "recharts";
import { useThemeMode } from "@contexts/ThemeContext";
import type { SubjectLevelStat, KgSkillStat, SchoolBreakdownStat, ReportTemplateCode } from "@/types/database";

/**
 * Real charts (recharts) instead of the hand-rolled percentage-width
 * divs this used to be. The earlier version's comment said recharts
 * couldn't be installed because this sandbox's own npm registry access
 * is blocked - that only ever affected ME test-building locally, not
 * Vercel, which fetches every dependency fresh on each deploy the same
 * way it already does for jspdf/xlsx/html2canvas. Adding one more
 * dependency to package.json works the same way those did.
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

const KG_RATING_COLOR: Record<string, string> = { G: "#2f9e44", S: "#1f6feb", B: "#f2b705", X: "#868e96", O: "#e03131" };
const KG_RATING_LABEL: Record<string, string> = {
  G: "Good",
  S: "Satisfactory",
  B: "Beginning",
  X: "Not assessed",
  O: "Outstanding",
};

/** Theme-aware chart chrome - recharts renders plain SVG, so it doesn't
 *  pick up the app's CSS variables on its own; this reads the same
 *  light/dark state the rest of the app already uses (see
 *  ThemeContext) and resolves the handful of colours a chart's
 *  non-data elements (axis lines, gridlines, tooltip) need. */
function useChartChrome() {
  const { mode } = useThemeMode();
  const dark = mode === "dark";
  return {
    axisColor: dark ? "#9aa7b4" : "#5b6b7c",
    gridColor: dark ? "#262c35" : "#e1e5ea",
    tooltipBg: dark ? "#161d29" : "#ffffff",
    tooltipBorder: dark ? "#262c35" : "#e1e5ea",
    tooltipText: dark ? "#e7ebef" : "#1c2733",
  };
}

function ScoreTooltip({ active, payload, chrome }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div
      style={{
        background: chrome.tooltipBg,
        border: `1px solid ${chrome.tooltipBorder}`,
        borderRadius: 8,
        padding: "0.5rem 0.75rem",
        color: chrome.tooltipText,
        fontSize: "0.8rem",
        boxShadow: "0 2px 10px rgba(11,26,48,0.15)",
      }}
    >
      <div className="fw-semibold mb-1">{row.label}</div>
      <div>{row.avg_total.toFixed(0)}/100 average</div>
      <div className="text-muted">
        {row.participant_count} pupil{row.participant_count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Horizontal bar chart for a set of subject/school rows scored 0-100,
 *  shared by SubjectLevelGrid (per level group) and SchoolBreakdownPanel
 *  (district ranking) - same visual language, different row labels. */
function ScoreBarChart({ rows, barSize = 18 }: { rows: { label: string; avg_total: number; participant_count: number }[]; barSize?: number }) {
  const chrome = useChartChrome();
  const height = Math.max(80, rows.length * (barSize + 20) + 10);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 36, bottom: 4, left: 4 }} barCategoryGap={16}>
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: chrome.axisColor }}
          axisLine={{ stroke: chrome.gridColor }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={132}
          tick={{ fontSize: 12, fill: chrome.axisColor }}
          axisLine={{ stroke: chrome.gridColor }}
          tickLine={false}
        />
        <Tooltip content={<ScoreTooltip chrome={chrome} />} cursor={{ fill: chrome.gridColor, opacity: 0.4 }} />
        <Bar dataKey="avg_total" radius={[0, 6, 6, 0]} barSize={barSize} isAnimationActive>
          {rows.map((r) => (
            <Cell key={r.label} fill={scoreColor(r.avg_total)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function SubjectLevelGrid({ stats, singleGroup }: { stats: SubjectLevelStat[]; singleGroup?: boolean }) {
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
    <div className="row g-4">
      {groupsPresent.map((group) => {
        const rows = [...(byGroup.get(group) ?? [])]
          .sort((a, b) => a.subject_name.localeCompare(b.subject_name))
          .map((r) => ({ label: r.subject_name, avg_total: r.avg_total, participant_count: r.participant_count }));
        return (
          <div className={groupsPresent.length > 1 && !singleGroup ? "col-md-6" : "col-12"} key={group}>
            {!singleGroup && <div className="fw-semibold small mb-2">{LEVEL_GROUP_LABEL[group]}</div>}
            <ScoreBarChart rows={rows} />
          </div>
        );
      })}
    </div>
  );
}

function KgBreakdown({ stats }: { stats: KgSkillStat[] }) {
  const chrome = useChartChrome();
  const kgStats = stats.filter((s) => s.level_group === "KG");
  if (kgStats.length === 0) return null;

  const byRating = new Map<string, number>();
  for (const s of kgStats) byRating.set(s.rating, (byRating.get(s.rating) ?? 0) + s.rating_count);
  const total = Array.from(byRating.values()).reduce((sum, n) => sum + n, 0);
  const data = Array.from(byRating.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([rating, count]) => ({
      rating,
      name: KG_RATING_LABEL[rating] ?? rating,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    }));

  return (
    <div className="mt-4 pt-3 border-top">
      <div className="fw-semibold small mb-2">Kindergarten (skill-checklist ratings)</div>
      <div className="row align-items-center g-3">
        <div className="col-md-5">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="rating" innerRadius={52} outerRadius={80} paddingAngle={2} isAnimationActive>
                {data.map((d) => (
                  <Cell key={d.rating} fill={KG_RATING_COLOR[d.rating] ?? "#adb5bd"} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, _name: string, entry: any) => [`${value} (${entry.payload.pct.toFixed(0)}%)`, entry.payload.name]}
                contentStyle={{ background: chrome.tooltipBg, border: `1px solid ${chrome.tooltipBorder}`, borderRadius: 8, fontSize: "0.8rem" }}
                itemStyle={{ color: chrome.tooltipText }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="col-md-7">
          <div className="d-flex flex-column gap-2">
            {data.map((d) => (
              <div key={d.rating} className="d-flex align-items-center justify-content-between small">
                <span className="d-flex align-items-center gap-2">
                  <span
                    className="d-inline-block"
                    style={{ width: 10, height: 10, borderRadius: 3, background: KG_RATING_COLOR[d.rating] ?? "#adb5bd" }}
                  />
                  {d.rating} — {d.name}
                </span>
                <span className="text-muted">
                  {d.count} ({d.pct.toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AcademicStandardsPanel({
  subjectLevelStats,
  kgSkillStats,
  termName,
  title,
  subtitle,
}: {
  subjectLevelStats: SubjectLevelStat[];
  kgSkillStats: KgSkillStat[];
  termName?: string | null;
  /** Optional heading override - used when this panel is showing just
   *  one class's data (e.g. a teacher's own class) rather than a whole
   *  school, so the label doesn't misleadingly say "Academic standards"
   *  as if it covers everyone. Defaults preserve the original heading
   *  for the school-wide/district-wide call sites. Accepts null as well
   *  as undefined since CloudDashboard.tsx passes a nullable class name
   *  straight through here. */
  title?: string | null;
  subtitle?: string | null;
}) {
  const groupCount = new Set(subjectLevelStats.map((s) => s.level_group).filter((g) => g !== "KG")).size;
  return (
    <div className="actrs-card p-3 mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div>
          <h2 className="h6 mb-0">{title ?? "Academic standards"}</h2>
          {subtitle && <div className="text-muted small">{subtitle}</div>}
        </div>
        {termName && <span className="text-muted small">{termName}</span>}
      </div>
      <SubjectLevelGrid stats={subjectLevelStats} singleGroup={groupCount <= 1} />
      <KgBreakdown stats={kgSkillStats} />
    </div>
  );
}

/** District-only: a ranked list of schools by average mark, so a
 *  district admin can see which schools need attention at a glance. */
export function SchoolBreakdownPanel({ schools }: { schools: SchoolBreakdownStat[] }) {
  const withScores = schools.filter((s): s is SchoolBreakdownStat & { avg_total: number } => s.avg_total !== null);
  if (withScores.length === 0) {
    return (
      <div className="actrs-card p-3 mb-4">
        <h2 className="h6 mb-3">School by school</h2>
        <p className="text-muted small mb-0">No subject scores recorded for the current term yet.</p>
      </div>
    );
  }

  const rows = [...withScores]
    .sort((a, b) => b.avg_total - a.avg_total)
    .map((s) => ({ label: s.school_name, avg_total: s.avg_total, participant_count: s.participant_count }));

  return (
    <div className="actrs-card p-3 mb-4">
      <h2 className="h6 mb-3">School by school (average mark, current term)</h2>
      <ScoreBarChart rows={rows} barSize={16} />
    </div>
  );
}
