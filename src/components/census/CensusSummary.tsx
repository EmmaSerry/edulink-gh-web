import { useMemo, useRef } from "react";
import {
  aggregate, boysT, girlsT, CLASS_ROWS, fmt, g, grand, jhsT, kgT, levelLabel, pct, priT, ratio, rooms, rowTotal,
  teachers, titleCase, trained, levelsNote, type Agg, type CensusRow, type LevelSel,
} from "./censusModel";
import { ChartCard, COLORS, Donut, GroupedVBars, HBars, StackedHBars } from "./CensusCharts";
import { Count } from "./censusFx";
import { openPrint } from "./censusPrint";

/** Numbers and charts for the (already filtered) schools. */

function Kpi({ label, value, sub, glow, i, decimals = 0, suffix = "" }: { label: string; value: number | null; sub?: string; glow: string; i: number; decimals?: number; suffix?: string }) {
  return (
    <div className="col-6 col-md-4 col-xl-2">
      <div className="actrs-card cx-glass cx-kpi cx-rise p-3 h-100" style={{ ["--i" as string]: i, ["--glow" as string]: glow }}>
        <div className="text-muted small">{label}</div>
        <div className="fs-3">{value === null ? "-" : <Count value={value} decimals={decimals} suffix={suffix} />}</div>
        {sub && <div className="text-muted" style={{ fontSize: "0.72rem" }}>{sub}</div>}
      </div>
    </div>
  );
}

