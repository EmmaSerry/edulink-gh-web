import { useEffect } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { BrandMark } from "@components/BrandMark";
import { GuideTabs } from "@components/GuideTabs";
import { GUIDES, GUIDE_ORDER, type GuideSlug } from "@/data/guideContent";
import "@styles/public-guide.css";

/**
 * Public, no-login step-by-step guides: /guide/district, /guide/school and
 * /guide/teacher. The content lives in src/data/guideContent.ts.
 */
export function PublicGuide() {
  const { role } = useParams<{ role: string }>();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash, role]);
  if (!role || !GUIDE_ORDER.includes(role as GuideSlug)) return <Navigate to="/guide/school" replace />;
  const guide = GUIDES[role as GuideSlug];

  return (
    <div className="pg-page">
      <header className="pg-top">
        <div className="container d-flex align-items-center justify-content-between py-2">
          <Link to="/" className="d-flex align-items-center gap-2 text-decoration-none text-reset">
            <BrandMark size={30} />
            <span className="fw-bold">EduLink GH</span>
          </Link>
          <Link to="/login" className="btn btn-primary btn-sm">
            Sign in
          </Link>
        </div>
      </header>

      <main className="container py-4">
        <GuideTabs active={guide.slug} />

        <div className="pg-hero">
          <h1 className="h3 mb-1">{guide.title}</h1>
          <p className="text-muted mb-0">{guide.tagline}</p>
        </div>

        <div className="row g-4">
          <aside className="col-lg-3 d-none d-lg-block">
            <nav className="pg-toc" aria-label="On this page">
              <div className="pg-toc-title">On this page</div>
              <ol>
                {guide.sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="col-lg-9">
            {guide.sections.map((s, i) => (
              <section key={s.id} id={s.id} className="pg-card">
                <h2 className="h5">
                  <span className="pg-num">{i + 1}</span>
                  {s.title}
                </h2>
                <p className="text-muted">{s.intro}</p>
                <ol className="pg-steps">
                  {s.steps.map((step, k) => (
                    <li key={k}>{step}</li>
                  ))}
                </ol>
                {s.tip && (
                  <div className="pg-tip">
                    <i className="bi bi-lightbulb" /> {s.tip}
                  </div>
                )}
              </section>
            ))}
            <p className="small text-muted">
              Screens and wording may be refined over time. If something does not match what you see, ask your
              administrator.
            </p>
          </div>
        </div>
      </main>

      <footer className="py-4 border-top text-center small text-muted">
        &copy; {new Date().getFullYear()} EduLink GH &middot; Developed by Emmanuel Serry
      </footer>
    </div>
  );
}
