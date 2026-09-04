import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { Breadcrumb } from "@components/Breadcrumb";
import { SubjectsTab } from "./settings/SubjectsTab";
import { LearningAreasTab } from "./settings/LearningAreasTab";
import { SkillsTab } from "./settings/SkillsTab";
import { GradeBandsTab } from "./settings/GradeBandsTab";
import { RemarksBankTab } from "./settings/RemarksBankTab";
import { SystemTab } from "./settings/SystemTab";
import { ReportTemplatesTab } from "./settings/ReportTemplatesTab";

type TabKey = "subjects" | "learningAreas" | "skills" | "gradeBands" | "remarks" | "reportTemplates" | "system";

const TABS: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "subjects", label: "Subjects", icon: "bi-journal-bookmark" },
  { key: "learningAreas", label: "KG Learning Areas", icon: "bi-diagram-3" },
  { key: "skills", label: "KG Skills", icon: "bi-list-check" },
  { key: "gradeBands", label: "Grade Bands", icon: "bi-bar-chart-steps" },
  { key: "remarks", label: "Remarks Bank", icon: "bi-chat-square-text" },
  { key: "reportTemplates", label: "Report Templates", icon: "bi-file-earmark-richtext" },
  { key: "system", label: "System", icon: "bi-sliders" },
];

/**
 * Settings houses Modules 6-11 (Subject Management, KG Learning Area
 * Management, KG Skill Management, Grade Band Configuration, Remarks
 * Bank, System Settings) as tabs within the single "/settings" route
 * defined in Phase 0's navigation - see docs/PHASE1_CONFIGURATION.md for
 * why this route grouping was chosen instead of adding new nav items.
 */
const VALID_TAB_KEYS: TabKey[] = ["subjects", "learningAreas", "skills", "gradeBands", "remarks", "reportTemplates", "system"];

export function Settings() {
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = VALID_TAB_KEYS.includes(requestedTab as TabKey) ? (requestedTab as TabKey) : "subjects";
  const [tab, setTab] = useState<TabKey>(initialTab);

  return (
    <>
      <Breadcrumb items={[{ label: "Settings" }]} />
      <PageHeader
        title="Settings"
        description="Curriculum configuration (subjects, KG learning areas & skills, grade bands, remarks bank) and system-wide preferences."
      />
      <ul className="nav nav-tabs mb-3 flex-nowrap overflow-auto">
        {TABS.map((t) => (
          <li className="nav-item" key={t.key}>
            <button
              className={`nav-link d-flex align-items-center gap-1 ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              <i className={`bi ${t.icon}`} />
              {t.label}
            </button>
          </li>
        ))}
      </ul>
      <Card>
        {tab === "subjects" && <SubjectsTab />}
        {tab === "learningAreas" && <LearningAreasTab />}
        {tab === "skills" && <SkillsTab />}
        {tab === "gradeBands" && <GradeBandsTab />}
        {tab === "remarks" && <RemarksBankTab />}
        {tab === "reportTemplates" && <ReportTemplatesTab />}
        {tab === "system" && <SystemTab />}
      </Card>
    </>
  );
}
