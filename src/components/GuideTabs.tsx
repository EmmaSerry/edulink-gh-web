import { Link } from "react-router-dom";
import { GUIDES, GUIDE_ORDER, type GuideSlug } from "@/data/guideContent";

/**
 * Small tab strip that links to the three public step-by-step guides.
 * Used above the sign-in form. `active` highlights the current tab;
 * "signin" means none of the guides is open.
 */
export function GuideTabs({ active }: { active: GuideSlug | "signin" }) {
  return (
    <nav className="gt-tabs" aria-label="Sign in and step-by-step guides">
      <Link to="/login" className={`gt-tab ${active === "signin" ? "is-active" : ""}`}>
        <i className="bi bi-box-arrow-in-right" /> Sign in
      </Link>
      {GUIDE_ORDER.map((slug) => (
        <Link
          key={slug}
          to={`/guide/${slug}`}
          className={`gt-tab ${active === slug ? "is-active" : ""}`}
          title={GUIDES[slug].tagline}
        >
          <i className={`bi ${GUIDES[slug].icon}`} /> {GUIDES[slug].label}
        </Link>
      ))}
    </nav>
  );
}
