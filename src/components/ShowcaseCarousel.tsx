import { useEffect, useState } from "react";

export interface ShowcaseSlide {
  image: string;
  title: string;
  caption: string;
  portrait?: boolean;
}

/** Auto-advancing showcase of system screens and report samples. Pauses on hover/touch. */
export function ShowcaseCarousel({ slides }: { slides: ShowcaseSlide[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), 5000);
    return () => window.clearInterval(t);
  }, [paused, slides.length]);

  const s = slides[i];
  const go = (n: number) => setI((n + slides.length) % slides.length);

  return (
    <div
      className="hw-showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="hw-showcase-stage">
        <button type="button" className="hw-nav hw-prev" onClick={() => go(i - 1)} aria-label="Previous screen">
          <i className="bi bi-chevron-left" />
        </button>
        <div className={`hw-frame ${s.portrait ? "is-portrait" : ""}`} key={s.image}>
          <img src={s.image} alt={s.title} />
        </div>
        <button type="button" className="hw-nav hw-next" onClick={() => go(i + 1)} aria-label="Next screen">
          <i className="bi bi-chevron-right" />
        </button>
      </div>
      <div className="hw-showcase-caption">
        <div className="hw-showcase-title">{s.title}</div>
        <div className="hw-showcase-text">{s.caption}</div>
        <div className="hw-showcase-note">Illustration with sample data</div>
      </div>
      <div className="hw-dots">
        {slides.map((x, k) => (
          <button key={x.image} type="button" className={k === i ? "on" : ""} onClick={() => setI(k)} aria-label={`Show ${x.title}`} />
        ))}
      </div>
    </div>
  );
}
