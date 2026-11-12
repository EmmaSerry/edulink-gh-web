import { useState } from "react";
import { Link } from "react-router-dom";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { ClassroomShowcase } from "@components/ClassroomShowcase";
import { GUIDES, GUIDE_ORDER, type GuideSlug } from "@/data/guideContent";
import { Reveal } from "@components/Reveal";
import { BrandMark } from "@components/BrandMark";
import { ShowcaseCarousel, type ShowcaseSlide } from "@components/ShowcaseCarousel";
import { useCountUp } from "@/hooks/useCountUp";
import "@styles/public-home.css";
import "@styles/how-it-works.css";
import "@styles/public-guide.css";

const FEATURES = [
  {
    icon: "bi-cloud-check",
    title: "One cloud dashboard",
    body: "Registration, daily attendance, assessment, remarks and report cards for every class, live and in real time - no per-school install.",
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
    body: "Multi-tenant from day one, with district-level oversight and attendance and results statistics designed in from the start.",
  },
];

const STEPS = [
  {
    title: "Set up your school",
    body: "A school or a whole district registers online in minutes. Once approved, the school gets its own school code and a ready-made curriculum.",
    points: ["Create classes and add staff", "Register learners with a photo", "Choose your school colours for report cards"],
  },
  {
    title: "Teachers take the register and enter marks",
    body: "On a laptop or on a phone, even with no internet. Everything saves on the device and sends itself when you are back online.",
    points: ["Daily class register in about a minute", "Marks entered out of 50 + 50, or KG skill ratings", "Remarks picked from suggested comments"],
  },
  {
    title: "The system does the sums",
    body: "Totals, grades, subject positions, class positions and attendance rates are worked out automatically, with no hand calculation and no copying errors.",
    points: ["Boys and girls figures kept separately", "Mock exam aggregates calculated for you", "Nothing is lost when a mark is corrected"],
  },
  {
    title: "Reports and results reach parents",
    body: "Report cards print or download as PDF with the school's own colours and the learner's photo. Parents can also get short results by SMS.",
    points: ["First report in each class free to view", "Mock result slips for JHS 3", "SMS to one parent or a whole class"],
  },
  {
    title: "Leaders see the whole picture",
    body: "Head teachers and district officers see attendance, performance and trends for a class, a school or a district, and who needs help first.",
    points: ["Daily, weekly, monthly and termly attendance", "Learners under 80% attendance flagged", "Download any table to Excel"],
  },
];

const ROLES = [
  { icon: "bi-person-workspace", title: "Class teachers", body: "Register, marks, remarks and reports for their own class." },
  { icon: "bi-building", title: "School administrators", body: "Set up the school, staff and classes; oversee every class and report." },
  { icon: "bi-diagram-3-fill", title: "District officers", body: "Compare schools, approve new schools and track attendance and results." },
  { icon: "bi-cash-coin", title: "Bursars", body: "Fees, report fee, SMS credits and the school subscription." },
];

const SLIDES: ShowcaseSlide[] = [
  { image: "/showcase/dashboard.jpg", title: "A clear school dashboard", caption: "Learners, classes, marks entry progress and quick links at a glance." },
  { image: "/showcase/attendance.jpg", title: "The daily register in a minute", caption: "Everyone starts present. Mark only the exceptions, then save." },
  { image: "/showcase/phones.jpg", title: "The Capture app works offline", caption: "Teachers work on a phone with no signal. Data sends itself when online." },
  { image: "/showcase/assessment.jpg", title: "Marks with automatic grades", caption: "Type the marks. Totals and grades appear by themselves." },
  { image: "/showcase/reportcard.jpg", title: "Report cards ready to print", caption: "School colours, learner photo, grades, position and remarks.", portrait: true },
  { image: "/showcase/attreports.jpg", title: "Attendance reports for decisions", caption: "Daily to termly, boys and girls, with plain-language findings." },
  { image: "/showcase/mock.jpg", title: "Mock exam analysis", caption: "Compare mocks, spot who is improving and which subjects need help." },
  { image: "/showcase/slip.jpg", title: "Mock result slips", caption: "Photo, grades, aggregate and progress for each candidate.", portrait: true },
];

const STATS = [
  { value: 11, label: "grade levels supported" },
  { value: 3, label: "terms tracked per year" },
  { value: 0, label: "installs required to sign in" },
];

