import type { MockFull } from "@/services/cloud/MockExamService";
import { rankSubjects } from "@/mock/mockAnalysis";
import { useMockAnalysis } from "@pages/cloud/mock/MockOverview";
import { Bar, TONE_COLOR, ToneBadge } from "@pages/cloud/mock/MockUi";

/** Subject analysis: one plain card per subject, with the detail table underneath. */
export function MockSubjects({ data }: { data: MockFull }) {
  const a = useMockAnalysis(data);
  const lower = data.mock.grading.lowerIsBetter;
  const ordered = rankSubjects(a.subjectList, lower);
  const grades = data.mock.grading.bands.map((b) => b.grade).sort((x, y) => x - y);

  return (
    <div>
      <div className="row g-3 mb-3">
        {ordered.map((s) => (
          <div className="col-md-6 col-xl-4" key={s.subjectId}>
            <div className="card h-100" style={{ borderColor: TONE_COLOR[s.verdict.tone].border }}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div className="fw-semibold">{s.name}</div>
                  <ToneBadge tone={s.verdict.tone}>{s.verdict.word}</ToneBadge>
                </div>
                <div className="d-flex align-items-center gap-2 mt-2">
                  <Bar value={s.passPct ?? 0} max={100} color={TONE_COLOR[s.verdict.tone].fg} />
                  <div className="small" style={{ width: 60 }}>
                    {s.passPct === null ? "—" : `${s.passPct}%`}
                  </div>
                </div>
                <div className="small mt-2">{s.verdict.sentence}</div>
                {s.maleMeanGrade !== null && s.femaleMeanGrade !== null && s.valid >= 6 && (
                  <div className="small text-muted mt-1">
                    Average grade: boys {s.maleMeanGrade} · girls {s.femaleMeanGrade}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="table-responsive">
        <table className="table table-sm table-bordered text-center align-middle">
          <thead className="table-light">
            <tr>
              <th className="text-start">Subject</th>
              <th>Marks (n)</th>
              <th>Average mark %</th>
              <th>Mean grade</th>
              <th>Median</th>
              <th>Most common</th>
              <th>Passed (grade 1-5)</th>
              {grades.map((g) => (
                <th key={g}>G{g}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.subjectList.map((s) => (
              <tr key={s.subjectId}>
                <td className="text-start">{s.name}</td>
                <td>{s.valid}</td>
                <td>{s.meanPct === null ? "—" : s.meanPct.toFixed(1)}</td>
                <td>{s.meanGrade ?? "—"}</td>
                <td>{s.medianGrade ?? "—"}</td>
                <td>{s.modeGrade ?? "—"}</td>
                <td>{s.passPct === null ? "—" : `${s.passed} (${s.passPct}%)`}</td>
                {grades.map((g) => (
                  <td key={g}>{s.gradeCounts[g] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small text-muted">
        A subject is marked “Needs support” when fewer than 60% pass or the average grade is weaker than 5. A subject needs at least 5 marks before it is judged. Absent and not-yet-entered marks are never counted as zero.
      </p>
    </div>
  );
}
