import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@hooks/useTheme";
import { useAppInfo } from "@hooks/useAppInfo";
import { GlobalSearchService, type SearchResultGroup } from "@services/GlobalSearchService";

/** Module 5 (Phase 5) - system-wide search, debounced and grouped by
 *  category, reachable from every page since it lives in the shared
 *  Topbar rather than a dedicated route. */
function GlobalSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchResultGroup[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      return;
    }
    const handle = setTimeout(() => {
      GlobalSearchService.search(trimmed).then((result) => {
        setGroups(result);
        setOpen(true);
      });
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(path: string) {
    setOpen(false);
    setQuery("");
    navigate(path);
  }

  return (
    <div className="position-relative" ref={containerRef} style={{ width: 320 }}>
      <div className="input-group input-group-sm">
        <span className="input-group-text actrs-surface border-end-0"><i className="bi bi-search" /></span>
        <input
          type="search"
          className="form-control border-start-0"
          placeholder="Search students, classes, reports…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          aria-label="Global search"
        />
      </div>

      {open && (
        <div
          className="position-absolute top-100 start-0 mt-1 actrs-surface border rounded-3 shadow-sm"
          style={{ width: "100%", maxHeight: 420, overflowY: "auto", zIndex: 1060 }}
        >
          {groups.length === 0 ? (
            <div className="p-3 text-muted small">No matches for "{query}".</div>
          ) : (
            groups.map((group) => (
              <div key={group.category} className="border-bottom">
                <div className="px-3 pt-2 pb-1 small fw-semibold text-muted text-uppercase" style={{ fontSize: "0.7rem" }}>
                  {group.category}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="d-block w-100 text-start btn btn-sm border-0 px-3 py-2"
                    onClick={() => goTo(item.path)}
                  >
                    <div className="small fw-medium text-truncate">{item.title}</div>
                    {item.subtitle && <div className="small text-muted text-truncate">{item.subtitle}</div>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Phase 6 (Module 8 - offline/PWA re-validation) found this badge was a
 *  hardcoded `<span>Offline</span>` that never actually read connectivity
 *  state - it always displayed "Offline" regardless of whether the device
 *  had a connection, which is exactly the kind of status indicator a user
 *  would reasonably trust and be misled by. ACTRS works the same either
 *  way (it never depends on a network), so this is purely an informational
 *  indicator, but it should tell the truth. Now backed by `navigator.onLine`
 *  plus the standard `online`/`offline` window events. */
function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export function Topbar() {
  const { mode, toggle } = useTheme();
  const { app } = useAppInfo();
  const online = useOnlineStatus();

  return (
    <header className="actrs-topbar d-flex align-items-center justify-content-between px-4 py-3 gap-3">
      <div className="d-none d-md-block">
        <span className="fw-semibold">{app.name}</span>
        <span className="text-muted ms-2 small">{app.phase}</span>
      </div>
      <GlobalSearch />
      <div className="d-flex align-items-center gap-3">
        <span
          className={`badge border ${online ? "text-bg-light" : "text-bg-secondary"}`}
          title="ACTRS works fully offline - this just reflects your device's current connection."
        >
          <i className={`bi ${online ? "bi-wifi" : "bi-wifi-off"} me-1`} />
          {online ? "Online" : "Offline"}
        </span>
        <button className="btn btn-sm btn-outline-secondary" onClick={toggle} aria-label="Toggle theme">
          <i className={`bi ${mode === "light" ? "bi-moon-stars" : "bi-sun"}`} />
        </button>
      </div>
    </header>
  );
}
