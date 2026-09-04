/**
 * Single source of truth for the primary navigation.
 *
 * Every future module (Phase 1+) is added here as one entry - the
 * Sidebar/Topbar components render this list, they never hard-code
 * routes or labels. This is what lets "future modules be added without
 * restructuring the project" per the Phase 0 brief.
 *
 * Icons use the Bootstrap Icons font (bootstrap-icons package), referenced
 * by class name so no extra icon-component library is required.
 */
export interface NavItem {
  label: string;
  path: string;
  /** Bootstrap Icons class name, e.g. "bi-speedometer2". */
  icon: string;
  /** Phase in which the module becomes functional (0 = foundation only). */
  availableFromPhase: number;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    path: "/",
    icon: "bi-speedometer2",
    availableFromPhase: 0,
    description: "System overview and quick actions",
  },
  {
    label: "School Setup",
    path: "/school-setup",
    icon: "bi-building",
    availableFromPhase: 1,
    description: "School profile, head teacher and circuit information",
  },
  {
    label: "Academic Years",
    path: "/academic-years",
    icon: "bi-calendar3",
    availableFromPhase: 1,
    description: "Manage academic years",
  },
  {
    label: "Terms",
    path: "/terms",
    icon: "bi-calendar-range",
    availableFromPhase: 1,
    description: "Term configuration: dates, attendance days",
  },
  {
    label: "Levels & Classes",
    path: "/levels-classes",
    icon: "bi-layers",
    availableFromPhase: 1,
    description: "KG1, KG2, Lower/Upper Primary, JHS and their classes",
  },
  {
    label: "Students",
    path: "/students",
    icon: "bi-people",
    availableFromPhase: 1,
    description: "Learner roster and bio-data",
  },
  {
    label: "Assessments",
    path: "/assessments",
    icon: "bi-clipboard-check",
    availableFromPhase: 2,
    description: "Score entry (scored levels) and skill ratings (KG)",
  },
  {
    label: "Report Cards",
    path: "/report-cards",
    icon: "bi-file-earmark-text",
    availableFromPhase: 3,
    description: "Preview and generate terminal report cards",
  },
  {
    label: "Archives",
    path: "/archives",
    icon: "bi-archive",
    availableFromPhase: 5,
    description: "Historical terms and past report cards",
  },
  {
    label: "Backup & Restore",
    path: "/backup-restore",
    icon: "bi-cloud-arrow-up-down",
    availableFromPhase: 5,
    description: "Export/import the full dataset",
  },
  {
    label: "Import & Export",
    path: "/import-export",
    icon: "bi-arrow-down-up",
    availableFromPhase: 5,
    description: "Centralized bulk import and export for students, configuration, reports and statistics",
  },
  {
    label: "System Logs",
    path: "/system-logs",
    icon: "bi-journal-text",
    availableFromPhase: 5,
    description: "Full activity/audit trail across every module",
  },
  {
    label: "Diagnostics",
    path: "/diagnostics",
    icon: "bi-heart-pulse",
    availableFromPhase: 5,
    description: "Database, storage, cache and offline health checks",
  },
  {
    label: "Settings",
    path: "/settings",
    icon: "bi-gear",
    availableFromPhase: 1,
    description: "Grade bands, subjects, learning areas, remarks banks",
  },
  {
    label: "Help",
    path: "/help",
    icon: "bi-question-circle",
    availableFromPhase: 0,
    description: "User manual",
  },
  {
    label: "About",
    path: "/about",
    icon: "bi-info-circle",
    availableFromPhase: 0,
    description: "Version, licence and developer information",
  },
];
