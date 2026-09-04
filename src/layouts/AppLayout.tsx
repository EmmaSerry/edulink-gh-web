import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { UpdatePrompt } from "@components/UpdatePrompt";

/** Permanent application shell: sidebar + top navigation, per the
 *  Phase 0 "Navigation Structure" requirement. Every routed page renders
 *  inside <Outlet /> so the shell never has to change as pages are added. */
export function AppLayout() {
  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>
      <Sidebar />
      <div className="flex-grow-1 d-flex flex-column">
        <Topbar />
        <main className="flex-grow-1 p-4">
          <Outlet />
        </main>
      </div>
      <UpdatePrompt />
    </div>
  );
}
