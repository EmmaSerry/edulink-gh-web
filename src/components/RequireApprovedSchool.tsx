import { useEffect, useState, type ReactNode } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { rest } from "@/lib/supabaseClient";

/**
 * Blocks a self-registered school's own dashboard until a district/
 * platform admin approves it - see edulink_gh_phase0y_sms_and_approval.
 * sql (approval_status, list_pending_schools(), approve_school()). Now
 * also blocks a self-registered DISTRICT's own dashboard the same way,
 * until platform_admin approves it - see edulink_gh_district_signup.sql
 * (districts.approval_status, list_pending_districts(), approve_district()).
 * Kept as one component rather than two, since the two checks are
 * mutually exclusive by construction (see below) and every route that
 * needed the school check also needs the district one.
 *
 * A school_admin/teacher/bursar has profile.school_id set (checked
 * first); a district_admin has district_id set but no school_id
 * (checked second, only reached when there's no school_id at all);
 * platform_admin has neither and passes straight through. A
 * school_admin's profile also carries a district_id (the district
 * their school belongs to), which is exactly why the school check must
 * run first and short-circuit - otherwise a perfectly-approved school's
 * own admin could get blocked by an unrelated pending-district check.
 *
 * On any error checking status, this fails OPEN (treats it as
 * approved) rather than locking someone out over a network hiccup -
 * every school/district that existed before this feature shipped is
 * already 'approved' by column default, so the only accounts this
 * could ever incorrectly gate are brand-new signups, and even then
 * only for as long as the network problem lasts.
 */
export function RequireApprovedSchool({ children }: { children: ReactNode }) {
  const { profile, signOut } = useCloudAuth();
  const [status, setStatus] = useState<"loading" | "approved" | "pending">("loading");
  const [entityName, setEntityName] = useState("");
  const [entityKind, setEntityKind] = useState<"school" | "district">("school");

  useEffect(() => {
    if (profile?.school_id) {
      setEntityKind("school");
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
          setEntityName(row?.name ?? "");
          setStatus(row?.approval_status === "pending" ? "pending" : "approved");
        })
        .catch(() => !cancelled && setStatus("approved"));
      return () => {
        cancelled = true;
      };
    }

    if (profile?.district_id) {
      setEntityKind("district");
      let cancelled = false;
      rest
        .select<{ approval_status: string; name: string }>("districts", {
          select: "approval_status,name",
          filters: { id: `eq.${profile.district_id}` },
          limit: 1,
        })
        .then((rows) => {
          if (cancelled) return;
          const row = rows[0];
          setEntityName(row?.name ?? "");
          setStatus(row?.approval_status === "pending" ? "pending" : "approved");
        })
        .catch(() => !cancelled && setStatus("approved"));
      return () => {
        cancelled = true;
      };
    }

    setStatus("approved");
  }, [profile?.school_id, profile?.district_id]);

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
            {entityName || (entityKind === "district" ? "Your district" : "Your school")} has been registered but
            is still waiting for approval from {entityKind === "district" ? "EduLink GH" : "your district office"}.
            You'll be able to sign in normally as soon as it's approved - there's nothing else to do on your end.
          </p>
          {entityKind === "school" && (
            <p className="text-muted mb-3">
              Look out for an SMS on the phone number you registered with - it will let you know as soon as your
              account is ready and confirm how to sign in.
            </p>
          )}
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
