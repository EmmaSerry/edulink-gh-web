import { useEffect, useMemo, useState } from "react";
import {
  LearnerService,
  LEVEL_GROUP_LABEL,
  type LearnerFilterOptions,
  type LearnerStatistics,
  type LevelGroup,
  type StatsFilters,
} from "@services/cloud/LearnerService";
import { CountUp, GlowBars, GlowCard, GlowColumns, GlowDonut } from "@components/Infographics";

type AgeMode = "any" | "older" | "younger" | "exactly" | "between";

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Learner statistics for the signed-in person's scope (own school, whole
 * district, or everything for the Super Admin). Every filter narrows every
 * chart, so "females in Basic 5 older than 6" is: Gender = Female, Class =
 * Basic 5, Age = Older than 6 - the big number is the answer.
 */
export function CloudStatistics() {
  const [options, setOptions] = useState<LearnerFilterOptions>({ schools: [], classNames: [] });
  const [schoolId, setSchoolId] = useState("");
  const [levelGroup, setLevelGroup] = useState("");
  const [className, setClassName] = useState("");
  const [gender, setGender] = useState("");
  const [ageMode, setAgeMode] = useState<AgeMode>("any");
  const [age1, setAge1] = useState("6");
  const [age2, setAge2] = useState("12");
  const [stats, setStats] = useState<LearnerStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    LearnerService.filterOptions().then(setOptions).catch(() => {});
  }, []);

  const filters: StatsFilters = useMemo(() => {
    const n1 = Number(age1);
    const n2 = Number(age2);
    const f: StatsFilters = {
      schoolId: schoolId || undefined,
      levelGroup: (levelGroup || undefined) as LevelGroup | undefined,
      className: className || undefined,
      gender: (gender || undefined) as "M" | "F" | undefined,
    };
    if (ageMode === "older" && Number.isFinite(n1)) f.minAge = n1 + 1;
    if (ageMode === "younger" && Number.isFinite(n1)) f.maxAge = n1 - 1;
    if (ageMode === "exactly" && Number.isFinite(n1)) {
      f.minAge = n1;
      f.maxAge = n1;
    }
    if (ageMode === "between" && Number.isFinite(n1) && Number.isFinite(n2)) {
      f.minAge = Math.min(n1, n2);
      f.maxAge = Math.max(n1, n2);
    }
    return f;
  }, [schoolId, levelGroup, className, gender, ageMode, age1, age2]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    const t = window.setTimeout(() => {
      LearnerService.statistics(filters)
        .then((s) => !cancelled && setStats(s))
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load the statistics."));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [filters]);

  const schoolName = options.schools.find((s) => s.id === schoolId)?.name;
  const chips: string[] = [];
  chips.push(schoolName ?? (options.schools.length > 1 ? "All schools" : (options.schools[0]?.name ?? "My school")));
  if (gender) chips.push(gender === "F" ? "Female" : "Male");
  if (levelGroup) chips.push(LEVEL_GROUP_LABEL[levelGroup]);
  if (className) chips.push(className);
  if (ageMode === "older") chips.push(`older than ${age1}`);
  if (ageMode === "younger") chips.push(`younger than ${age1}`);
  if (ageMode === "exactly") chips.push(`aged ${age1}`);
  if (ageMode === "between") chips.push(`aged ${age1} to ${age2}`);

  const showSchoolFilter = options.schools.length > 1;

  function reset() {
    setSchoolId("");
    setLevelGroup("");
    setClassName("");
    setGender("");
    setAgeMode("any");
  }

  return (
    <div>
      <h1 className="h4 mb-1">Learner statistics</h1>
      <p className="text-muted mb-3">
        Choose any mix of filters. The big number and every chart below update to match - for example Female, Basic 5,
        older than 6.
      </p>

      <div className="actrs-card p-3 mb-4">
        <div className="row g-2 align-items-end">
          {showSchoolFilter && (
            <div className="col-md-4">
              <label className="form-label small mb-1">School</label>
              <select className="form-select" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                <option value="">All schools</option>
                {options.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Level</label>
            <select className="form-select" value={levelGroup} onChange={(e) => setLevelGroup(e.target.value)}>
              <option value="">All levels</option>
              <option value="KG">KG</option>
              <option value="LOWER_PRIMARY">Lower Primary</option>
              <option value="UPPER_PRIMARY">Upper Primary</option>
              <option value="JHS">JHS</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Class</label>
            <select className="form-select" value={className} onChange={(e) => setClassName(e.target.value)}>
              <option value="">All classes</option>
              {[...options.classNames].sort(naturalSort).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Gender</label>
            <select className="form-select" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">All</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
            </select>
          </div>
          <div className="col-6 col-md-2">
            <label className="form-label small mb-1">Age</label>
            <select className="form-select" value={ageMode} onChange={(e) => setAgeMode(e.target.value as AgeMode)}>
              <option value="any">Any age</option>
              <option value="older">Older than</option>
              <option value="younger">Younger than</option>
              <option value="exactly">Exactly</option>
              <option value="between">Between</option>
            </select>
          </div>
          {ageMode !== "any" && (
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1">{ageMode === "between" ? "From (years)" : "Years"}</label>
              <input
                type="number"
                min={0}
                max={30}
                className="form-control"
                value={age1}
                onChange={(e) => setAge1(e.target.value)}
              />
            </div>
          )}
          {ageMode === "between" && (
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1">To (years)</label>
              <input
                type="number"
                min={0}
                max={30}
                className="form-control"
                value={age2}
                onChange={(e) => setAge2(e.target.value)}
              />
            </div>
          )}
          <div className="col-auto">
            <button type="button" className="btn btn-outline-secondary" onClick={reset}>
              Clear filters
            </button>
          </div>
        </div>
        <div className="text-muted small mt-2">Counts active learners only. Age is in completed years today.</div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {!stats && !error && <p className="text-muted">Loading…</p>}

      {stats && (
        <div className="row g-4">
          <div className="col-12">
            <GlowCard title="Your count">
              <div className="ig-hero">
                <div className="ig-hero-number">
                  <CountUp value={stats.total} />
                </div>
                <div>
                  <div className="mb-1">learners match:</div>
                  <div>
                    {chips.map((c, i) => (
                      <span className="ig-chip" key={`${c}-${i}`}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="ig-muted mt-2">
                    {stats.female.toLocaleString()} female &middot; {stats.male.toLocaleString()} male
                  </div>
                </div>
              </div>
            </GlowCard>
          </div>

          <div className="col-lg-5">
            <GlowCard title="Girls and boys" delay={100}>
              <GlowDonut male={stats.male} female={stats.female} />
            </GlowCard>
          </div>
          <div className="col-lg-7">
            <GlowCard title="By level" delay={200}>
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

          <div className="col-lg-6">
            <GlowCard title="By class" delay={300}>
              <GlowBars
                items={stats.byClass.map((c) => ({
                  label: c.label,
                  male: c.male,
                  female: c.female,
                  total: c.total,
                }))}
              />
            </GlowCard>
          </div>
          <div className="col-lg-6">
            <GlowCard title="By age" delay={400}>
              <GlowColumns items={stats.byAge} />
            </GlowCard>
          </div>

          {showSchoolFilter && !schoolId && (
            <div className="col-12">
              <GlowCard title="By school" delay={500}>
                <GlowBars
                  items={stats.bySchool.map((s) => ({
                    label: s.name,
                    male: s.male,
                    female: s.female,
                    total: s.total,
                  }))}
                />
              </GlowCard>
            </div>
          )}
          <div className="col-12 ig-muted">
            <span className="ig-dot m" />
            Male <span className="ms-3" />
            <span className="ig-dot f" />
            Female
          </div>
        </div>
      )}
    </div>
  );
}
