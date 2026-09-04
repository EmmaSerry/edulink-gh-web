# ACTRS Administrator Guide

**Amenfi Central Terminal Report System (ACTRS)** — Version 1.0

This guide is for the person responsible for configuring and maintaining
ACTRS at a school — typically a headteacher, deputy, or ICT coordinator.
It goes deeper than the User Manual (`docs/USER_MANUAL.md`) into the
configuration options that shape how the whole school uses the system,
and the ongoing responsibilities that keep it running reliably long-term.

## 1. System Configuration overview

All school-specific configuration lives under **School Setup** and the
seven **Settings** tabs (Subjects, KG Learning Areas, KG Skills, Grade
Bands, Remarks Bank, Report Templates, System). Every one of these is
fully editable data, not a hard-coded assumption in the software — a
school's actual curriculum, grading scale, and report wording always
takes precedence over any built-in default. New installations start
with a sensible default configuration (see `docs/DEPLOYMENT.md` Section
5) purely as a starting point to edit, not as a fixed template.

## 2. Academic Year Management

Create one **Academic Year** record per school year (e.g. "2025/2026"),
then create its three **Terms** underneath it, each with its own
vacation and reopening dates (both of which print on report cards).
Only one academic year and one term should normally be marked "current"
at a time — this is what the Dashboard and most day-to-day screens
default to showing. An academic year or term cannot be deleted once it
has any real data linked to it (enrollments, scores, reports, archives)
— this is a deliberate safeguard, not a bug; see Section 9.

## 3. Class Management

Under **Levels & Classes**, confirm the levels your school runs (KG1,
KG2, Basic 1-6, JHS 1-3 by default) and define the actual classes/
streams within each (e.g. more than one class per level, if your school
has parallel streams). A class's assessment mode (numeric scoring vs.
KG's qualitative skill-rating) is determined entirely by its level — you
never choose this per class.

## 4. Subject Configuration

Under **Settings → Subjects**, define which subjects apply to which
levels, and their display order on report cards (the "Sort Order"
field). A subject cannot be deleted once any score has been recorded
against it, for the same historical-integrity reason as academic years.

## 5. Grade Bands

Under **Settings → Grade Bands**, define your school's own scoring
scale (e.g. 80-100 = A, 70-79 = B, and so on) — a grade is always
looked up against whatever bands are configured here, never a number
built into the software. Grade bands can be scoped to one specific level
or left applicable to every scored level; a level-specific set, if one
exists, always takes priority over the general default for that level.
**Changing a grade band's thresholds immediately changes how every
existing (non-archived) report is graded the next time it's viewed or
regenerated** — grades are always calculated fresh from the raw scores,
never stored as a fixed value, so there is nothing to "re-save"
afterwards. Archived terms are unaffected, since they are locked (see
Section 9).

## 6. KG Learning Areas

Under **Settings → KG Learning Areas**, the Learning Areas used for KG1/
KG2 skill assessment are configured — these follow the official NaCCA
KG Assessment Tool by default, and can be scoped to KG1, KG2, or both.

## 7. Skills

Under **Settings → KG Skills**, the individual checklist skills within
each Learning Area are configured, including their official serial
number (as printed on the NaCCA form) and display order. Skill wording
can differ between KG1 and KG2 even within the same Learning Area, since
skills are scoped to one specific KG level.

## 8. Remarks Management

Under **Settings → Remarks Bank**, maintain a reusable bank of common
remark phrases (by category) that teachers can quickly select from when
entering class-teacher/headteacher remarks, rather than retyping common
phrases every term.

## 9. Data Maintenance

ACTRS enforces historical-integrity rules automatically, without
requiring manual maintenance:

- A record (academic year, term, class, subject, learning area, skill)
  cannot be deleted once real data depends on it — you'll see a clear
  message explaining what's still linked, rather than a silent failure
  or, worse, a silent deletion that orphans data.
- An **archived** term is locked against all edits — scores, remarks,
  and reports belonging to it are permanently protected. This is the
  primary "data maintenance" action an administrator takes: archiving a
  term once its reports are final, rather than leaving it open
  indefinitely.
- **System Logs** (a unified, filterable feed of backup/restore/import/
  export/archive activity plus the assessment audit trail) gives a full
  accountability record of who did what and when, useful for resolving
  any data question after the fact.

## 10. Backup Strategy

We recommend:

- A **Full Backup**, saved to a location separate from the computer
  ACTRS runs on (a USB drive, external drive, or network share), at a
  regular cadence — see `docs/MAINTENANCE_GUIDE.md` for a suggested
  schedule tied to your term calendar.
- An additional backup immediately **before** any major action: closing
  a term, running a bulk import, or restoring from an older backup.
- Keeping more than one backup generation rather than only the most
  recent — if a problem in the data isn't noticed immediately, having
  only the latest backup may mean backing up the same problem.

Backup format guidance: **JSON is the only format Restore actually
reads** — it's the complete, lossless format. Excel/CSV backup exports
exist purely for viewing outside ACTRS (e.g. sharing a read-only summary
with the Directorate); they cannot be restored from.

## 11. Disaster Recovery

See the dedicated **`docs/DISASTER_RECOVERY.md`** for full step-by-step
procedures. In summary: as long as a reasonably recent Full Backup
exists somewhere safe, any of the following are recoverable — a
corrupted browser profile, a lost/replaced computer, or accidental data
changes.

## 12. System Updates

Because ACTRS is configured with `registerType: "autoUpdate"`, once a
new build is deployed to the same address a school already uses, every
installed copy detects and downloads it automatically the next time it's
opened with a connection, then shows an "Update available" prompt — no
manual reinstallation is needed for a routine update. See
`docs/DEPLOYMENT.md` Section 6 and `docs/MAINTENANCE_GUIDE.md` for the
administrator's side of an update (deploying the new build) versus what
each individual installed copy does automatically (picking it up).
