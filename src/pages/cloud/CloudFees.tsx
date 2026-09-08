import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { CloudTermService } from "@services/cloud/TermService";
import { CloudLevelService } from "@services/cloud/LevelService";
import { CloudFeeService } from "@services/cloud/FeeService";
import type {
  SchoolRow,
  TermRow,
  LevelRow,
  FeeStructureRow,
  SchoolFeeOverviewRow,
  ClassFeeOverviewRow,
  StudentFeeSummaryRow,
  FeePaymentMethod,
} from "@/types/database";

const PAYMENT_METHODS: Array<{ value: FeePaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

function money(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Fee management - see edulink_gh_phase1a_fees.sql. Private schools
 * only: schools that don't charge students a fee through EduLink GH
 * instead pay EduLink GH directly for the report-generation feature
 * (a separate, not-yet-built subscription gate) - see task #109 in
 * project notes, not this screen.
 *
 * Three views in one page, drilling down: class overview -> a class's
 * students -> one student's itemized fees (where a payment actually
 * gets recorded, since a payment always applies to one fee line item,
 * not a lump sum).
 */
export function CloudFees() {
  const { profile } = useCloudAuth();
  const schoolId = profile?.school_id ?? null;

  const [school, setSchool] = useState<SchoolRow | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [activeTerm, setActiveTerm] = useState<TermRow | null>(null);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [structures, setStructures] = useState<FeeStructureRow[]>([]);
  const [overview, setOverview] = useState<SchoolFeeOverviewRow[] | null>(null);

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newLevelId, setNewLevelId] = useState("");
  const [savingStructure, setSavingStructure] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<"overview" | "class" | "student">("overview");
  const [selectedClass, setSelectedClass] = useState<{ id: string; name: string } | null>(null);
  const [classStudents, setClassStudents] = useState<ClassFeeOverviewRow[] | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [studentFees, setStudentFees] = useState<StudentFeeSummaryRow[] | null>(null);

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<FeePaymentMethod>("cash");
  const [payReference, setPayReference] = useState("");
  const [payingFor, setPayingFor] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    CloudSchoolService.getProfile()
      .then(setSchool)
      .catch(() => setSchool(null))
      .finally(() => setLoadingSchool(false));
  }, []);

  useEffect(() => {
    if (!schoolId || !school?.is_private) return;
    CloudTermService.getActive(schoolId).then(setActiveTerm);
    CloudLevelService.list(schoolId).then(setLevels);
  }, [schoolId, school?.is_private]);

  function loadStructures() {
    if (!schoolId || !activeTerm) return;
    CloudFeeService.listStructures(schoolId, activeTerm.id).then(setStructures);
  }

  function loadOverview() {
    if (!schoolId || !activeTerm) return;
    CloudFeeService.getSchoolFeeOverview(schoolId, activeTerm.id).then(setOverview);
  }

  useEffect(loadStructures, [schoolId, activeTerm]);
  useEffect(loadOverview, [schoolId, activeTerm]);

  const levelName = useMemo(() => {
    const map = new Map(levels.map((l) => [l.id, l.name]));
    return (id: string | null) => (id ? map.get(id) ?? "Unknown level" : "All levels");
  }, [levels]);

  async function handleAddStructure(e: FormEvent) {
    e.preventDefault();
    if (!schoolId || !activeTerm || !newName.trim() || !newAmount) return;
    setSavingStructure(true);
    setError(null);
    try {
      await CloudFeeService.createStructure({
        schoolId,
        academicYearId: activeTerm.academic_year_id,
        termId: activeTerm.id,
        levelId: newLevelId || null,
        name: newName.trim(),
        amount: Number(newAmount),
      });
      setNewName("");
      setNewAmount("");
      setNewLevelId("");
      loadStructures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add this fee.");
    } finally {
      setSavingStructure(false);
    }
  }

  async function toggleStructure(row: FeeStructureRow) {
    await CloudFeeService.updateStructure(row.id, { is_active: !row.is_active });
    loadStructures();
  }

  async function handleGenerate() {
    if (!schoolId || !activeTerm) return;
    setGenerating(true);
    setGenerateMessage(null);
    setError(null);
    try {
      const result = await CloudFeeService.generateTermFees(schoolId, activeTerm.id);
      setGenerateMessage(
        result.created > 0
          ? `Created ${result.created} new fee record${result.created === 1 ? "" : "s"}.`
          : "Everyone already has this term's fees generated - nothing new to add."
      );
      loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate this term's fees.");
    } finally {
      setGenerating(false);
    }
  }

  function openClass(classId: string, className: string) {
    setSelectedClass({ id: classId, name: className });
    setClassStudents(null);
    setView("class");
    if (activeTerm) CloudFeeService.getClassFeeOverview(classId, activeTerm.id).then(setClassStudents);
  }

  function openStudent(studentId: string, studentName: string) {
    setSelectedStudent({ id: studentId, name: studentName });
    setStudentFees(null);
    setView("student");
    setPayingFor(null);
    if (activeTerm) CloudFeeService.getStudentFeeSummary(studentId, activeTerm.id).then(setStudentFees);
  }

  function refreshStudent() {
    if (activeTerm && selectedStudent) {
      CloudFeeService.getStudentFeeSummary(selectedStudent.id, activeTerm.id).then(setStudentFees);
    }
  }

  async function handleRecordPayment(e: FormEvent, studentFeeId: string) {
    e.preventDefault();
    if (!payAmount) return;
    setPayError(null);
    try {
      await CloudFeeService.recordPayment({
        studentFeeId,
        amount: Number(payAmount),
        method: payMethod,
        reference: payReference.trim() || null,
      });
      setPayAmount("");
      setPayReference("");
      setPayingFor(null);
      refreshStudent();
      loadOverview();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Could not record this payment.");
    }
  }

  if (loadingSchool) return <p className="text-muted">Loading…</p>;

  if (!school?.is_private) {
    return (
      <div>
        <h1 className="h4 mb-3">Fees</h1>
        <div className="actrs-card p-4">
          <p className="mb-0 text-muted">
            Fee management is only available for private schools that collect fees directly from parents. Public
            schools don't use this screen - EduLink GH access for public schools works on a school-wide subscription
            instead.
          </p>
        </div>
      </div>
    );
  }

  if (!activeTerm) {
    return (
      <div>
        <h1 className="h4 mb-3">Fees</h1>
        <div className="actrs-card p-4">
          <p className="mb-0 text-muted">No active term is set for this school yet - set one in Settings first.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="h4 mb-1">Fees</h1>
      <p className="text-muted mb-4">
        {activeTerm.term_name} - set what's owed, generate this term's invoices, and log payments as they come in.
      </p>

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {view === "overview" && (
        <>
          <div className="actrs-card p-4 mb-4">
            <h2 className="h6 fw-bold mb-3">This term's fees</h2>
            {structures.length === 0 ? (
              <p className="text-muted small mb-3">No fees set up for this term yet.</p>
            ) : (
              <table className="table table-sm align-middle mb-3">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Applies to</th>
                    <th className="text-end">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id} className={s.is_active ? "" : "text-muted"}>
                      <td>{s.name}</td>
                      <td>{levelName(s.level_id)}</td>
                      <td className="text-end">{money(s.amount)}</td>
                      <td className="text-end">
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => toggleStructure(s)}>
                          {s.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <form className="d-flex flex-wrap align-items-end gap-2" onSubmit={handleAddStructure}>
              <div>
                <label className="form-label small mb-1">Fee name</label>
                <input
                  className="form-control form-control-sm"
                  style={{ width: 180 }}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Tuition"
                  required
                />
              </div>
              <div>
                <label className="form-label small mb-1">Applies to</label>
                <select className="form-select form-select-sm" style={{ width: 160 }} value={newLevelId} onChange={(e) => setNewLevelId(e.target.value)}>
                  <option value="">All levels</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label small mb-1">Amount (GHS)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="form-control form-control-sm"
                  style={{ width: 120 }}
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" disabled={savingStructure}>
                {savingStructure ? "Adding…" : "Add fee"}
              </button>
            </form>
          </div>

          <div className="d-flex align-items-center gap-2 mb-3">
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={handleGenerate} disabled={generating || structures.length === 0}>
              {generating ? "Generating…" : "Generate this term's fees"}
            </button>
            {generateMessage && <span className="text-muted small">{generateMessage}</span>}
          </div>

          <div className="actrs-card p-0">
            <div className="p-3 border-bottom">
              <h2 className="h6 fw-bold mb-0">By class</h2>
            </div>
            {!overview ? (
              <p className="text-muted small p-3 mb-0">Loading…</p>
            ) : overview.length === 0 ? (
              <p className="text-muted small p-3 mb-0">No fee records yet - generate this term's fees above.</p>
            ) : (
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th className="text-end">Students</th>
                    <th className="text-end">Total due</th>
                    <th className="text-end">Total paid</th>
                    <th className="text-end">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.map((r) => (
                    <tr key={r.class_id} role="button" onClick={() => openClass(r.class_id, r.class_name)}>
                      <td className="fw-semibold">{r.class_name}</td>
                      <td className="text-end">{r.student_count}</td>
                      <td className="text-end">{money(r.total_due)}</td>
                      <td className="text-end">{money(r.total_paid)}</td>
                      <td className="text-end">
                        <span className={`badge ${r.balance > 0 ? "text-bg-warning" : "text-bg-success"}`}>{money(r.balance)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {view === "class" && selectedClass && (
        <>
          <button type="button" className="btn btn-link px-0 mb-2" onClick={() => setView("overview")}>
            &larr; Back to classes
          </button>
          <div className="actrs-card p-0">
            <div className="p-3 border-bottom">
              <h2 className="h6 fw-bold mb-0">{selectedClass.name}</h2>
            </div>
            {!classStudents ? (
              <p className="text-muted small p-3 mb-0">Loading…</p>
            ) : (
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th className="text-end">Due</th>
                    <th className="text-end">Paid</th>
                    <th className="text-end">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((s) => (
                    <tr key={s.student_id} role="button" onClick={() => openStudent(s.student_id, s.student_name)}>
                      <td>{s.student_name}</td>
                      <td className="text-end">{money(s.total_due)}</td>
                      <td className="text-end">{money(s.total_paid)}</td>
                      <td className="text-end">
                        <span className={`badge ${s.balance > 0 ? "text-bg-warning" : "text-bg-success"}`}>{money(s.balance)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {view === "student" && selectedStudent && (
        <>
          <button type="button" className="btn btn-link px-0 mb-2" onClick={() => setView("class")}>
            &larr; Back to {selectedClass?.name}
          </button>
          <div className="actrs-card p-0">
            <div className="p-3 border-bottom">
              <h2 className="h6 fw-bold mb-0">{selectedStudent.name}</h2>
            </div>
            {!studentFees ? (
              <p className="text-muted small p-3 mb-0">Loading…</p>
            ) : (
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th>Fee</th>
                    <th className="text-end">Due</th>
                    <th className="text-end">Paid</th>
                    <th className="text-end">Balance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {studentFees.map((f) => (
                    <Fragment key={f.student_fee_id}>
                      <tr>
                        <td>{f.fee_name}</td>
                        <td className="text-end">{money(f.amount_due)}</td>
                        <td className="text-end">{money(f.amount_paid)}</td>
                        <td className="text-end">{money(f.balance)}</td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => {
                              setPayingFor(payingFor === f.student_fee_id ? null : f.student_fee_id);
                              setPayAmount(f.balance > 0 ? String(f.balance) : "");
                              setPayError(null);
                            }}
                          >
                            Record payment
                          </button>
                        </td>
                      </tr>
                      {payingFor === f.student_fee_id && (
                        <tr>
                          <td colSpan={5} className="bg-body-tertiary">
                            <form className="d-flex flex-wrap align-items-end gap-2 py-2" onSubmit={(e) => handleRecordPayment(e, f.student_fee_id)}>
                              {payError && <div className="alert alert-danger py-1 px-2 mb-0 small">{payError}</div>}
                              <div>
                                <label className="form-label small mb-1">Amount (GHS)</label>
                                <input
                                  type="number"
                                  min={0.01}
                                  step="0.01"
                                  className="form-control form-control-sm"
                                  style={{ width: 120 }}
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <label className="form-label small mb-1">Method</label>
                                <select
                                  className="form-select form-select-sm"
                                  style={{ width: 150 }}
                                  value={payMethod}
                                  onChange={(e) => setPayMethod(e.target.value as FeePaymentMethod)}
                                >
                                  {PAYMENT_METHODS.map((m) => (
                                    <option key={m.value} value={m.value}>
                                      {m.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="form-label small mb-1">Reference (optional)</label>
                                <input
                                  className="form-control form-control-sm"
                                  style={{ width: 160 }}
                                  value={payReference}
                                  onChange={(e) => setPayReference(e.target.value)}
                                  placeholder="Receipt / MoMo ref"
                                />
                              </div>
                              <button type="submit" className="btn btn-primary btn-sm">
                                Save payment
                              </button>
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
