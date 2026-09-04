import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@components/PageHeader";
import { Card } from "@components/Card";
import { DeveloperCredit } from "@components/DeveloperCredit";

type Section =
  | "gettingStarted"
  | "systemConfiguration"
  | "studentRegistration"
  | "assessmentEntry"
  | "reportGeneration"
  | "backupRestore"
  | "faq"
  | "troubleshooting";

const SECTIONS: Array<{ key: Section; label: string; icon: string }> = [
  { key: "gettingStarted", label: "Getting Started", icon: "bi-play-circle" },
  { key: "systemConfiguration", label: "System Configuration", icon: "bi-gear" },
  { key: "studentRegistration", label: "Student Registration", icon: "bi-person-plus" },
  { key: "assessmentEntry", label: "Assessment Entry", icon: "bi-clipboard-check" },
  { key: "reportGeneration", label: "Report Generation", icon: "bi-file-earmark-text" },
  { key: "backupRestore", label: "Backup & Restore", icon: "bi-cloud-arrow-up-down" },
  { key: "faq", label: "FAQ", icon: "bi-question-circle" },
  { key: "troubleshooting", label: "Troubleshooting", icon: "bi-tools" },
];

/**
 * Module 10 (Phase 5) - Help Centre. A real user manual, written against
 * the actual finished screens (not generic placeholder text) - every
 * link below points at a route that exists in this build.
 */
