import { SettingsStaff } from "./settings/SettingsStaff";

/**
 * Standalone Staff page - the same SettingsStaff component that used to
 * live only as a Settings tab, promoted to its own sidebar item since
 * creating a teacher account is a routine, frequent task (do it, then
 * go straight to Classes to assign them) rather than an occasional
 * settings change.
 */
export function CloudStaffPage() {
  return (
    <div>
      <h1 className="h4 mb-1">Staff</h1>
      <p className="text-muted mb-4">Create and view staff accounts for your school.</p>
      <SettingsStaff />
    </div>
  );
}
