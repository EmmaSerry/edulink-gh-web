import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LearnerService, type LearnerFilterOptions, type LearnerRow } from "@services/cloud/LearnerService";
import { CloudStudentService } from "@services/cloud/StudentService";
import {
  cameraNumber,
  duplicatePhotoIndexes,
  isPhotoName,
  pairInOrder,
  sortPhotos,
  sortRoster,
  type RosterOrder,
} from "@/lib/photoPairing";

/** Anything bigger than this was not run through the Photo Editor (its output is about 10-30 KB). */
const MAX_PHOTO_BYTES = 500 * 1024;

interface LoadedPhoto {
  name: string;
  number: number | null;
  dataUrl: string;
  bytes: number;
  tooBig: boolean;
}

function naturalSort(a: string, b: string) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function fullNameOf(s: LearnerRow): string {
  return [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" ");
}

function mimeFor(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read a photo."));
    r.readAsDataURL(blob);
  });
}

/**
 * Import photos: the school runs its camera photos through the Batch Photo Editor
 * (/tools/photo-editor.html), then drops the finished photos (or the ZIP it makes) here.
 * Photos are lined up with the class register by camera number and the person checks
 * and fixes any pairing before saving. Nothing is saved until "Save" is pressed.
 */
export function CloudPhotoImport() {
  const fileRef = useRef<HTMLInputElement>(null);

  const [options, setOptions] = useState<LearnerFilterOptions>({ schools: [], classNames: [] });
  const [schoolId, setSchoolId] = useState("");
  const [className, setClassName] = useState("");
  const [order, setOrder] = useState<RosterOrder>("surname");
  const [keepExisting, setKeepExisting] = useState(true);

  const [learners, setLearners] = useState<LearnerRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [photos, setPhotos] = useState<LoadedPhoto[]>([]);
  const [reading, setReading] = useState(false);
  const [readMessage, setReadMessage] = useState<string | null>(null);

  const [assignments, setAssignments] = useState<Record<string, number | null>>({});
  /** Learners marked "absent on photo day": left out when photos are paired in order. */
  const [absent, setAbsent] = useState<Set<string>>(new Set());

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [result, setResult] = useState<{ saved: number; failed: string[] } | null>(null);

  useEffect(() => {
    LearnerService.filterOptions()
      .then((o) => {
        setOptions(o);
        if (o.schools.length === 1) setSchoolId(o.schools[0].id);
      })
      .catch(() => {});
  }, []);

  const needSchool = options.schools.length > 1;
  const ready = !!className && (!needSchool || !!schoolId);

  // Load the class register whenever the class (or school) changes.
  useEffect(() => {
    if (!ready) {
      setLearners(null);
      return;
    }
    let cancelled = false;
    setLearners(null);
    setLoadError(null);
    LearnerService.list({ schoolId: schoolId || undefined, className, status: "ACTIVE" }, 500, 0)
      .then((rows) => !cancelled && setLearners(rows))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load the class."));
    return () => {
      cancelled = true;
    };
  }, [ready, schoolId, className]);

  const roster = useMemo(() => (learners ? sortRoster(learners, order) : []), [learners, order]);

  /** Re-pair photos to learners in register order. */
  function autoPair(
    nextRoster: LearnerRow[] = roster,
    nextPhotos: LoadedPhoto[] = photos,
    nextKeep: boolean = keepExisting,
    nextAbsent: Set<string> = absent
  ) {
    const usable: number[] = [];
    nextPhotos.forEach((p, i) => {
      if (!p.tooBig) usable.push(i);
    });
    const skip = new Set<string>(nextAbsent);
    if (nextKeep) nextRoster.forEach((l) => l.photo_url && skip.add(l.id));
    const byOrder = pairInOrder(
      nextRoster.map((l) => l.id),
      usable.length,
      skip
    );
    const out: Record<string, number | null> = {};
    for (const [id, k] of Object.entries(byOrder)) out[id] = k === null ? null : usable[k];
    setAssignments(out);
    setResult(null);
  }

  // Pair automatically when a class finishes loading.
  useEffect(() => {
    if (learners) autoPair(sortRoster(learners, order), photos, keepExisting);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learners]);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setReading(true);
    setReadMessage(null);
    try {
      const found: LoadedPhoto[] = [];
      let skipped = 0;
      for (const f of files) {
        if (f.name.toLowerCase().endsWith(".zip")) {
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(f);
          for (const entry of Object.values(zip.files)) {
            if (entry.dir) continue;
            if (!isPhotoName(entry.name)) {
              skipped += 1;
              continue;
            }
            const base = entry.name.split("/").pop() ?? entry.name;
            const blob = await entry.async("blob");
            const typed = new Blob([blob], { type: mimeFor(base) });
            found.push({
              name: base,
              number: cameraNumber(base),
              dataUrl: await blobToDataUrl(typed),
              bytes: typed.size,
              tooBig: typed.size > MAX_PHOTO_BYTES,
            });
          }
        } else if (isPhotoName(f.name) || f.type.startsWith("image/")) {
          found.push({
            name: f.name,
            number: cameraNumber(f.name),
            dataUrl: await blobToDataUrl(f),
            bytes: f.size,
            tooBig: f.size > MAX_PHOTO_BYTES,
          });
        } else {
          skipped += 1;
        }
      }
      // Merge with photos already added; the same file name replaces the older copy.
      const merged = new Map<string, LoadedPhoto>();
      for (const p of photos) merged.set(p.name, p);
      for (const p of found) merged.set(p.name, p);
      const sorted = sortPhotos(Array.from(merged.values()));
      setPhotos(sorted);
      setReadMessage(
        `${found.length} photo${found.length === 1 ? "" : "s"} added.` +
          (skipped ? ` ${skipped} other file${skipped === 1 ? "" : "s"} ignored.` : "")
      );
      if (learners) autoPair(roster, sorted, keepExisting);
    } catch (err) {
      setReadMessage(err instanceof Error ? err.message : "Could not read those files.");
    } finally {
      setReading(false);
    }
  }

  function toggleAbsent(learnerId: string) {
    const next = new Set(absent);
    if (next.has(learnerId)) next.delete(learnerId);
    else next.add(learnerId);
    setAbsent(next);
    autoPair(roster, photos, keepExisting, next);
  }

  function clearPhotos() {
    setPhotos([]);
    setAssignments({});
    setReadMessage(null);
    setResult(null);
  }

  function setAssignment(learnerId: string, value: string) {
    setAssignments((a) => ({ ...a, [learnerId]: value === "" ? null : Number(value) }));
    setResult(null);
  }

  const duplicates = duplicatePhotoIndexes(assignments);
  const pairedRows = roster.filter((l) => assignments[l.id] !== null && assignments[l.id] !== undefined);
  const overwriting = pairedRows.filter((l) => !!l.photo_url);
  const usablePhotos = photos.filter((p) => !p.tooBig).length;
  const tooBigPhotos = photos.filter((p) => p.tooBig);
  const unusedPhotos = photos.filter((p, i) => !p.tooBig && !Object.values(assignments).includes(i)).length;
  const learnersWithoutNew = roster.filter(
    (l) => (assignments[l.id] === null || assignments[l.id] === undefined) && !l.photo_url
  ).length;

  async function handleSave() {
    if (pairedRows.length === 0 || duplicates.size > 0) return;
    if (
      overwriting.length > 0 &&
      !window.confirm(
        `${overwriting.length} learner${overwriting.length === 1 ? " already has" : "s already have"} a photo. ` +
          "Saving will replace it. Continue?"
      )
    ) {
      return;
    }
    setSaving(true);
    setSaveProgress(0);
    setResult(null);
    let saved = 0;
    const failed: string[] = [];
    for (let i = 0; i < pairedRows.length; i++) {
      const l = pairedRows[i];
      const photo = photos[assignments[l.id] as number];
      try {
        await CloudStudentService.updateStudent(l.id, { photo_url: photo.dataUrl });
        saved += 1;
      } catch {
        failed.push(fullNameOf(l));
      }
      setSaveProgress(i + 1);
    }
    setSaving(false);
    setResult({ saved, failed });
    // Refresh the register so "Current photo" shows the new pictures.
    try {
      const rows = await LearnerService.list({ schoolId: schoolId || undefined, className, status: "ACTIVE" }, 500, 0);
      setLearners(rows);
    } catch {
      /* the saved count above is still right */
    }
  }

  return (
    <div>
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-wrap">
        <div>
          <h1 className="h4 mb-0">Import photos</h1>
          <div className="text-muted small">Attach finished photos to a class in one go.</div>
        </div>
        <div className="d-flex gap-2">
          <a href="/tools/photo-editor.html" target="_blank" rel="noopener" className="btn btn-outline-primary text-nowrap">
            <i className="bi bi-images me-1" />
            Open Photo Editor
          </a>
          <Link to="/students" className="btn btn-outline-secondary text-nowrap">
            Back to learners
          </Link>
        </div>
      </div>

      <div className="actrs-card p-3 mb-3">
        <ol className="mb-0 small ps-3">
          <li>
            Click <strong>Open Photo Editor</strong>, drop in the camera photos and download the ZIP it makes.
          </li>
          <li>Choose the class below.</li>
          <li>
            Click <strong>Choose photos</strong> and pick the ZIP (or the photos themselves).
          </li>
          <li>Check that each photo sits next to the right learner, fix any that are wrong, then press Save.</li>
        </ol>
      </div>

      <div className="actrs-card p-3 mb-3">
        <div className="row g-2 align-items-end">
          {needSchool && (
            <div className="col-md-4">
              <label className="form-label small mb-1">School</label>
              <select
                className="form-select"
                value={schoolId}
                onChange={(e) => {
                  setSchoolId(e.target.value);
                  setAssignments({});
                }}
              >
                <option value="">Choose a school…</option>
                {options.schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Class</label>
            <select
              className="form-select"
              value={className}
              onChange={(e) => {
                setClassName(e.target.value);
                setAssignments({});
              }}
            >
              <option value="">Choose a class…</option>
              {[...options.classNames].sort(naturalSort).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="col-6 col-md-3">
            <label className="form-label small mb-1">Photos were taken in this order</label>
            <select
              className="form-select"
              value={order}
              onChange={(e) => {
                const o = e.target.value as RosterOrder;
                setOrder(o);
                if (learners) autoPair(sortRoster(learners, o), photos, keepExisting);
              }}
            >
              <option value="surname">Surname A to Z</option>
              <option value="firstname">First name A to Z</option>
              <option value="studentid">Student ID</option>
            </select>
          </div>
          <div className="col-12 col-md-auto">
            <div className="form-check mb-2">
              <input
                id="keep-existing"
                type="checkbox"
                className="form-check-input"
                checked={keepExisting}
                onChange={(e) => {
                  setKeepExisting(e.target.checked);
                  if (learners) autoPair(roster, photos, e.target.checked);
                }}
              />
              <label htmlFor="keep-existing" className="form-check-label small">
                Skip learners who already have a photo
              </label>
            </div>
          </div>
        </div>

        <hr />

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            className="d-none"
            multiple
            accept="image/*,.zip,application/zip"
            onChange={handleFiles}
          />
          <button type="button" className="btn btn-primary" disabled={reading} onClick={() => fileRef.current?.click()}>
            <i className="bi bi-upload me-1" />
            {reading ? "Reading…" : "Choose photos"}
          </button>
          {photos.length > 0 && (
            <button type="button" className="btn btn-outline-secondary" onClick={clearPhotos}>
              Clear photos
            </button>
          )}
          {photos.length > 0 && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!learners}
              onClick={() => autoPair()}
              title="Start again: put the photos next to the learners in register order"
            >
              <i className="bi bi-arrow-repeat me-1" />
              Pair in order again
            </button>
          )}
          <span className="text-muted small">
            {readMessage ?? "A ZIP from the Photo Editor, or finished photos named with the camera number (IMG_0345.jpg)."}
          </span>
        </div>
      </div>

      {tooBigPhotos.length > 0 && (
        <div className="alert alert-warning">
          <strong>{tooBigPhotos.length} photo{tooBigPhotos.length === 1 ? " is" : "s are"} too large</strong> and will not
          be used ({tooBigPhotos.slice(0, 5).map((p) => p.name).join(", ")}
          {tooBigPhotos.length > 5 ? ", …" : ""}). Run them through the Photo Editor first; it makes them small enough.
        </div>
      )}

      {loadError && <div className="alert alert-danger">{loadError}</div>}

      {!ready && <div className="text-muted">Choose {needSchool ? "a school and " : ""}a class to see its register.</div>}
      {ready && learners === null && !loadError && <div className="text-muted">Loading the class…</div>}

      {learners && (
        <>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
            <div className="small text-muted">
              {roster.length} learner{roster.length === 1 ? "" : "s"} &middot; {usablePhotos} photo
              {usablePhotos === 1 ? "" : "s"} loaded &middot; <strong>{pairedRows.length}</strong> paired
            </div>
            <button
              type="button"
              className="btn btn-success"
              disabled={saving || pairedRows.length === 0 || duplicates.size > 0}
              onClick={handleSave}
            >
              <i className="bi bi-check2-circle me-1" />
              {saving ? `Saving ${saveProgress} of ${pairedRows.length}…` : `Save ${pairedRows.length} photo${pairedRows.length === 1 ? "" : "s"}`}
            </button>
          </div>

          {photos.length > 0 && learnersWithoutNew > 0 && (
            <div className="alert alert-info py-2 small">
              {learnersWithoutNew} learner{learnersWithoutNew === 1 ? " has" : "s have"} no photo yet. If a learner was
              absent on photo day, press <strong>Absent</strong> on their row and the photos after it shift up into place.
            </div>
          )}
          {photos.length > 0 && unusedPhotos > 0 && (
            <div className="alert alert-info py-2 small">
              {unusedPhotos} photo{unusedPhotos === 1 ? " is" : "s are"} not matched to anyone yet.
            </div>
          )}
          {duplicates.size > 0 && (
            <div className="alert alert-danger py-2 small">
              The same photo is chosen for more than one learner (rows marked in red). Fix those rows before saving.
            </div>
          )}
          {result && (
            <div className={`alert ${result.failed.length ? "alert-warning" : "alert-success"} py-2`}>
              Saved {result.saved} photo{result.saved === 1 ? "" : "s"}.
              {result.failed.length > 0 && <> Could not save for: {result.failed.join(", ")}. Press Save again to retry.</>}
            </div>
          )}

          <div className="actrs-card p-0">
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>No.</th>
                    <th style={{ width: 70 }}>Now</th>
                    <th>Learner</th>
                    <th style={{ width: 70 }}>New</th>
                    <th style={{ minWidth: 200 }}>Photo</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted py-4">
                        No active learners in this class.
                      </td>
                    </tr>
                  )}
                  {roster.map((l, i) => {
                    const idx = assignments[l.id];
                    const chosen = idx !== null && idx !== undefined ? photos[idx] : null;
                    const isDup = idx !== null && idx !== undefined && duplicates.has(idx);
                    return (
                      <tr key={l.id} className={isDup ? "table-danger" : undefined}>
                        <td className="text-muted">{i + 1}</td>
                        <td>
                          {l.photo_url ? (
                            <img
                              src={l.photo_url}
                              alt=""
                              style={{ width: 40, height: 53, objectFit: "cover", borderRadius: 4 }}
                            />
                          ) : (
                            <span className="text-muted small">none</span>
                          )}
                        </td>
                        <td>
                          <div className="fw-medium">{fullNameOf(l)}</div>
                          <div className="text-muted small">{l.student_id}</div>
                        </td>
                        <td>
                          {chosen ? (
                            <img
                              src={chosen.dataUrl}
                              alt=""
                              style={{ width: 40, height: 53, objectFit: "cover", borderRadius: 4 }}
                            />
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              value={idx === null || idx === undefined ? "" : String(idx)}
                              onChange={(e) => setAssignment(l.id, e.target.value)}
                              disabled={photos.length === 0}
                            >
                              <option value="">No photo</option>
                              {photos.map((p, pi) =>
                                p.tooBig ? null : (
                                  <option key={p.name} value={pi}>
                                    {p.name}
                                  </option>
                                )
                              )}
                            </select>
                            <button
                              type="button"
                              className={`btn btn-sm text-nowrap ${absent.has(l.id) ? "btn-warning" : "btn-outline-secondary"}`}
                              disabled={photos.length === 0}
                              onClick={() => toggleAbsent(l.id)}
                              title="Absent on photo day: leave this learner out and shift the photos after it"
                            >
                              Absent
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
