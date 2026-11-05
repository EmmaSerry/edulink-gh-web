import { useState } from "react";
import { useCloudAuth } from "@contexts/CloudAuthContext";
import { SettingsSchool } from "./settings/SettingsSchool";
import { SettingsDistrict } from "./settings/SettingsDistrict";
import { SettingsAcademic } from "./settings/SettingsAcademic";
import { SettingsTemplate } from "./settings/SettingsTemplate";
import { SettingsClasses } from "./settings/SettingsClasses";
import { SettingsSubjects } from "./settings/SettingsSubjects";
import { SettingsCircuits } from "./settings/SettingsCircuits";

type Tab = "school" | "district" | "academic" | "template" | "classes" | "subjects" | "circuits";

const SCHOOL_TABS: { key: Tab; label: string }[] = [
  { key: "school", label: "School profile" },
  { key: "academic", label: "Academic years & terms" },
  { key: "template", label: "Report template" },
  { key: "classes", label: "Classes" },
  { key: "subjects", label: "Subjects" },
];

// A district administrator: "District profile" comes first, and there is
// no "Report template" tab (report templates belong to each school).
const DISTRICT_ADMIN_TABS: { key: Tab; label: string }[] = [
  { key: "district", label: "District profile" },
  { key: "academic", label: "Academic years & terms" },
  { key: "classes", label: "Classes" },
  { key: "subjects", label: "Subjects" },
  { key: "circuits", label: "Circuits" },
];

// The Super Admin belongs to no school, so the school-level tabs would just
// show some random school's data. Only platform-wide settings are listed.
const PLATFORM_ADMIN_TABS: { key: Tab; label: string }[] = [{ key: "circuits", label: "Circuits" }];

/**
 * Settings hub. A school administrator sees the school tabs; a district
 * administrator sees District profile first and no Report template tab;
 * the Super Admin sees only platform-wide settings (Circuits).
 */
export function CloudSettings() {
  const { profile } = useCloudAuth();
  const role = profile?.role;
  const isDistrictAdmin = role === "district_admin";
  const isPlatformAdmin = role === "platform_admin";
  const tabs = isDistrictAdmin ? DISTRICT_ADMIN_TABS : isPlatformAdmin ? PLATFORM_ADMIN_TABS : SCHOOL_TABS;
  const [tab, setTab] = useState<Tab>(isDistrictAdmin ? "district" : isPlatformAdmin ? "circuits" : "school");

  return (
    <div>
      <h1 className="h4 mb-1">Settings</h1>
      <p className="text-muted mb-4">
        {isPlatformAdmin
          ? "Platform-wide settings. School settings are managed by each school's own administrator."
          : isDistrictAdmin
            ? "Manage your district profile, academic calendar, classes, subjects and circuits."
            : "Manage your school profile, academic calendar, report template, classes, and subjects."}
      </p>

      <ul className="nav nav-pills mb-4">
        {tabs.map((t) => (
          <li className="nav-item" key={t.key}>
            <button
              type="button"
              className={`nav-link ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      {tab === "school" && !isDistrictAdmin && !isPlatformAdmin && <SettingsSchool />}
      {tab === "district" && isDistrictAdmin && <SettingsDistrict />}
      {tab === "academic" && !isPlatformAdmin && <SettingsAcademic />}
      {tab === "template" && !isDistrictAdmin && !isPlatformAdmin && <SettingsTemplate />}
      {tab === "classes" && !isPlatformAdmin && <SettingsClasses />}
      {tab === "subjects" && !isPlatformAdmin && <SettingsSubjects />}
      {tab === "circuits" && (isDistrictAdmin || isPlatformAdmin) && <SettingsCircuits />}
    </div>
  );
}
