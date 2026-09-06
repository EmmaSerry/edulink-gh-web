import { useState } from "react";
import { SettingsSchool } from "./settings/SettingsSchool";
import { SettingsAcademic } from "./settings/SettingsAcademic";
import { SettingsTemplate } from "./settings/SettingsTemplate";
import { SettingsStaff } from "./settings/SettingsStaff";
import { SettingsClasses } from "./settings/SettingsClasses";

type Tab = "school" | "academic" | "template" | "staff" | "classes";

const TABS: { key: Tab; label: string }[] = [
  { key: "school", label: "School profile" },
  { key: "academic", label: "Academic years & terms" },
  { key: "template", label: "Report template" },
  { key: "staff", label: "Staff" },
  { key: "classes", label: "Classes" },
];

/**
 * Settings hub - closes the long-standing gap where a new school's
 * academic year, terms, school_code, staff accounts and class-teacher
 * assignments all had to be set up by hand. Five tabs, one per concern,
 * each backed by its own service.
 */
export function CloudSettings() {
  const [tab, setTab] = useState<Tab>("school");

  return (
    <div>
      <h1 className="h4 mb-1">Settings</h1>
      <p className="text-muted mb-4">
        Manage your school profile, academic calendar, report template, staff, and classes.
      </p>

      <ul className="nav nav-pills mb-4">
        {TABS.map((t) => (
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

      {tab === "school" && <SettingsSchool />}
      {tab === "academic" && <SettingsAcademic />}
      {tab === "template" && <SettingsTemplate />}
      {tab === "staff" && <SettingsStaff />}
      {tab === "classes" && <SettingsClasses />}
    </div>
  );
}
