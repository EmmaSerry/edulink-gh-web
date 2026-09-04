# ACTRS User Manual

**Amenfi Central Terminal Report System (ACTRS)** — Version 1.0
Developed by **Emmanuel Serry**, ICT Coordinator, Wassa Amenfi Central
Education Directorate.

This manual is written for **class teachers, headteachers, and school
administrators**. It assumes no prior computer experience beyond basic
comfort using a web browser (Chrome, Edge, or similar).

---

## 1. Introduction

ACTRS replaces the previous Excel workbook + Word Mail Merge process
used to produce terminal report cards for **KG1, KG2, Lower Primary,
Upper Primary and JHS**. It runs entirely inside a web browser, works
completely **offline** once installed, and never requires an internet
connection for day-to-day use — student registration, score entry,
report generation, printing, backups, and everything else all work with
no network connection at all.

All of a school's data stays on the device it is entered on, inside the
browser's own local storage. Nothing is sent anywhere unless a backup
file is explicitly created and shared (see Chapter 12).

## 2. System Requirements

- A computer (Windows, macOS, Chromebook, or Linux) with a recent web
  browser: **Google Chrome or Microsoft Edge are recommended** for the
  best offline/installation experience. Firefox and Safari also work for
  day-to-day use, though the "Install as an app" feature (Chapter 3)
  currently only appears in Chromium-based browsers.
- No internet connection is required after the first successful load.
- No minimum hardware beyond what's needed to run a modern browser
  comfortably — ACTRS is deliberately lightweight (see
  `docs/PHASE7_CERTIFICATION.md` for the performance work behind this).

## 3. Installation

**On a single school computer**, you don't need to type any commands:
double-click **`Start-ACTRS.bat`** (Windows) or **`start-actrs.sh`**
(macOS/Linux) in the ACTRS folder. The first time, it sets itself up
automatically (this needs an internet connection just that once);
every time after that, it starts in a few seconds and opens your browser
to ACTRS automatically. Keep the "ACTRS Server" window that appears open
while you're using it — closing that window closes ACTRS. Full detail:
`docs/DEPLOYMENT.md`.

If your ICT coordinator has instead deployed ACTRS to a shared address
(e.g. a school network or a Directorate-hosted address), just open that
web address in your browser instead.

Once the Dashboard loads, install ACTRS as its own app so it opens like
a regular desktop application:

1. Go to the **About** page (left-hand navigation).
2. Under "Install as an app", click **Install ACTRS**.
3. Confirm the prompt your browser shows.

ACTRS now opens as its own application (with its own icon), separate
from your regular browser tabs, and keeps working with no internet
connection. If your browser doesn't show an "Install ACTRS" button, look
for an "Install" or "Add to Home Screen" option in your browser's own
menu (usually the three-dot or three-line icon in the top corner).

## 4. First-Time Setup

The very first time ACTRS is opened on a device, it automatically fills
in a sensible starting configuration for you: all five levels (KG1, KG2,
Lower Primary, Upper Primary, JHS), standard subjects, the official
NaCCA KG Learning Areas and Skills, a default grade band scale, and a
starter set of remark phrases. You do not need to set any of this up
from scratch — you only need to review and adjust it for your school.

Recommended order for first-time setup:

1. **School Setup** — enter your school's name, code, circuit, district,
   region, headteacher's name, and contact details.
2. **Academic Years** — create the current academic year.
3. **Terms** — create Term 1, 2 and 3 under that year, with vacation and
   reopening dates.
4. **Levels & Classes** — confirm/add the classes your school actually
   runs (e.g. "JHS 2 A", "JHS 2 B").
5. **Settings** — review Subjects, KG Learning Areas/Skills, Grade Bands,
   and the Remarks Bank, and adjust anything specific to your school.

## 5. School Configuration

The **School Setup** page holds your school's profile (name, code,
address, headteacher, logo if applicable) — this information appears on
every printed report card. The **Settings** page has seven tabs:
**Subjects**, **KG Learning Areas**, **KG Skills**, **Grade Bands**,
**Remarks Bank**, **Report Templates**, and **System**. Grade Bands in
particular control what letter grade a numeric score becomes on a report
card — these are fully editable, never fixed in the software, so your
school's own grading scale is always respected.

