import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import JSZip from "jszip";
import { downloadBlob } from "@utils/downloadBlob";
import { CloudSchoolService } from "@services/cloud/SchoolService";
import { MockExamService, type MockFull } from "@/services/cloud/MockExamService";
import { drawSlip, drawSlips, type PdfDoc, type SlipData } from "@/mock/slipPdf";
import { buildSlip, type SlipSchool } from "@/mock/slipData";
import { useMockSnapshots } from "@pages/cloud/mock/useMockSnapshots";
import { ToneBadge } from "@pages/cloud/mock/MockUi";

const newDoc = () => new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 80) || "slip";

/** Result slips: one A4 page per learner, downloadable one by one, as one PDF, or as a ZIP of single PDFs. */
export function MockSlips({ data }: { data: MockFull }) {
  const { all, loading, error } = useMockSnapshots(data);
  const [school, setSchool] = useState<SlipSchool>({ name: data.mock.schoolName });
  const [cls, setCls] = useState("");
  const [includeIncomplete, setIncludeIncomplete] = useState(false);
  const [includePosition, setIncludePosition] = useState(false);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    CloudSchoolService.getProfile()
      .then((s) => {
        if (!s) return;
        setSchool({
          name: s.name || data.mock.schoolName,
          address: s.physical_address || s.postal_address || null,
          headTeacher: s.head_teacher_name || null,
          logoDataUrl: s.logo_data_url || null,
        });
      })
      .catch(() => undefined);
  }, [data.mock.schoolName]);

  // A slip only uses mocks up to the one being printed, so an old mock never mentions later ones.
  const history = useMemo(() => {
    const here = data.mock.startDate ?? data.mock.createdAt ?? "";
    return all.filter((s) => s.date <= here || s.mockId === data.mock.id);
  }, [all, data.mock.startDate, data.mock.createdAt, data.mock.id]);

  const generatedOn = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const classes = [...new Set(data.candidates.map((c) => c.className))].sort();
  const learners = data.candidates.filter((c) => c.status === "registered" && (!cls || c.className === cls));

  const slips = useMemo(() => {
    const out: Array<{ id: string; slip: SlipData }> = [];
    for (const c of learners) {
      const s = buildSlip(data, c.id, history, school, { includePosition, generatedOn });
      if (s) out.push({ id: c.id, slip: s });
    }
    return out;
  }, [learners, data, history, school, includePosition, generatedOn]);

  const ready = slips.filter((x) => includeIncomplete || x.slip.status === "complete");
  const fileBase = `${safe(data.mock.name)} - ${safe(school.name)}`;

  const run = async (label: string, work: () => Promise<number>, scope: string) => {
    setBusy(label);
    setErr("");
    setMsg("");
    try {
      const n = await work();
      await MockExamService.recordSlips(data.mock.id, n, scope, includePosition).catch(() => undefined);
      setMsg(`Done: ${n} slip${n === 1 ? "" : "s"} created.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create the slips.");
    } finally {
      setBusy("");
    }
  };

  const single = (id: string) =>
    run(
      "one",
      async () => {
        const x = slips.find((s) => s.id === id);
        if (!x) return 0;
        const doc = newDoc();
        drawSlip(doc as unknown as PdfDoc, x.slip);
        downloadBlob(doc.output("blob"), `${safe(x.slip.learner.candidateNo)} - ${safe(x.slip.learner.fullName)}.pdf`);
        return 1;
      },
      "single"
    );

  const allInOne = () =>
    run(
      "all",
      async () => {
        const doc = newDoc();
        drawSlips(doc as unknown as PdfDoc, ready.map((x) => x.slip));
        downloadBlob(doc.output("blob"), `${fileBase} - result slips.pdf`);
        return ready.length;
      },
      cls ? `class ${cls}` : "all learners"
    );

  const asZip = () =>
    run(
      "zip",
      async () => {
        const zip = new JSZip();
        for (const x of ready) {
          const doc = newDoc();
          drawSlip(doc as unknown as PdfDoc, x.slip);
          zip.file(`${safe(x.slip.learner.candidateNo)} - ${safe(x.slip.learner.fullName)}.pdf`, doc.output("arraybuffer"));
        }
        downloadBlob(await zip.generateAsync({ type: "blob" }), `${fileBase} - slips.zip`);
        return ready.length;
      },
      (cls ? `class ${cls}` : "all learners") + " (zip)"
    );

  if (loading) return <div className="text-muted">Preparing slips…</div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div>
      {data.mock.status !== "finalised" && <div className="alert alert-warning small">This mock is not finalised yet. Slips printed now may change when more marks are entered. Each slip has a code so you can tell versions apart.</div>}
      {err && <div className="alert alert-danger">{err}</div>}
      {msg && <div className="alert alert-success py-2">{msg}</div>}

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-md-3">
              <label className="form-label small mb-0">Class</label>
              <select className="form-select form-select-sm" value={cls} onChange={(e) => setCls(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <div className="form-check">
                <input id="si" type="checkbox" className="form-check-input" checked={includeIncomplete} onChange={(e) => setIncludeIncomplete(e.target.checked)} />
                <label htmlFor="si" className="form-check-label small">
                  Include learners with incomplete results
                </label>
              </div>
              <div className="form-check">
                <input id="sp" type="checkbox" className="form-check-input" checked={includePosition} onChange={(e) => setIncludePosition(e.target.checked)} />
                <label htmlFor="sp" className="form-check-label small">
                  Show class and school position
                </label>
              </div>
            </div>
            <div className="col-md-6 d-flex gap-2 flex-wrap">
              <button className="btn btn-primary btn-sm" disabled={!!busy || ready.length === 0} onClick={allInOne}>
                {busy === "all" ? "Creating…" : `One PDF for ${ready.length} learner${ready.length === 1 ? "" : "s"}`}
              </button>
              <button className="btn btn-outline-primary btn-sm" disabled={!!busy || ready.length === 0} onClick={asZip}>
                {busy === "zip" ? "Creating…" : "ZIP of separate PDFs"}
              </button>
            </div>
          </div>
          <div className="small text-muted mt-2">
            Each slip shows the learner's own marks, grades, Mock Aggregate, progress and the grading key, marked as a school mock (not an official WAEC result). Missing marks appear as “–” and absences as “ABS”, never as zero. Slips contain one child's results: hand them to that child's parent or guardian only. No public links are created.
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead className="table-light">
            <tr>
              <th>Learner</th>
              <th>Class</th>
              <th>Aggregate</th>
              <th>Status</th>
              <th>Slip code</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {slips.map(({ id, slip }) => (
              <tr key={id}>
                <td>{slip.learner.fullName}</td>
                <td>{slip.learner.className}</td>
                <td>{slip.aggregate ?? "—"}</td>
                <td>
                  {slip.status === "complete" ? <ToneBadge tone="good">Ready</ToneBadge> : <ToneBadge tone="ok">{slip.status === "absent" ? "Absent" : "Incomplete"}</ToneBadge>}
                </td>
                <td className="small text-muted">{slip.code}</td>
                <td className="text-end">
                  <button className="btn btn-sm btn-outline-primary" disabled={!!busy} onClick={() => single(id)}>
                    Download slip
                  </button>
                </td>
              </tr>
            ))}
            {slips.length === 0 && (
              <tr>
                <td colSpan={6} className="text-muted">
                  No learners to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
