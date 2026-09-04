import { Outlet } from "react-router-dom";
import { Brand } from "@components/Brand";
import { DeveloperCredit } from "@components/DeveloperCredit";

/** Centred, unauthenticated-shell layout used by the Login page. */
export function AuthLayout() {
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center"
      style={{ minHeight: "100vh", background: "var(--actrs-grey-light)" }}
    >
      <div className="mb-4">
        <Brand />
      </div>
      <div className="actrs-card p-4" style={{ width: 380 }}>
        <Outlet />
      </div>
      <div className="mt-4">
        <DeveloperCredit variant="full" />
      </div>
    </div>
  );
}
