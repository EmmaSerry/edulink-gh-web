import { ImpersonationService, getImpersonation } from "@services/cloud/ImpersonationService";

const ROLE_LABEL: Record<string, string> = {
  teacher: "Teacher",
  bursar: "Bursar",
  school_admin: "School admin",
  district_admin: "District admin",
};

/** Shown on every page while the Super Admin is signed in as someone else. */
export function ImpersonationBanner() {
  const info = getImpersonation();
  if (!info) return null;
  return (
    <div
      className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-3 py-2"
      style={{ background: "#b45309", color: "#fff", position: "sticky", top: 0, zIndex: 2000 }}
    >
      <span>
        <i className="bi bi-person-badge me-2" />
        Super Admin view: signed in as <strong>{info.viewingName}</strong> ({ROLE_LABEL[info.viewingRole] ?? info.viewingRole}
        {info.viewingSchool ? `, ${info.viewingSchool}` : ""}). Anything you change is saved as this person.
      </span>
      <button className="btn btn-light btn-sm" onClick={() => ImpersonationService.stop()}>
        Return to Super Admin
      </button>
    </div>
  );
}
