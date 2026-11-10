import { useEffect, useRef, useState } from "react";
import "@styles/classroom-hero.css";

/**
 * Floating classroom photographs for the public welcome page.
 *
 * Three frames (one large, two small) show different photographs at the same
 * time. The large frame moves on every tick; the small frames move on
 * staggered ticks, so the photographs appear one after another and all 12
 * are shown in turn, forever. Changes are cross-fades (CSS only); the frames
 * have a fixed aspect ratio, so nothing on the page ever shifts.
 *
 * No library is used. The timer pauses while the tab is hidden or the mouse
 * is over the photographs, and "reduce motion" turns every animation off
 * (photographs then change slowly, without any movement).
 */

interface Photo {
  n: number; // file number: /classrooms/edulink-classroom-NN.webp
  landscape?: boolean;
  alt: string;
}

const PHOTOS: Photo[] = [
  { n: 1, alt: "Young learners in school uniform reading picture books together around a classroom table" },
  { n: 2, alt: "Girls in green dresses studying at wooden desks in a Ghanaian classroom, one standing with an open book" },
  { n: 3, alt: "A teacher and young learners seated around small tables with open workbooks in a bright classroom" },
  { n: 4, alt: "Two smiling girls in green dresses at their desks in a full classroom" },
  { n: 5, alt: "Children working in small groups at tables beneath a colourful classroom wall, a boy reading a maths book in the foreground" },
  { n: 6, alt: "Rows of learners in green uniforms seated at wooden desks, attentive and ready to learn" },
  { n: 7, alt: "Kindergarten learners seated around a table sharing books in a colourful classroom" },
  { n: 8, alt: "A learner stands to read from her book while classmates in green dresses work at their desks" },
  { n: 9, alt: "Learners working at tables in a bright yellow classroom with a colourful tiled wall" },
  { n: 10, alt: "A full classroom of girls in green dresses at wooden desks, with a learner looking up at the camera" },
  { n: 11, alt: "A girl holds up a pink workbook while her classmates look on" },
  { n: 12, landscape: true, alt: "Wide view of a colourful primary classroom with groups of young learners working at tables" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const url = (n: number, small: boolean) => `/classrooms/edulink-classroom-${pad(n)}${small ? "-sm" : ""}.webp`;

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/** One photograph. Landscape photographs are shown whole on a soft blurred copy of themselves, so no child is cropped out. */
function Picture({ photo, priority }: { photo: Photo; priority?: boolean }) {
  const lgW = photo.landscape ? 1008 : 756;
  const lgH = photo.landscape ? 756 : 1008;
  const smW = photo.landscape ? 640 : 480;
  const set = `${url(photo.n, true)} ${smW}w, ${url(photo.n, false)} ${lgW}w`;
  return (
    <>
      {photo.landscape && <img className="cl-bg" src={url(photo.n, true)} alt="" aria-hidden="true" width={smW} height={Math.round((smW * lgH) / lgW)} />}
      <img
        className={photo.landscape ? "cl-fg cl-contain" : "cl-fg"}
        src={url(photo.n, false)}
        srcSet={set}
        sizes="(max-width: 575px) 60vw, 330px"
        width={lgW}
        height={lgH}
        alt={photo.alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        {...(priority ? ({ fetchpriority: "high" } as Record<string, string>) : {})}
      />
    </>
  );
}

/** A frame that cross-fades whenever its photograph changes. */
function Frame({ photo, className, first }: { photo: Photo; className: string; first?: boolean }) {
  const [layers, setLayers] = useState<{ photo: Photo; key: number; fresh: boolean }[]>([{ photo, key: 0, fresh: false }]);
  const last = useRef(photo.n);

  useEffect(() => {
    if (photo.n === last.current) return;
    last.current = photo.n;
    setLayers((ls) => [ls[ls.length - 1], { photo, key: ls[ls.length - 1].key + 1, fresh: true }]);
    const t = window.setTimeout(() => setLayers((ls) => ls.slice(-1)), 1500);
    return () => window.clearTimeout(t);
  }, [photo]);

  return (
    <div className={`cl-frame ${className}`}>
      {layers.map((l, i) => (
        <div key={l.key} className={`cl-layer ${i === layers.length - 1 ? (l.fresh ? "cl-in" : "") : "cl-out"}`}>
          <Picture photo={l.photo} priority={first && l.key === 0} />
        </div>
      ))}
    </div>
  );
}

const TICK_MS = 4800;
const N = PHOTOS.length;

/** Pick `want`, or the next photograph along that is not already on show. */
function pick(want: number, taken: number[]): number {
  let i = ((want % N) + N) % N;
  while (taken.includes(i)) i = (i + 1) % N;
  return i;
}

export function ClassroomShowcase() {
  const reduced = usePrefersReducedMotion();
  const [tick, setTick] = useState(0);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    if (hover) return;
    const ms = reduced ? 8000 : TICK_MS;
    let id: number | undefined;
    const start = () => {
      if (id === undefined) id = window.setInterval(() => setTick((v) => v + 1), ms);
    };
    const stop = () => {
      if (id !== undefined) {
        window.clearInterval(id);
        id = undefined;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [reduced, hover]);

  // Warm the browser cache with every photograph once the page itself has finished loading,
  // so each cross-fade finds its next picture already downloaded.
  useEffect(() => {
    const warm = () => {
      PHOTOS.forEach((p) => {
        const a = new Image();
        a.src = url(p.n, false);
        const b = new Image();
        b.src = url(p.n, true);
      });
    };
    const go = () => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void) => void };
      if (w.requestIdleCallback) w.requestIdleCallback(warm);
      else window.setTimeout(warm, 1500);
    };
    if (document.readyState === "complete") go();
    else {
      window.addEventListener("load", go, { once: true });
      return () => window.removeEventListener("load", go);
    }
  }, []);

  const main = tick % N;
  const sat1 = pick(6 + 5 * Math.floor(tick / 3), [main]);
  const sat2 = pick(9 + 5 * Math.floor((tick + 1) / 3), [main, sat1]);

  return (
    <div
      className={`cl-stage${reduced ? " cl-reduced" : ""}`}
      role="group"
      aria-roledescription="carousel"
      aria-label="Photographs of learners in Ghanaian classrooms"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="cl-ring cl-ring-a" aria-hidden="true" />
      <div className="cl-ring cl-ring-b" aria-hidden="true" />
      <Frame photo={PHOTOS[main]} className="cl-main" first />
      <Frame photo={PHOTOS[sat1]} className="cl-sat1" />
      <Frame photo={PHOTOS[sat2]} className="cl-sat2" />
      <div className="cl-strip">
        <span>
          <i className="bi bi-clipboard-check" /> Attendance
        </span>
        <span>
          <i className="bi bi-pencil-square" /> Assessment
        </span>
        <span>
          <i className="bi bi-file-earmark-text" /> Report cards
        </span>
      </div>
    </div>
  );
}