export function Help() {
  const [section, setSection] = useState<Section>("gettingStarted");

  return (
    <>
      <PageHeader title="Help Centre" description="User manual for ACTRS" />

      <div className="row g-4">
        <div className="col-md-3">
          <Card padded={false}>
            <div className="list-group list-group-flush">
              {SECTIONS.map((s) => (
                <button
                  key={s.key}
                  className={`list-group-item list-group-item-action d-flex align-items-center gap-2 ${section === s.key ? "active" : ""}`}
                  onClick={() => setSection(s.key)}
                >
                  <i className={`bi ${s.icon}`} /> {s.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="col-md-9">
          <Card>
            {section === "gettingStarted" && (
              <div>
                <h2 className="h5">Getting Started</h2>
                <p className="text-muted">
                  ACTRS runs entirely in this browser - there is no server, no internet connection required,
                  and no separate installation. The recommended first-time setup order is:
                </p>
                <ol className="text-muted">
                  <li><Link to="/school-setup">School Setup</Link> - school name, contact details, logo and signatories.</li>
                  <li><Link to="/academic-years">Academic Years</Link> and <Link to="/terms">Terms</Link> - create the current academic year and mark one term active.</li>
                  <li><Link to="/levels-classes">Levels & Classes</Link> - confirm KG1/KG2/Primary/JHS levels and their classes.</li>
                  <li><Link to="/settings">Settings</Link> - review Subjects, KG Learning Areas & Skills, Grade Bands and the Remarks Bank (sensible defaults are pre-loaded).</li>
                  <li><Link to="/students">Students</Link> - register learners individually, or bulk-import via the <Link to="/import-export">Import & Export Centre</Link>.</li>
                </ol>
                <p className="text-muted mb-0">
                  Every menu item on the left is available at all times; the badge next to some items just shows
                  which development phase introduced that module.
                </p>
              </div>
            )}

            {section === "systemConfiguration" && (
              <div>
                <h2 className="h5">System Configuration</h2>
                <p className="text-muted">Everything under <Link to="/settings">Settings</Link> is configuration-driven, meaning future changes (a new subject, an extra grade band, a renamed level) never require a software update:</p>
                <ul className="text-muted">
                  <li><strong>Subjects</strong> - which subjects exist and which levels they apply to.</li>
                  <li><strong>KG Learning Areas & Skills</strong> - the official NaCCA skill checklist, editable if NaCCA revises it.</li>
                  <li><strong>Grade Bands</strong> - the score thresholds/labels every report card and analytics figure (pass rate, grade distribution) is computed from.</li>
                  <li><strong>Remarks Bank</strong> - the picklists for Conduct/Interest/Attitude/Teacher/Headteacher remarks.</li>
                  <li><strong>Report Templates</strong> - paper size, margins, fonts, colours, watermark and signature titles applied to every generated report card.</li>
                </ul>
              </div>
            )}

            {section === "studentRegistration" && (
              <div>
                <h2 className="h5">Student Registration</h2>
                <p className="text-muted">
                  Register a learner from <Link to="/students">Students</Link> - "New Student". Bio-data, a guardian and
                  a class assignment are captured together. To bulk-register many students at once, use "Import
                  students" from the <Link to="/import-export">Import & Export Centre</Link>, which validates every row
                  (missing fields, invalid dates, duplicate admission numbers) before anything is saved and shows a
                  clear per-row error list.
                </p>
                <p className="text-muted mb-0">
                  A student's class assignment for future terms is handled separately via Promotion, so history
                  (which class a learner was in each term) is always preserved.
                </p>
              </div>
            )}

            {section === "assessmentEntry" && (
              <div>
                <h2 className="h5">Assessment Entry</h2>
                <p className="text-muted">
                  Open <Link to="/assessments">Assessments</Link>, choose a class - Lower/Upper Primary and JHS classes
                  get a spreadsheet-style SBA/Exam score grid with live totals, grade bands and positions; KG1/KG2
                  classes get a Gold/Silver/Bronze/X/O skill-rating grid instead (no scores or rankings, matching the
                  official NaCCA report). Remarks and attendance are entered on the same screen. An assessment moves
                  through Draft → Completed → Verified → Finalized - only a Finalized assessment can generate report
                  cards, and reopening a finalized assessment is a deliberate, logged action.
                </p>
                <p className="text-muted mb-0">
                  Once a term is archived (see Backup & Restore section below), its assessments can no longer be
                  edited or reopened - this is what makes historical records permanent.
                </p>
              </div>
            )}

            {section === "reportGeneration" && (
              <div>
                <h2 className="h5">Report Generation</h2>
                <p className="text-muted">
                  From <Link to="/report-cards">Report Cards</Link>, pick a year/term/level to see every class's
                  generation progress, then open a class to generate, preview, print or export report cards for one
                  student, a selection, or the whole class. The correct layout (KG, Lower Primary, Upper Primary or
                  JHS) is chosen automatically from the student's level - never a manual choice - and every report is
                  validated first (enrollment, finalized assessment, required remarks, attendance, promotion decision,
                  school info) so an incomplete report can never be generated by accident.
                </p>
                <p className="text-muted mb-0">
                  Every report ever generated is kept as a permanent version - reprinting later does not
                  recalculate anything unless the underlying assessment is reopened.
                </p>
              </div>
            )}

            {section === "backupRestore" && (
              <div>
                <h2 className="h5">Backup, Restore & Archives</h2>
                <p className="text-muted">
                  <Link to="/backup-restore">Backup & Restore</Link> creates a full or partial backup (JSON is fully
                  restorable; Excel/CSV are for viewing outside ACTRS only) and can restore one back in, with a
                  preview of exactly what will change before anything is written, and an all-or-nothing restore - if
                  anything goes wrong partway through, nothing is changed.
                </p>
                <p className="text-muted mb-0">
                  <Link to="/archives">Archives</Link> permanently closes a completed term: its scores, remarks and
                  class assignments become locked (view/reprint only), and its academic year can be compared against
                  others. Both tools work completely offline.
                </p>
              </div>
            )}

            {section === "faq" && (
              <div>
                <h2 className="h5">Frequently Asked Questions</h2>
                <dl>
                  <dt>Does ACTRS need an internet connection?</dt>
                  <dd className="text-muted">No. Every feature, including report card PDF generation and printing, works fully offline once the app has loaded once.</dd>
                  <dt>Where is my data stored?</dt>
                  <dd className="text-muted">In this browser's local database (IndexedDB) on this device only. Use Backup & Restore regularly, especially before clearing browser data or switching devices.</dd>
                  <dt>Can I change a report's layout or branding?</dt>
                  <dd className="text-muted">Yes - under Settings → Report Templates, without any code change: paper size, margins, fonts, colours, watermark and signature titles.</dd>
                  <dt>What happens if I archive a term by mistake?</dt>
                  <dd className="text-muted">Archives can be reversed from the Archives screen ("Unarchive") - a deliberate, logged safety action, not a routine one.</dd>
                  <dt>Why can't I edit a score after it's finalized?</dt>
                  <dd className="text-muted">An administrator can reopen a finalized assessment (logged in the audit trail) - unless its term has since been archived, in which case it is permanently locked.</dd>
                </dl>
              </div>
            )}

            {section === "troubleshooting" && (
              <div>
                <h2 className="h5">Troubleshooting</h2>
                <p className="text-muted">
                  Visit <Link to="/diagnostics">Diagnostics</Link> first for a live health check (database, storage,
                  service worker, cache) and specific guidance for whatever it finds. Common situations:
                </p>
                <ul className="text-muted mb-0">
                  <li><strong>The app looks out of date after an update</strong> - a "Reload now" prompt appears automatically when a new version is ready; you can also use "Clear cache & reload" on the Diagnostics page (this never touches your student/assessment/report data).</li>
                  <li><strong>A report card is missing information</strong> - Report Validation will list exactly what's missing (e.g. attendance not recorded, remarks not entered) before it lets you generate the report.</li>
                  <li><strong>Storage seems full</strong> - Diagnostics shows current usage; consider archiving old terms and creating a backup.</li>
                  <li><strong>Something looks wrong after a bulk import</strong> - check <Link to="/import-export">Import & Export Centre</Link> → Export history and the per-row error list shown at import time.</li>
                  <li><strong>You need to see who did what and when</strong> - <Link to="/system-logs">System Logs</Link> has a filterable, complete activity trail.</li>
                </ul>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <DeveloperCredit variant="full" />
          </Card>
        </div>
      </div>
    </>
  );
}