export function CensusSummary({ rows, subtitle, sel, chips }: { rows: CensusRow[]; subtitle: string; sel: LevelSel; chips: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  const d = useMemo(() => {
    const all = aggregate(rows);
    const pub = aggregate(rows.filter((r) => r.school_type === "PUBLIC"));
    const pri = aggregate(rows.filter((r) => r.school_type === "PRIVATE"));
    const countBy = (f: (r: CensusRow) => string) => {
      const m = new Map<string, CensusRow[]>();
      for (const r of rows) {
        const k = f(r);
        const l = m.get(k);
        if (l) l.push(r);
        else m.set(k, [r]);
      }
      return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    };
    const circuits = countBy((r) => titleCase(r.circuit)).map(([k, list]) => ({ k, list, a: aggregate(list) }));
    const levels = countBy((r) => levelLabel(r.school_level));
    const sized = rows.map((r) => ({ name: r.name, total: rowTotal(r) })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total);
    return { all, pub, pri, circuits, levels, sized };
  }, [rows]);

  const { all, pub, pri, circuits, levels, sized } = d;
  const girls = girlsT(all);
  const boys = boysT(all);
  const feedYes = rows.filter((r) => r.feeding === "YES");
  const feedNo = rows.filter((r) => r.feeding === "NO");
  const feedUnknown = rows.length - feedYes.length - feedNo.length;
  const flagged = rows.filter((r) => r.follow_up.length > 0).length;

  const cmpRows: { label: string; f: (a: Agg) => string }[] = [
    { label: "Schools", f: (a) => fmt(a.schools) },
    ...(sel.kg ? [{ label: "KG pupils", f: (a: Agg) => fmt(kgT(a)) }] : []),
    ...(sel.pri ? [{ label: "Primary pupils", f: (a: Agg) => fmt(priT(a)) }] : []),
    ...(sel.jhs ? [{ label: "JHS pupils", f: (a: Agg) => fmt(jhsT(a)) }] : []),
    { label: "All pupils", f: (a) => fmt(grand(a)) },
    { label: "Boys", f: (a) => fmt(boysT(a)) },
    { label: "Girls", f: (a) => fmt(girlsT(a)) },
    { label: "Girls %", f: (a) => pct(girlsT(a), grand(a)) },
    { label: "Girls per 100 boys", f: (a) => (boysT(a) ? fmt((girlsT(a) / boysT(a)) * 100, 1) : "-") },
    { label: "Teachers", f: (a) => fmt(teachers(a)) },
    { label: "Trained teachers %", f: (a) => pct(trained(a), teachers(a)) },
    { label: "Pupils per teacher", f: (a) => fmt(ratio(grand(a), teachers(a)), 1) },
    { label: "Classrooms", f: (a) => fmt(rooms(a)) },
    { label: "Pupils per classroom", f: (a) => fmt(ratio(grand(a), rooms(a)), 1) },
    { label: "Average school size", f: (a) => (a.schools ? fmt(grand(a) / a.schools, 0) : "-") },
  ];

  function print() {
    if (!ref.current) return;
    openPrint({
      title: "District School Census: Summary and Charts",
      subtitle: subtitle,
      chips,
      kpis: [
        { label: "Schools", value: fmt(all.schools) },
        { label: "Pupils", value: fmt(grand(all)) },
        { label: "Boys", value: fmt(boys) },
        { label: "Girls", value: fmt(girls) },
        { label: "Teachers", value: fmt(teachers(all)) },
        { label: "Pupils per teacher", value: fmt(ratio(grand(all), teachers(all)), 1) },
      ],
      bodyHtml: ref.current.innerHTML,
      useAppStyles: true,
    });
  }

  if (rows.length === 0) return <div className="alert alert-warning">No schools match these filters.</div>;

  return (
    <div>
      <div className="d-flex justify-content-end mb-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={print}>
          <i className="bi bi-printer me-1" />Print summary / PDF
        </button>
      </div>
      <div ref={ref}>
        <div className="row g-3 mb-3">
          <Kpi i={0} glow="#1c6feb" label="Schools" value={all.schools} sub={`${fmt(pub.schools)} public, ${fmt(pri.schools)} private`} />
          <Kpi i={1} glow="#7a5cfa" label={`Pupils${levelsNote(sel) ? " (" + levelsNote(sel).toLowerCase() + ")" : " (KG to JHS)"}`} value={grand(all)} sub={`Average ${all.schools ? fmt(grand(all) / all.schools) : "-"} per school`} />
          <Kpi i={2} glow="#1c6feb" label="Boys" value={boys} sub={pct(boys, grand(all))} />
          <Kpi i={3} glow="#e64a9b" label="Girls" value={girls} sub={pct(girls, grand(all))} />
          <Kpi i={4} glow="#16a3b8" label="Teachers" value={teachers(all)} sub={`${pct(trained(all), teachers(all))} trained`} />
          <Kpi i={5} glow="#f0a500" label="Pupils per teacher" value={ratio(grand(all), teachers(all))} decimals={1} sub={`${fmt(ratio(grand(all), rooms(all)), 1)} per classroom`} />
        </div>

        <div className="row g-3 mb-3">
          <div className="col-md-6 col-xl-3">
            <ChartCard i={6} title="Boys and girls">
              <Donut
                data={[{ label: "Boys", value: boys, color: COLORS.boys }, { label: "Girls", value: girls, color: COLORS.girls }]}
                centerTop={pct(girls, grand(all), 0)}
                centerBottom="girls"
              />
            </ChartCard>
          </div>
          <div className="col-md-6 col-xl-3">
            <ChartCard i={7} title="Pupils: public and private">
              <Donut
                data={[{ label: "Public", value: grand(pub), color: COLORS.public }, { label: "Private", value: grand(pri), color: COLORS.private }]}
                centerTop={pct(grand(pri), grand(all), 0)}
                centerBottom="private"
              />
            </ChartCard>
          </div>
          <div className="col-md-6 col-xl-3">
            <ChartCard i={8} title="Schools: public and private">
              <Donut
                data={[{ label: "Public", value: pub.schools, color: COLORS.public }, { label: "Private", value: pri.schools, color: COLORS.private }]}
                centerTop={fmt(all.schools)}
                centerBottom="schools"
              />
            </ChartCard>
          </div>
          <div className="col-md-6 col-xl-3">
            <ChartCard i={9} title="School feeding programme" note="Number of schools">
              <Donut
                data={[
                  { label: "Beneficiary", value: feedYes.length, color: COLORS.a },
                  { label: "Not a beneficiary", value: feedNo.length, color: COLORS.grey },
                  ...(feedUnknown ? [{ label: "Not stated", value: feedUnknown, color: COLORS.d }] : []),
                ]}
                centerTop={fmt(feedYes.length)}
                centerBottom="in programme"
              />
            </ChartCard>
          </div>
        </div>

        <div className="actrs-card cx-glass cx-rise p-3 mb-3" style={{ ["--i" as string]: 5 }}>
          <div className="cx-title mb-2">Public and private compared</div>
          <div className="table-responsive">
            <table className="table table-sm mb-0 align-middle">
              <thead>
                <tr>
                  <th></th>
                  <th className="text-end">Public</th>
                  <th className="text-end">Private</th>
                  <th className="text-end">Whole district</th>
                </tr>
              </thead>
              <tbody>
                {cmpRows.map((r) => (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td className="text-end">{r.f(pub)}</td>
                    <td className="text-end">{r.f(pri)}</td>
                    <td className="text-end fw-semibold">{r.f(all)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <ChartCard i={10} title="Boys and girls by level">
              <GroupedVBars
                labels={["Boys", "Girls"]}
                colors={[COLORS.boys, COLORS.girls]}
                items={[
                  { label: "KG", a: g(all, "kg_b"), b: g(all, "kg_g"), on: sel.kg },
                  { label: "Primary", a: g(all, "pri_b"), b: g(all, "pri_g"), on: sel.pri },
                  { label: "JHS", a: g(all, "jhs_b"), b: g(all, "jhs_g"), on: sel.jhs },
                ].filter((x) => x.on)}
              />
            </ChartCard>
          </div>
          <div className="col-lg-6">
            <ChartCard i={11} title="Boys and girls in every class" note="Nursery/Creche is not part of the KG total.">
              <GroupedVBars
                labels={["Boys", "Girls"]}
                colors={[COLORS.boys, COLORS.girls]}
                items={CLASS_ROWS.filter((c) => (c.key === "nur" ? sel.nur : c.key.startsWith("kg") ? sel.kg : c.key.startsWith("p") ? sel.pri : sel.jhs)).map((c) => ({ label: c.label.replace("Nursery / Creche", "Nur."), a: g(all, `${c.key}_b`), b: g(all, `${c.key}_g`) }))}
              />
            </ChartCard>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <ChartCard i={12} title="Public and private by level (pupils)">
              <GroupedVBars
                labels={["Public", "Private"]}
                colors={[COLORS.public, COLORS.private]}
                items={[
                  { label: "KG", a: kgT(pub), b: kgT(pri), on: sel.kg },
                  { label: "Primary", a: priT(pub), b: priT(pri), on: sel.pri },
                  { label: "JHS", a: jhsT(pub), b: jhsT(pri), on: sel.jhs },
                ].filter((x) => x.on)}
              />
            </ChartCard>
          </div>
          <div className="col-lg-6">
            <ChartCard i={13} title="Teachers by level">
              <GroupedVBars
                labels={["Male", "Female"]}
                colors={[COLORS.boys, COLORS.girls]}
                items={[
                  { label: "KG", a: g(all, "t_kg_m"), b: g(all, "t_kg_f"), on: sel.kg },
                  { label: "Primary", a: g(all, "t_pri_m"), b: g(all, "t_pri_f"), on: sel.pri },
                  { label: "JHS", a: g(all, "t_jhs_m"), b: g(all, "t_jhs_f"), on: sel.jhs },
                ].filter((x) => x.on)}
              />
            </ChartCard>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <ChartCard i={14} title="Pupils by circuit (boys and girls)">
              <StackedHBars
                labels={["Boys", "Girls"]}
                colors={[COLORS.boys, COLORS.girls]}
                items={circuits.map((c) => ({ label: `${c.k} (${c.list.length})`, a: boysT(c.a), b: girlsT(c.a) })).sort((x, y) => y.a + y.b - (x.a + x.b))}
              />
            </ChartCard>
          </div>
          <div className="col-lg-6">
            <ChartCard i={15} title="Pupils per teacher, by circuit">
              <HBars
                color={COLORS.b}
                decimals={1}
                items={circuits
                  .map((c) => ({ label: c.k, value: ratio(grand(c.a), teachers(c.a)) ?? 0 }))
                  .sort((x, y) => y.value - x.value)}
              />
            </ChartCard>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <ChartCard i={16} title="Girls % by circuit">
              <HBars
                color={COLORS.girls}
                decimals={1}
                items={circuits
                  .map((c) => ({ label: c.k, value: grand(c.a) ? (girlsT(c.a) / grand(c.a)) * 100 : 0 }))
                  .sort((x, y) => y.value - x.value)}
              />
            </ChartCard>
          </div>
          <div className="col-lg-6">
            <ChartCard i={17} title="Pupils per classroom, by circuit">
              <HBars
                color={COLORS.c}
                decimals={1}
                items={circuits
                  .map((c) => ({ label: c.k, value: ratio(grand(c.a), rooms(c.a)) ?? 0 }))
                  .sort((x, y) => y.value - x.value)}
              />
            </ChartCard>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <ChartCard i={18} title="Ten largest schools (pupils)">
              <HBars items={sized.slice(0, 10).map((s) => ({ label: s.name, value: s.total }))} />
            </ChartCard>
          </div>
          <div className="col-lg-6">
            <ChartCard i={19} title="Ten smallest schools (pupils)">
              <HBars color={COLORS.d} items={sized.slice(-10).reverse().map((s) => ({ label: s.name, value: s.total }))} />
            </ChartCard>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-6">
            <ChartCard i={20} title="Schools by level of schooling">
              <Donut
                data={levels.map(([k, list], i) => ({
                  label: k,
                  value: list.length,
                  color: [COLORS.a, COLORS.b, COLORS.c, COLORS.d, COLORS.e][i % 5],
                }))}
                centerBottom="schools"
              />
            </ChartCard>
          </div>
          <div className="col-lg-6">
            <ChartCard i={21} title="Schools per circuit">
              <HBars color={COLORS.a} items={circuits.map((c) => ({ label: c.k, value: c.list.length })).sort((x, y) => y.value - x.value)} />
              <div className="text-muted mt-2" style={{ fontSize: "0.75rem" }}>
                {flagged} school(s) still have fields marked for follow-up.
              </div>
            </ChartCard>
          </div>
        </div>
      </div>
    </div>
  );
}