const INTRO_POINTS = [
  { icon: "bi-people-fill", text: "Learner records: registration, photos and class lists for every school." },
  { icon: "bi-clipboard-data", text: "Assessment and terminal reports: marks, grades, positions and printable report cards." },
  { icon: "bi-calendar-check", text: "Everyday administration: daily attendance, fees, SMS to parents and district-level oversight." },
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

function GuidesSection() {
  const [tab, setTab] = useState<GuideSlug>("school");
  const g = GUIDES[tab];
  return (
    <section id="guides" className="gh-section">
      <div className="container">
        <h2 className="h3 text-center mb-1">Step-by-step guides</h2>
        <p className="text-muted text-center mb-4">Pick your role to see exactly how to do each task.</p>
        <div className="gt-tabs" role="tablist" aria-label="Guides by role">
          {GUIDE_ORDER.map((slug) => (
            <button
              key={slug}
              role="tab"
              aria-selected={tab === slug}
              type="button"
              className={`gt-tab border-0 bg-transparent ${tab === slug ? "is-active" : ""}`}
              onClick={() => setTab(slug)}
            >
              <i className={`bi ${GUIDES[slug].icon}`} /> {GUIDES[slug].label}
            </button>
          ))}
        </div>
        <div className="gh-panel" role="tabpanel">
          <h3 className="h5 mb-1">{g.title}</h3>
          <p className="text-muted mb-0">{g.tagline}</p>
          <ol className="gh-list">
            {g.sections.slice(0, -1).map((s) => (
              <li key={s.id}>
                <Link to={`/guide/${g.slug}#${s.id}`}>{s.title}</Link>
              </li>
            ))}
          </ol>
          <Link to={`/guide/${g.slug}`} className="btn btn-primary">
            Open the full {g.label} guide
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PublicHome() {
  const { session } = useCloudAuth();

  return (
    <div className="ph-page">
      <header className="ph-nav">
        <div className="container d-flex align-items-center justify-content-between py-2">
          <div className="d-flex align-items-center gap-2">
            <BrandMark size={32} />
            <span className="fw-bold">EduLink GH</span>
          </div>
          <a href="#guides" className="btn btn-link btn-sm ms-auto me-2 text-decoration-none">
            Guides
          </a>
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
          <div className="row align-items-center g-4 g-lg-5">
            <div className="col-lg-6">
              <span className="cl-eyebrow">
                <i className="bi bi-mortarboard-fill" /> Integrated school management for Ghana
              </span>
              <h1 className="display-5 fw-bold mb-3">
                School management built for real classrooms across Ghana
              </h1>
              <p className="lead text-muted mb-3">
                One cloud dashboard for registration, attendance, assessment and NaCCA-aligned report cards - plus an
                offline-first companion app for schools with no reliable connection.
              </p>
              <ul className="cl-points d-none d-sm-grid">
                {INTRO_POINTS.map((p) => (
                  <li key={p.icon}>
                    <span className="cl-pt-icon">
                      <i className={`bi ${p.icon}`} />
                    </span>
                    <span>{p.text}</span>
                  </li>
                ))}
              </ul>
              <div className="d-flex flex-wrap gap-2">
                {session ? (
                  <Link to="/dashboard" className="btn btn-primary btn-lg">
                    Go to dashboard
                  </Link>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-primary btn-lg">
                      Sign in
                    </Link>
                    <Link to="/signup" className="btn btn-outline-primary btn-lg">
                      Register your school
                    </Link>
                  </>
                )}
                <a href="#how" className="btn btn-outline-secondary btn-lg">
                  See how it works
                </a>
              </div>
            </div>
            <div className="col-lg-6">
              <ClassroomShowcase />
            </div>
          </div>
        </div>
      </section>

      <GuidesSection />

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

      <section id="how" className="hw-section">
        <div className="container">
          <Reveal>
            <h2 className="h3 text-center fw-bold mb-2">How it works</h2>
            <p className="hw-lead text-muted">
              From the first sign-up to the last report card, in five simple steps. Teachers do the everyday work;
              the system does the calculating; leaders see the results.
            </p>
          </Reveal>
          <div className="hw-steps">
            {STEPS.map((s, i) => (
              <Reveal delayMs={i * 80} key={s.title}>
                <div className="actrs-card hw-step h-100">
                  <div className="hw-step-num">{i + 1}</div>
                  <h3>{s.title}</h3>
                  <p className="text-muted">{s.body}</p>
                  <ul>
                    {s.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <h3 className="h5 text-center fw-bold mt-5 mb-3">Who uses it</h3>
          </Reveal>
          <div className="hw-roles">
            {ROLES.map((r) => (
              <div className="actrs-card hw-role" key={r.title}>
                <i className={`bi ${r.icon}`} />
                <h4>{r.title}</h4>
                <p className="text-muted">{r.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="screens" className="py-5">
        <div className="container">
          <Reveal>
            <h2 className="h3 text-center fw-bold mb-2">See it in action</h2>
            <p className="hw-lead text-muted">Screens and report samples from the system. Use the arrows or wait for the next one.</p>
          </Reveal>
          <ShowcaseCarousel slides={SLIDES} />
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
          <span className="text-muted small">Developed by Emmanuel Serry</span>
        </div>
      </footer>
    </div>
  );
}