## 6. Student Registration

From the **Students** page:

1. Click **Register Student**.
2. Fill in the student's personal details (name, date of birth, gender,
   nationality), admission information, and parent/guardian details.
3. Save. ACTRS automatically generates a permanent Student ID.
4. Assign the student to a class and term from their profile page (or
   during registration).

A student's profile page has tabs for **Academic Details**, **Parent
Information**, **Enrollment History**, **Promotion History**,
**Assessment History**, **Report Card History**, **Attendance Summary**,
and **Audit Information** — everything about one student, in one place,
across every term they've ever been enrolled in.

Bulk registration of many students at once (e.g. a new school year's
intake) is available via **Import & Export** → student import, which
accepts an Excel/CSV spreadsheet — see that page's own on-screen
instructions for the expected column headings.

## 7. Assessment Entry (Lower Primary, Upper Primary, JHS)

From **Assessments**, choose a class to open its assessment workspace:

1. Enter each student's **SBA (School-Based Assessment)** and
   **Exam** score for each subject, each on their own 0-50 scale.
   ACTRS automatically adds them together for the subject total,
   capped at 100.
2. Move a class through its assessment status: **Draft → Completed →
   Verified → Finalized**, tracking progress as teachers, then a
   headteacher, review the entries.
3. Enter each student's remarks (class teacher's remark, headteacher's
   remark) from the same workspace.

Grades, subject rankings and overall class position are always
calculated automatically from the raw scores — they are never typed in
by hand, so they can never accidentally disagree with the underlying
scores.

## 8. KG Assessment (KG1 & KG2)

KG assessment works differently from the scored levels, matching the
official **NaCCA KG Assessment Tool** exactly: instead of numeric
scores, each skill within a Learning Area is rated **Gold, Silver,
Bronze, Not Yet Assessed, or Absent**. There are no totals, averages,
grades, percentages or class positions anywhere in a KG report — this is
a deliberate design decision matching NaCCA's own qualitative approach,
not a missing feature.

From **Assessments**, opening a KG class shows the skill-rating grid,
grouped by Learning Area, ready to rate each learner.

## 9. Report Generation

From **Report Cards**, choose an academic year, term and level to see
every class's assessment/report status at a glance. From there:

1. **Preview** a class's reports before generating anything permanent.
2. **Generate** turns the current assessment data into an official,
   dated report card for every student in the class.
3. Reports are versioned automatically — regenerating a report (for
   example, after correcting a mistaken score) creates a new version
   without ever deleting the previous one, so a past printed report can
   always be reproduced exactly as it was originally printed.

## 10. Printing

From the Report Preview screen, use **Print** to send reports straight
to your printer exactly as previewed, or **Export PDF** to save a PDF
copy (for emailing, archiving to a USB drive, or printing later from a
different computer). Both single-student and whole-class batch
printing/export are supported.

## 11. Archives

Once a term is finished and all its reports are final, **Archives** lets
you close/archive that term. An archived term's data is then
permanently protected — no score, remark, or report belonging to it can
ever be edited or deleted again, safeguarding your historical academic
records. You can still view and reprint every report from an archived
term at any time; archiving only prevents *changes*, never *access*. An
accidental archive can be reversed ("Unarchive") if truly necessary.

## 12. Backup

From **Backup & Restore**, create a backup at any time — choose a **Full
Backup** (everything) or a **Partial Backup** (just the modules you
choose, e.g. only Students), and a file format (JSON is recommended for
restoring later; Excel/CSV are for viewing outside ACTRS only). Save the
resulting file somewhere safe — a USB drive, an external hard drive, or
a shared network folder — separate from the computer ACTRS runs on.

**We recommend backing up regularly** — see `docs/MAINTENANCE_GUIDE.md`
for a suggested schedule.

## 13. Restore

