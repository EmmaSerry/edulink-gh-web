import { Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { NetworkHeroGraphic } from "@components/NetworkHeroGraphic";
import { Reveal } from "@components/Reveal";
import { useCountUp } from "@/hooks/useCountUp";
import "@styles/public-home.css";

const FEATURES = [
  {
    icon: "bi-cloud-check",
    title: "One cloud dashboard",
    body: "Registration, assessment, remarks and report cards for every class, live and in real time - no per-school install.",
  },
  {
    icon: "bi-wifi-off",
    title: "Works with no signal",
    body: "The Capture companion app keeps working offline at schools with poor connectivity, syncing everything the moment a connection returns.",
  },
  {
    icon: "bi-mortarboard",
    title: "KG to JHS, NaCCA-aligned",
    body: "Skill-checklist ratings for Kindergarten and SBA/exam scoring for Basic 1 through JHS 3, each with its own correctly formatted report card.",
  },
  {
    icon: "bi-diagram-3",
    title: "Built for a nationwide rollout",
    body: "Multi-tenant from day one, with district-level oversight designed in from the start rather than bolted on later.",
  },
];

const STATS = [
  { value: 11, label: "grade levels supported" },
  { value: 3, label: "terms tracked per year" },
  { value: 0, label: "installs required to sign in" },
];

function StatCounter({ value, label }: { value: number; label: string }) {
  const { ref, value: shown } = useCountUp(value);
  return (
    <div className="text-center">
      <div className="ph-stat-number">
        <span ref={ref}>{shown}</span>
      </div>
      <div className="text-muted small">{label}</div>
    </div>
  );
}

export function PublicHome() {
  const { session } = useCloudAuth();

  return (
    <div className="ph-page">
      <header className="ph-nav">
        <div className="container d-flex align-items-center justify-content-between py-2">
          <div className="d-flex align-items-center gap-2">
            <span className="actrs-brand-mark">EG</span>
            <span className="fw-bold">EduLink GH</span>
          </div>
          {session ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              Go to dashboard
            </Link>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <section className="ph-hero">
        <div className="ph-hero-blobs">
          <div className="ph-hero-blob" />
          <div className="ph-hero-blob" />
          <div className="ph-hero-blob" />
        </div>
        <div className="container ph-hero-content">
          <div className="row align-items-center g-5">
            <div className="col-lg-6">
              <h1 className="display-5 fw-bold mb-3">
                School management built for real classrooms across Ghana
              </h1>
              <p className="lead text-muted mb-4">
                One cloud dashboard for registration, assessment and NaCCA-aligned report cards - plus an
                offline-first companion app for schools with no reliable connection.
              </p>
              <div className="d-flex flex-wrap gap-2">
                {session ? (
                  <Link to="/dashboard" className="btn btn-primary btn-lg">
                    Go to dashboard
                  </Link>
                ) : (
                  <Link to="/login" className="btn btn-primary btn-lg">
                    Sign in
                  </Link>
                )}
                <a href="#features" className="btn btn-outline-secondary btn-lg">
                  See how it works
                </a>
              </div>
            </div>
            <div className="col-lg-6 d-flex justify-content-center">
              <NetworkHeroGraphic />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-5">
        <div className="container">
          <Reveal>
            <h2 className="h3 text-center fw-bold mb-5">Everything a school (or a district) actually needs</h2>
          </Reveal>
          <div className="row g-4">
            {FEATURES.map((f, i) => (
              <div className="col-md-6 col-lg-3" key={f.title}>
                <Reveal delayMs={i * 100}>
                  <div className="actrs-card p-4 h-100">
                    <div className="ph-feature-icon mb-3">
                      <i className={`bi ${f.icon}`} />
                    </div>
                    <h3 className="h6 fw-bold mb-2">{f.title}</h3>
                    <p className="text-muted small mb-0">{f.body}</p>
                  </div>
                </Reveal>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-5">
        <div className="container">
          <Reveal>
            <div className="actrs-card p-4 p-md-5">
              <div className="row g-4">
                {STATS.map((s) => (
                  <div className="col-md-4" key={s.label}>
                    <StatCounter value={s.value} label={s.label} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="py-4 border-top">
        <div className="container d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span className="text-muted small">&copy; {new Date().getFullYear()} EduLink GH</span>
          <span className="text-muted small">Amenfi Central Terminal Report System, reimagined nationwide</span>
        </div>
      </footer>
    </div>
  );
}
