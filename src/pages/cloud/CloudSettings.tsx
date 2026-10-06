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

/**
 * Settings hub. A school administrator sees the school tabs; a district
 * administrator sees District profile first and no Report template tab;
 * the Super Admin keeps the original set plus Circuits.
 */
export function CloudSettings() {
  const { profile } = useCloudAuth();
  const role = profile?.role;
  const isDistrictAdmin = role === "district_admin";
  const isPlatformAdmin = role === "platform_admin";
  const tabs = isDistrictAdmin
    ? DISTRICT_ADMIN_TABS
    : isPlatformAdmin
      ? [...SCHOOL_TABS, { key: "circuits" as Tab, label: "Circuits" }]
      : SCHOOL_TABS;
  const [tab, setTab] = useState<Tab>(isDistrictAdmin ? "district" : "school");

  return (
    <div>
      <h1 className="h4 mb-1">Settings</h1>
      <p className="text-muted mb-4">
        {isDistrictAdmin
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

      {tab === "school" && !isDistrictAdmin && <SettingsSchool />}
      {tab === "district" && isDistrictAdmin && <SettingsDistrict />}
      {tab === "academic" && <SettingsAcademic />}
      {tab === "template" && !isDistrictAdmin && <SettingsTemplate />}
      {tab === "classes" && <SettingsClasses />}
      {tab === "subjects" && <SettingsSubjects />}
      {tab === "circuits" && (isDistrictAdmin || isPlatformAdmin) && <SettingsCircuits />}
    </div>
  );
}
