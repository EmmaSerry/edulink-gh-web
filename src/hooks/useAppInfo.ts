import { APP_INFO, DEVELOPER_INFO, ORGANISATION_INFO } from "@config/appConfig";

/** Single hook every page/component uses to render branding & developer
 *  credit, so it is never hand-typed twice. */
export function useAppInfo() {
  return { app: APP_INFO, developer: DEVELOPER_INFO, organisation: ORGANISATION_INFO };
}
