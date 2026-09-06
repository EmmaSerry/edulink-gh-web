import { useState } from "react";
import { SettingsSchool } from "./settings/SettingsSchool";
import { SettingsAcademic } from "./settings/SettingsAcademic";
import { SettingsTemplate } from "./settings/SettingsTemplate";
import { SettingsClasses } from "./settings/SettingsClasses";

type Tab = "school" | "academic" | "template" | "classes";

const TABS: { key: Tab; label: string }[] = [
  { key: "school", label: "School profile" },
  { key: "academic", label: "Academic years & terms" },
  { key: "template", label: "Report template" },
  { key: "classes", label: "Classes" },
];

/**
 * Settings hub. Staff moved out to its own sidebar item (CloudStaffPage)
 * since creating accounts is routine enough to want one click, not two -
 * see the "decouple staff" request. Classes stays here since editing a
 * class is more of an occasional settings-style change.
 */
export function CloudSettings() {
  const [tab, setTab] = useState<Tab>("school");

  return (
    <div>
      <h1 className="h4 mb-1">Settings</h1>
      <p className="text-muted mb-4">Manage your school profile, academic calendar, report template, and classes.</p>

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
      {tab === "classes" && <SettingsClasses />}
    </div>
  );
}
