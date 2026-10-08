import { Outlet } from "react-router-dom";
import { CloudSidebar } from "./CloudSidebar";
import { CloudTopbar } from "./CloudTopbar";
import { TrainingModeBanner } from "@components/TrainingModeBanner";
import { ImpersonationBanner } from "@components/ImpersonationBanner";

/** Permanent shell for every authenticated cloud page: sidebar + top
 *  bar, page content in <Outlet />. TrainingModeBanner renders nothing
 *  for a real account; ImpersonationBanner renders nothing unless the
 *  Super Admin is signed in as someone else. */
export function CloudAppLayout() {
  return (
    <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
      <ImpersonationBanner />
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
