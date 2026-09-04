/**
 * Shared localStorage key for the locally-remembered user display name
 * (see useCurrentUser.ts for the hook version used inside components).
 * Kept as a plain exported constant, rather than duplicated, so the
 * hook is the single place that reads/writes it.
 */
export const CURRENT_USER_STORAGE_KEY = "actrs.currentUser";
