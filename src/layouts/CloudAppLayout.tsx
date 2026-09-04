import { Outlet } from "react-router-dom";
import { CloudSidebar } from "./CloudSidebar";
import { CloudTopbar } from "./CloudTopbar";

/** Permanent shell for every authenticated cloud page: sidebar + top
 *  bar, page content in <Outlet />. Mirrors the offline app's AppLayout
 *  pattern (same theme.css classes) minus the offline-only pieces
 *  (service-worker update prompt, connectivity badge). */
export function CloudAppLayout() {
  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      <CloudSidebar />
      <div className="flex-grow-1 d-flex flex-column">
        <CloudTopbar />
        <main className="flex-grow-1 p-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