Also from **Backup & Restore**, choose **Restore**, select a previously
saved `.json` backup file, and review the preview screen (which shows
exactly what will change) before confirming. Restoring replaces the
selected data with what's in the backup file — if something goes wrong
partway through a restore, ACTRS automatically leaves your existing data
completely untouched, rather than leaving it half-changed.

## 14. Troubleshooting

- **The app looks stuck on an old version.** Go to **Diagnostics** and
  use the cache-clearing option, then reload.
- **A student/score/report seems to be missing.** Check whether the
  correct academic year and term are selected at the top of the page —
  ACTRS always shows data scoped to the year/term you've chosen.
- **I can't edit something in an old term.** That term has likely been
  archived (Chapter 11) — this is expected and intentional, protecting
  historical records.
- **A report's information looks wrong.** Check the underlying scores/
  remarks first, then regenerate the report — reports are always
  calculated fresh from the current data, never hand-edited.
- **The "Install ACTRS" button doesn't appear.** See Chapter 3 for the
  browser menu alternative.
- **The one-click launcher fails during first-time setup, or says
  `'tsc' is not recognized`.** This means the one-time component
  download didn't finish - almost always a brief internet interruption.
  The launcher now retries automatically once; if it still fails,
  check your internet connection and double-click it again. If the
  ACTRS folder lives inside OneDrive, Dropbox, iCloud Drive, or Google
  Drive, that sync service can lock files mid-setup - moving the whole
  folder to a plain local folder (e.g. `C:\ACTRS`) resolves this.
- **After extracting an updated copy of ACTRS, the app still looks/
  behaves like the old version.** Earlier versions of the launcher only
  ever built ACTRS once and never checked again, so an update's fixes
  never actually took effect no matter how many times you re-extracted
  it. The launcher now checks a version number every time it starts and
  rebuilds automatically whenever it doesn't match, so this should no
  longer happen from this version onward. If it ever still seems stuck
  on an old version: close the "ACTRS Server" window if one is open,
  delete the `dist` folder inside the ACTRS folder, then double-click
  `Start-ACTRS.bat` again to force a full rebuild.
- **Double-clicking `Start-ACTRS.bat` shows a "Windows Security -
  These files can't be opened" message.** This is Windows blocking the
  file because it was extracted from a ZIP downloaded from the
  internet (the "Mark of the Web"), not a problem with ACTRS itself.
  Fix it once per download with either of these:
  - Right-click `Unblock-ACTRS.ps1` (included in this folder) and
    choose **Run with PowerShell**, then try `Start-ACTRS.bat` again.
  - Or right-click the original `.zip` file (before extracting) ->
    **Properties** -> tick **Unblock** at the bottom of the General
    tab -> **OK** -> extract again.

For anything not covered here, see **Diagnostics**, which reports the
current health of the app and offers specific troubleshooting guidance
based on what it finds, or contact your ICT coordinator.

## 15. Frequently Asked Questions

**Does ACTRS need the internet to work?**
No. Only the very first load (or checking for an update) benefits from a
connection — everything else works fully offline.

**Where is my data actually stored?**
Locally, in the browser, on the exact device you're using. It does not
automatically go anywhere else — that's exactly why regular backups
(Chapter 12) matter.

**What happens if the computer is lost, stolen, or its hard drive fails?**
Any data not backed up to a separate location (Chapter 12) is lost with
the device — see `docs/DISASTER_RECOVERY.md` for full guidance on
preventing and recovering from this.

**Can two teachers use ACTRS on two different computers for the same
class?**
Each installed copy of ACTRS has its own independent data. There is no
built-in synchronization between two separate devices in Version 1.0 —
see `docs/FUTURE_ROADMAP.md` for planned multi-device/cloud options.

**Will a KG report ever show a percentage or a grade?**
Only attendance is ever shown as a percentage (a distinct, non-academic
figure) — KG reports never show a total, average, grade, or class
position, matching the official NaCCA assessment model exactly.

**How do I know if my data is safe?**
Take regular backups (Chapter 12) and store them somewhere other than
the computer ACTRS runs on.
