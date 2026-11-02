import { useLocation } from "react-router-dom";

/** Pages that get the big "Edit Photo" / "AI Photo Studio" buttons. */
const PAGES = ["/dashboard", "/district", "/accounts", "/students"];

/**
 * Two large buttons at the top of the main pages. Both open stand-alone
 * tools (static pages under /tools), so they are plain links, not router links.
 */
export function EditPhotoBanner() {
  const { pathname } = useLocation();
  if (!PAGES.includes(pathname)) return null;
  return (
    <div className="d-flex flex-wrap gap-2 mb-3">
      <a className="btn btn-primary btn-lg fw-bold px-4" href="/tools/photo-editor.html" target="_blank" rel="noopener">
        <i className="bi bi-camera-fill me-2" />
        Edit Photo
      </a>
      <a
        className="btn btn-lg fw-bold px-4 text-white"
        style={{ background: "linear-gradient(90deg,#7c3aed,#db2777)" }}
        href="/tools/ai-photo.html"
        target="_blank"
        rel="noopener"
      >
        {"✨"} AI Photo Studio
      </a>
    </div>
  );
}
