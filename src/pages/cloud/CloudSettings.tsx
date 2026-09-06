import { useState } from "react";
import { SettingsSchool } from "./settings/SettingsSchool";
import { SettingsAcademic } from "./settings/SettingsAcademic";
import { SettingsTemplate } from "./settings/SettingsTemplate";

type Tab = "school" | "academic" | "template";

const TABS: { key: Tab; label: string }[] = [
  { key: "school", label: "School profile" },
  { key: "academic", label: "Academic years & terms" },
  { key: "template", label: "Report template" },
];

/**
 * Settings hub - closes the long-standing gap where a new school's
 * academic year, terms and school_code all had to be set up by hand
 * (edulink_gh_term_school_setup_fix.sql). Three tabs, one per concern,
 * each already backed by an existing or newly extended service.
 */
export function CloudSettings() {
  const [tab, setTab] = useState<Tab>("school");

  return (
    <div>
      <h1 className="h4 mb-1">Settings</h1>
      <p className="text-muted mb-4">Manage your school profile, academic calendar and report template.</p>

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
    </div>
  );
}
