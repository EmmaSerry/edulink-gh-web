import { useEffect, useState } from "react";
import { CURRENT_USER_STORAGE_KEY as STORAGE_KEY } from "@utils/currentUser";

/**
 * ACTRS has no server and (per Phase 0/1/2) no real authentication yet -
 * the Login screen remains a placeholder. But Module 12's audit trail
 * still needs a "Created By / Modified By" name, so this hook stores a
 * simple, locally-remembered display name (e.g. "Mr. Mensah") the
 * teacher enters once. It is attribution for the local audit log only,
 * NOT an access-control mechanism.
 */
export function useCurrentUser() {
  const [name, setNameState] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? "");

  useEffect(() => {
    if (name) localStorage.setItem(STORAGE_KEY, name);
  }, [name]);

  return {
    name: name || "Unknown user",
    isSet: !!name,
    setName: (value: string) => setNameState(value),
  };
}
