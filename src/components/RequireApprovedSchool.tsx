import { useEffect, useState, type ReactNode } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { rest } from "@/lib/supabaseClient";

/**
 * Blocks a self-registered school's own dashboard until a district/
 * platform admin approves it - see edulink_gh_phase0y_sms_and_approval.
 * sql (approval_status, list_pending_schools(), approve_school()).
 *
 * Only relevant to a user with a school_id (school_admin/teacher/
 * bursar) - district_admin and platform_admin accounts have no single
 * school and pass straight through.
 *
 * On any error checking the school's status, this fails OPEN (treats
 * it as approved) rather than locking someone out over a network
 * hiccup - every school that existed before this feature shipped is
 * already 'approved' by column default, so the only accounts this
 * could ever incorrectly gate are brand-new signups, and even then
 * only for as long as the network problem lasts.
 */
export function RequireApprovedSchool({ children }: { children: ReactNode }) {
  const { profile, signOut } = useCloudAuth();
  const [status, setStatus] = useState<"loading" | "approved" | "pending">("loading");
  const [schoolName, setSchoolName] = useState("");

  useEffect(() => {
    if (!profile?.school_id) {
      setStatus("approved");
      return;
    }
    let cancelled = false;
    rest
      .select<{ approval_status: string; name: string }>("schools", {
        select: "approval_status,name",
        filters: { id: `eq.${profile.school_id}` },
        limit: 1,
      })
      .then((rows) => {
        if (cancelled) return;
        const row = rows[0];
        setSchoolName(row?.name ?? "");
        setStatus(row?.approval_status === "pending" ? "pending" : "approved");
      })
      .catch(() => !cancelled && setStatus("approved"));
    return () => {
      cancelled = true;
    };
  }, [profile?.school_id]);

  if (status === "loading") {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: "100vh" }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading…</span>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="d-flex align-items-center justify-content-center p-3" style={{ minHeight: "100vh" }}>
        <div className="actrs-card p-4 text-center" style={{ maxWidth: 480 }}>
          <h1 className="h5 mb-2">Almost there</h1>
          <p className="text-muted mb-3">
            {schoolName || "Your school"} has been registered but is still waiting for approval from your district
            office. You'll be able to sign in normally as soon as it's approved - there's nothing else to do on your
            end.
          </p>
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
