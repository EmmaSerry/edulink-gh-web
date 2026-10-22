import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudAcademicYearService } from "@services/cloud/AcademicYearService";
import {
  MockExamService,
  STATUS_LABEL,
  type CatalogueSubject,
  type EligibleCandidate,
  type MockListItem,
  type SavedScheme,
} from "@/services/cloud/MockExamService";
import { MockGradingSchemes } from "@pages/cloud/mock/MockGradingSchemes";
import type { CoreKey } from "@/mock/mockEngine";
import type { AcademicYearRow } from "@/types/database";

const CORE_OPTIONS: Array<{ key: CoreKey; label: string; match: RegExp }> = [
  { key: "english", label: "English Language", match: /english/i },
  { key: "mathematics", label: "Mathematics", match: /math/i },
  { key: "science", label: "Science", match: /^(integrated\s+)?science|general science/i },
  { key: "social_studies", label: "Social Studies", match: /social\s*stud/i },
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

interface SubjectPick {
  subjectId: string;
  name: string;
  code: string;
  selected: boolean;
  coreKey: CoreKey | "";
  maxMark: number;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "secondary",
  open: "success",
  entry_closed: "warning",
  finalised: "primary",
};

export function CloudMockExams() {
  const { profile } = useCloudAuth();
  const nav = useNavigate();
  const isAdmin = profile?.role === "school_admin" || profile?.role === "platform_admin";
  const [tab, setTab] = useState<"list" | "new" | "grading">("list");
  const [mocks, setMocks] = useState<MockListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMocks(await MockExamService.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load mock examinations.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between mb-3 gap-2">
        <div>
          <h4 className="mb-0">Mock Exams</h4>
          <div className="text-muted small">BECE-style mock examination analysis for JHS 3. Separate from terminal reports.</div>
        </div>
        <ul className="nav nav-pills">
          <li className="nav-item">
            <button className={`nav-link ${tab === "list" ? "active" : ""}`} onClick={() => setTab("list")}>
              All mocks
            </button>
          </li>
          {isAdmin && (
            <li className="nav-item">
              <button className={`nav-link ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>
                New mock
              </button>
            </li>
          )}
          {(isAdmin || profile?.role === "teacher") && (
            <li className="nav-item">
              <button className={`nav-link ${tab === "grading" ? "active" : ""}`} onClick={() => setTab("grading")}>
                Grading schemes
              </button>
            </li>
          )}
        </ul>
      </div>
      {error && <div className="alert alert-danger">{error}</div>}

      {tab === "list" && (
        <div className="card">
          <div className="card-body">
            {loading ? (
              <div className="text-muted">Loading…</div>
            ) : mocks.length === 0 ? (
              <div className="text-muted">
                No mock examinations yet.
                {isAdmin ? " Choose “New mock” to set one up." : ""}
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      {profile?.role !== "school_admin" && profile?.role !== "teacher" && <th>School</th>}
                      <th>Mock</th>
                      <th>Year</th>
                      <th>Status</th>
                      <th className="text-end">Candidates</th>
                      <th className="text-end">Marks</th>
                      <th className="text-end">Complete aggregates</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {mocks.map((m) => (
                      <tr key={m.id}>
                        {profile?.role !== "school_admin" && profile?.role !== "teacher" && <td>{m.schoolName}</td>}
                        <td className="fw-semibold">{m.name}</td>
                        <td>{m.academicYearLabel}</td>
                        <td>
                          <span className={`badge text-bg-${STATUS_BADGE[m.status]}`}>{STATUS_LABEL[m.status]}</span>
                        </td>
                        <td className="text-end">{m.candidates}</td>
                        <td className="text-end">{m.marksRecorded}</td>
                        <td className="text-end">
                          {m.completeAggregates} / {m.candidates}
                        </td>
                        <td className="text-end">
                          <Link className="btn btn-sm btn-primary" to={`/mock-exams/${m.id}`}>
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "grading" && <MockGradingSchemes canEdit={isAdmin} />}
      {tab === "new" && isAdmin && (
        <MockSetupWizard
          onCreated={(id) => {
            void load();
            nav(`/mock-exams/${id}`);
          }}
          onNeedScheme={() => setTab("grading")}
        />
      )}
    </div>
  );
}

function MockSetupWizard({ onCreated, onNeedScheme }: { onCreated: (id: string) => void; onNeedScheme: () => void }) {
  const [step, setStep] = useState(1);
  const [years, setYears] = useState<AcademicYearRow[]>([]);
  const [schemes, setSchemes] = useState<SavedScheme[]>([]);
  const [catalogue, setCatalogue] = useState<CatalogueSubject[]>([]);
  const [eligible, setEligible] = useState<EligibleCandidate[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [yearId, setYearId] = useState("");
  const [seriesKey, setSeriesKey] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [schemeId, setSchemeId] = useState("");
  const [target, setTarget] = useState("");
  const [picks, setPicks] = useState<SubjectPick[]>([]);
  const [chosen, setChosen] = useState<Record<string, { included: boolean; excluded: boolean; reason: string }>>({});

  useEffect(() => {
    (async () => {
      try {
        const [y, s, c, cur] = await Promise.all([
          CloudAcademicYearService.list(),
          MockExamService.listSchemes(),
          MockExamService.catalogueSubjects(),
          CloudAcademicYearService.getCurrent(),
        ]);
        setYears(y);
        setSchemes(s);
        setCatalogue(c);
        setYearId(cur?.id ?? y[0]?.id ?? "");
        setSchemeId(s.find((x) => x.isDefault)?.id ?? s[0]?.id ?? "");
        setPicks(
          c.map((sub) => {
            const core = CORE_OPTIONS.find((o) => o.match.test(sub.name));
            return { subjectId: sub.id, name: sub.name, code: slug(sub.name), selected: !!core, coreKey: core?.key ?? "", maxMark: 100 };
          })
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load setup data.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    MockExamService.eligibleCandidates(showAll)
      .then((list) => {
        setEligible(list);
        setChosen((prev) => {
          const next = { ...prev };
          for (const c of list) if (!next[c.studentId]) next[c.studentId] = { included: c.isJhs3, excluded: false, reason: "" };
          return next;
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load learners."));
  }, [showAll]);

  const scheme = schemes.find((s) => s.id === schemeId);
  useEffect(() => {
    if (scheme) setPicks((p) => p.map((x) => (x.maxMark === 100 || !x.maxMark ? { ...x, maxMark: scheme.maxMark } : x)));
  }, [schemeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedSubjects = picks.filter((p) => p.selected);
  const coreKeys = selectedSubjects.map((p) => p.coreKey).filter(Boolean);
  const coreOk = CORE_OPTIONS.every((o) => coreKeys.filter((k) => k === o.key).length === 1) && coreKeys.length === 4;
  const electives = selectedSubjects.filter((p) => !p.coreKey).length;
  const chosenCandidates = useMemo(() => eligible.filter((c) => chosen[c.studentId]?.included), [eligible, chosen]);
  const missingReason = chosenCandidates.some((c) => chosen[c.studentId]?.excluded && !chosen[c.studentId]?.reason.trim());

  const step1Ok = name.trim() && yearId && schemeId;
  const step2Ok = coreOk && electives >= 2;
  const step3Ok = chosenCandidates.length > 0 && !missingReason;

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const id = await MockExamService.create({
        name: name.trim(),
        description: description.trim() || undefined,
        seriesKey: seriesKey.trim() || undefined,
        academicYearId: yearId,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        schemeId,
        targetAggregate: target ? Number(target) : null,
        subjects: selectedSubjects.map((p) => ({
          code: p.code,
          name: p.name,
          subjectId: p.subjectId,
          isCore: !!p.coreKey,
          coreKey: p.coreKey || null,
          maxMark: p.maxMark,
        })),
        candidates: chosenCandidates.map((c) => ({
          studentId: c.studentId,
          excluded: chosen[c.studentId].excluded,
          reason: chosen[c.studentId].reason,
        })),
      });
      onCreated(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the mock.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-muted">Loading…</div>;
  if (schemes.length === 0)
    return (
      <div className="alert alert-warning">
        Create a grading scheme first.{" "}
        <button className="btn btn-sm btn-primary ms-2" onClick={onNeedScheme}>
          Go to grading schemes
        </button>
      </div>
    );

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-3 small text-muted">Step {step} of 4 — {["Details", "Subjects", "Candidates", "Review"][step - 1]}</div>
        {error && <div className="alert alert-danger">{error}</div>}

        {step === 1 && (
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label">Mock name</label>
              <input className="form-control" placeholder="e.g. Mock 1" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Academic year</label>
              <select className="form-select" value={yearId} onChange={(e) => setYearId(e.target.value)}>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Grading scheme</label>
              <select className="form-select" value={schemeId} onChange={(e) => setSchemeId(e.target.value)}>
                {schemes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Start date</label>
              <input type="date" className="form-control" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">End date</label>
              <input type="date" className="form-control" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Series label (optional)</label>
              <input className="form-control" placeholder="e.g. BECE mock series" value={seriesKey} onChange={(e) => setSeriesKey(e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Target aggregate (optional)</label>
              <input type="number" className="form-control" placeholder="e.g. 15" value={target} onChange={(e) => setTarget(e.target.value)} />
            </div>
            <div className="col-12">
              <label className="form-label">Description / notes (optional)</label>
              <textarea className="form-control" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="small text-muted">
              Tick the subjects in this mock. Mark exactly one subject for each core slot; every other ticked subject is a non-core subject (the best two count towards the
              aggregate).
            </p>
            {catalogue.length === 0 ? (
              <div className="alert alert-warning">No subjects found. Add subjects under Settings → Subjects first.</div>
            ) : (
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th style={{ width: 40 }} />
                    <th>Subject</th>
                    <th>Role in aggregate</th>
                    <th style={{ width: 120 }}>Max mark</th>
                  </tr>
                </thead>
                <tbody>
                  {picks.map((p, i) => (
                    <tr key={p.subjectId}>
                      <td>
                        <input
                          type="checkbox"
                          className="form-check-input"
                          checked={p.selected}
                          onChange={(e) => setPicks(picks.map((x, j) => (j === i ? { ...x, selected: e.target.checked } : x)))}
                        />
                      </td>
                      <td>{p.name}</td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          disabled={!p.selected}
                          value={p.coreKey}
                          onChange={(e) => setPicks(picks.map((x, j) => (j === i ? { ...x, coreKey: e.target.value as CoreKey | "" } : x)))}
                        >
                          <option value="">Non-core</option>
                          {CORE_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              Core: {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          className="form-control form-control-sm"
                          disabled={!p.selected}
                          value={p.maxMark}
                          onChange={(e) => setPicks(picks.map((x, j) => (j === i ? { ...x, maxMark: Number(e.target.value) } : x)))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!coreOk && <div className="alert alert-warning small">Assign each of English Language, Mathematics, Science and Social Studies to exactly one ticked subject.</div>}
            {coreOk && electives < 2 && <div className="alert alert-warning small">Tick at least two non-core subjects.</div>}
            {scheme && selectedSubjects.some((s) => s.maxMark !== scheme.maxMark) && (
              <div className="alert alert-info small">Some subjects have a different maximum from the scheme ({scheme.maxMark}); their marks are scaled proportionally before grading.</div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="d-flex align-items-center justify-content-between mb-2">
              <p className="small text-muted mb-0">Learners come from your existing student records. Nobody is copied or duplicated.</p>
              <div className="form-check">
                <input id="showall" type="checkbox" className="form-check-input" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
                <label htmlFor="showall" className="form-check-label small">
                  Show learners from other classes too
                </label>
              </div>
            </div>
            {eligible.length === 0 ? (
              <div className="alert alert-warning">No JHS 3 learners found. Tick “Show learners from other classes” if your class is named differently.</div>
            ) : (
              <div className="table-responsive" style={{ maxHeight: 420, overflow: "auto" }}>
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }} />
                      <th>Learner</th>
                      <th>Class</th>
                      <th>Exclude</th>
                      <th>Reason (required if excluded)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eligible.map((c) => {
                      const st = chosen[c.studentId] ?? { included: false, excluded: false, reason: "" };
                      const patch = (p: Partial<typeof st>) => setChosen({ ...chosen, [c.studentId]: { ...st, ...p } });
                      return (
                        <tr key={c.studentId}>
                          <td>
                            <input type="checkbox" className="form-check-input" checked={st.included} onChange={(e) => patch({ included: e.target.checked })} />
                          </td>
                          <td>{c.fullName}</td>
                          <td>{c.className}</td>
                          <td>
                            <input type="checkbox" className="form-check-input" disabled={!st.included} checked={st.excluded} onChange={(e) => patch({ excluded: e.target.checked })} />
                          </td>
                          <td>
                            <input
                              className="form-control form-control-sm"
                              disabled={!st.excluded}
                              value={st.reason}
                              onChange={(e) => patch({ reason: e.target.value })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="small mt-2">{chosenCandidates.length} selected.</div>
          </div>
        )}

        {step === 4 && (
          <div>
            <dl className="row small mb-3">
              <dt className="col-sm-3">Mock</dt>
              <dd className="col-sm-9">{name}</dd>
              <dt className="col-sm-3">Grading</dt>
              <dd className="col-sm-9">
                {scheme?.name} (max {scheme?.maxMark}, {scheme?.lowerIsBetter ? "lower is better" : "higher is better"})
              </dd>
              <dt className="col-sm-3">Subjects</dt>
              <dd className="col-sm-9">{selectedSubjects.map((s) => s.name + (s.coreKey ? " (core)" : "")).join(", ")}</dd>
              <dt className="col-sm-3">Candidates</dt>
              <dd className="col-sm-9">
                {chosenCandidates.filter((c) => !chosen[c.studentId].excluded).length} sitting,{" "}
                {chosenCandidates.filter((c) => chosen[c.studentId].excluded).length} excluded
              </dd>
            </dl>
            <div className="alert alert-info small mb-0">
              The mock is created as a <strong>Draft</strong>. Open it for marks entry when ready. The grading scheme is frozen into this mock when you create it.
            </div>
          </div>
        )}

        <div className="d-flex justify-content-between mt-4">
          <button className="btn btn-outline-secondary" disabled={step === 1} onClick={() => setStep(step - 1)}>
            Back
          </button>
          {step < 4 ? (
            <button className="btn btn-primary" disabled={(step === 1 && !step1Ok) || (step === 2 && !step2Ok) || (step === 3 && !step3Ok)} onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button className="btn btn-success" disabled={busy} onClick={create}>
              {busy ? "Creating…" : "Create mock"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
