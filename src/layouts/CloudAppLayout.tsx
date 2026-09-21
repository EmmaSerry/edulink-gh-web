import { Outlet } from "react-router-dom";
import { CloudSidebar } from "./CloudSidebar";
import { CloudTopbar } from "./CloudTopbar";
import { TrainingModeBanner } from "@components/TrainingModeBanner";

/** Permanent shell for every authenticated cloud page: sidebar + top
 *  bar, page content in <Outlet />. Mirrors the offline app's AppLayout
 *  pattern (same theme.css classes) minus the offline-only pieces
 *  (service-worker update prompt, connectivity badge). TrainingModeBanner
 *  renders nothing for a real account - see that component. */
export function CloudAppLayout() {
  return (
    <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
      <TrainingModeBanner />
      <div className="d-flex flex-grow-1">
        <CloudSidebar />
        <div className="flex-grow-1 d-flex flex-column">
          <CloudTopbar />
          <main className="flex-grow-1 p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
