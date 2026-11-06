import { useEffect, useState } from "react";
import { CensusService, type CensusLinkInfo, type CensusSubmission } from "@services/cloud/CensusService";
import { fmt, titleCase } from "@components/census/censusModel";

/**
 * Admin side of the school census link: copy/share the private link, then
 * approve or reject what schools have sent in.
 */
function totals(d: CensusSubmission["data"]) {
  const n = d.n ?? {};
  const s = (keys: string[]) => keys.reduce((a, k) => a + (Number(n[k]) || 0), 0);
  const cls = (pre: string[], sex: string) => pre.map((c) => `${c}_${sex}`);
  const kg = ["kg1", "kg2"], pri = ["p1", "p2", "p3", "p4", "p5", "p6"], jhs = ["j1", "j2", "j3"];
  const boys = s([...cls(kg, "b"), ...cls(pri, "b"), ...cls(jhs, "b")]);
  const girls = s([...cls(kg, "g"), ...cls(pri, "g"), ...cls(jhs, "g")]);
  const teachers = s(["t_kg_m", "t_kg_f", "t_pri_m", "t_pri_f", "t_jhs_m", "t_jhs_f"]);
  return { boys, girls, all: boys + girls, teachers, kg: s([...cls(kg, "b"), ...cls(kg, "g")]), pri: s([...cls(pri, "b"), ...cls(pri, "g")]), jhs: s([...cls(jhs, "b"), ...cls(jhs, "g")]) };
}

export function CensusSubmissions({ onChanged, onPending }: { onChanged: () => void; onPending: (n: number) => void }) {
  const [link, setLink] = useState<CensusLinkInfo | null>(null);
  const [list, setList] = useState<CensusSubmission[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDone, setShowDone] = useState(false);

  async function load() {
    try {
      const [l, s] = await Promise.all([CensusService.link("get"), CensusService.submissions()]);
      setLink(l);
      setList(s);
      onPending(s.filter((x) => x.status === "pending").length);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not load.");
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const url = link ? `${window.location.origin}/census-submit/${link.token}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  async function linkAction(a: "on" | "off" | "renew") {
    if (a === "renew" && !window.confirm("Make a NEW link? The old link will stop working straight away.")) return;
    setBusy(a);
    try {
      setLink(await CensusService.link(a));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  async function review(s: CensusSubmission, action: "approve" | "reject") {
    let note: string | undefined;
    if (action === "reject") {
      const r = window.prompt(`Reject ${s.name}? You may type a reason (optional):`, "");
      if (r === null) return;
      note = r;
    } else if (!window.confirm(`Add ${s.name} to the district census?`)) return;
    setBusy(s.id);
    try {
      await CensusService.review(s.id, action, note);
      await load();
      if (action === "approve") onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed.");
    } finally {
      setBusy(null);
    }
  }

  const pending = (list ?? []).filter((x) => x.status === "pending");
  const reviewed = (list ?? []).filter((x) => x.status !== "pending");
  const wa = `https://wa.me/?text=${encodeURIComponent("Wassa Amenfi Central District: schools not yet on the district census, please fill in your data here: " + url)}`;

  const card = (s: CensusSubmission, isPending: boolean) => {
    const d = s.data;
    const t = totals(d);
    const get = (k: string) => (d[k] as string | undefined) || "-";
    return (
      <details key={s.id} className="actrs-card cx-glass p-3 mb-2">
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          {s.name} <span className="text-muted">| {titleCase(get("circuit"))} | {titleCase(get("school_type"))} | {fmt(t.all)} pupils | {new Date(s.submitted_at).toLocaleDateString()}</span>
          {!isPending && <span className={`badge ms-2 ${s.status === "approved" ? "bg-success" : "bg-secondary"}`}>{s.status}</span>}
        </summary>
        <div className="row g-2 mt-2 small">
          <div className="col-md-6">
            <div><b>Community:</b> {get("community")}</div>
            <div><b>EMIS code:</b> {get("emis_code")} &nbsp; <b>GPS:</b> {get("gps")}</div>
            <div><b>Level:</b> {get("school_level").replace("]", ")")}</div>
            <div><b>Feeding programme:</b> {titleCase(get("feeding"))}</div>
            <div><b>Head:</b> {get("head_name")} ({titleCase(get("head_sex"))})</div>
            <div><b>Phone:</b> {get("head_phone")} &nbsp; <b>Email:</b> {get("head_email")}</div>
          </div>
          <div className="col-md-6">
            <div><b>KG:</b> {fmt(t.kg)} &nbsp; <b>Primary:</b> {fmt(t.pri)} &nbsp; <b>JHS:</b> {fmt(t.jhs)}</div>
            <div><b>Boys:</b> {fmt(t.boys)} &nbsp; <b>Girls:</b> {fmt(t.girls)}</div>
            <div><b>Teachers:</b> {fmt(t.teachers)}</div>
            {s.review_note && <div><b>Note:</b> {s.review_note}</div>}
          </div>
        </div>
        {isPending && (
          <div className="d-flex gap-2 mt-3">
            <button type="button" className="btn btn-success btn-sm" disabled={busy === s.id} onClick={() => review(s, "approve")}>
              <i className="bi bi-check-circle me-1" />Approve and add to census
            </button>
            <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy === s.id} onClick={() => review(s, "reject")}>Reject</button>
          </div>
        )}
      </details>
    );
  };

  return (
    <>
      {err && <div className="alert alert-danger">{err}</div>}
      <div className="actrs-card cx-glass p-3 mb-3">
        <div className="cx-title mb-2">Link for schools not yet on the census</div>
        <div className="small mb-2">
          Send this link to the schools. They fill in their own data (no sign-in needed). Nothing goes into the census until you approve it below.
        </div>
        {link ? (
          <>
            <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
              <input className="form-control form-control-sm" style={{ maxWidth: 560 }} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className="btn btn-primary btn-sm" onClick={copy}>{copied ? "Copied" : "Copy link"}</button>
              <a className="btn btn-outline-primary btn-sm" href={wa} target="_blank" rel="noreferrer">Share on WhatsApp</a>
              <a className="btn btn-outline-primary btn-sm" href={url} target="_blank" rel="noreferrer">Preview form</a>
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-center small">
              <span>Link is <b>{link.active ? "ON (schools can submit)" : "OFF (schools cannot submit)"}</b></span>
              <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy !== null} onClick={() => linkAction(link.active ? "off" : "on")}>
                {link.active ? "Turn off" : "Turn on"}
              </button>
              <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy !== null} onClick={() => linkAction("renew")}>Make a new link</button>
            </div>
          </>
        ) : (
          <div className="text-muted">Preparing the link…</div>
        )}
      </div>

      <div className="cx-title mb-2">Waiting for your approval ({pending.length})</div>
      {list === null ? <div className="text-muted">Loading…</div> : pending.length === 0 ? <div className="text-muted mb-3">Nothing is waiting.</div> : pending.map((s) => card(s, true))}

      {reviewed.length > 0 && (
        <div className="mt-3">
          <button type="button" className="btn btn-outline-primary btn-sm mb-2" onClick={() => setShowDone((v) => !v)}>
            {showDone ? "Hide" : "Show"} reviewed submissions ({reviewed.length})
          </button>
          {showDone && reviewed.map((s) => card(s, false))}
        </div>
      )}
    </>
  );
}
