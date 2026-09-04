import Dexie, { type Table } from "dexie";
import type { School } from "@models/School";
import type { AcademicYear } from "@models/AcademicYear";
import type { Term } from "@models/Term";
import type { Level } from "@models/Level";
import type { GradeBand } from "@models/GradeBand";
import type { SchoolClass } from "@models/SchoolClass";
import type { Student } from "@models/Student";
import type { Guardian } from "@models/Guardian";
import type { Enrollment } from "@models/Enrollment";
import type { PromotionHistoryEntry } from "@models/PromotionHistory";
import type { StudentPhoto } from "@models/StudentPhoto";
import type { ImportLogEntry } from "@models/ImportLog";
import type { AssessmentSession } from "@models/AssessmentSession";
import type { AuditLogEntry } from "@models/AuditLog";
import type { Subject } from "@models/Subject";
import type { LearningArea } from "@models/LearningArea";
import type { Skill } from "@models/Skill";
import type { ScoreRecord, SkillAssessmentRecord } from "@models/AssessmentRecord";
import type { RemarksBankEntry } from "@models/RemarksBank";
import type { ReportRecord } from "@models/Report";
import type { AppSettings } from "@models/AppSettings";
import type { BackupHistoryEntry } from "@models/BackupHistory";
import type { ReportTemplate } from "@models/ReportTemplate";
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from "@models/TemplateSettings";
import type { GeneratedReport } from "@models/GeneratedReport";
import type { ReportVersionEntry } from "@models/ReportVersion";
import type { PrintLogEntry } from "@models/PrintLog";
import type { ExportLogEntry } from "@models/ExportLog";
import type { TermArchiveEntry } from "@models/Archive";
import type { SystemLogEntry } from "@models/SystemLog";
import type { DataExportHistoryEntry } from "@models/ExportHistory";
import type { DiagnosticsSnapshotEntry } from "@models/DiagnosticsSnapshot";
import type { PerformanceMetricEntry } from "@models/PerformanceMetric";

/**
 * ACTRS local database (IndexedDB via Dexie.js).
 *
 * DESIGN NOTES
 * ------------
 * 1. Every table has a numeric auto-increment primary key (`++id`) plus,
 *    where useful, a compound/unique index for lookups (e.g. one score
 *    per student+term+subject).
 * 2. This schema is intentionally normalized (School -> AcademicYear ->
 *    Term; Level -> Subject/LearningArea -> Skill; Student -> Enrollment
 *    -> Class/Level/Term) so that a curriculum change or a promotion is
 *    a data change, never a schema change.
 * 3. Schema changes belong to a NEW Dexie `.version(n)` block with an
 *    `.upgrade()` migration - never edit a shipped version in place.
 *    See docs/DATABASE.md for the migration playbook.
 */
export class ActrsDatabase extends Dexie {
  schools!: Table<School, number>;
  academicYears!: Table<AcademicYear, number>;
  terms!: Table<Term, number>;
  levels!: Table<Level, number>;
  gradeBands!: Table<GradeBand, number>;
  classes!: Table<SchoolClass, number>;
  students!: Table<Student, number>;
  guardians!: Table<Guardian, number>;
  enrollments!: Table<Enrollment, number>;
  promotionHistory!: Table<PromotionHistoryEntry, number>;
  studentPhotos!: Table<StudentPhoto, number>;
  importLogs!: Table<ImportLogEntry, number>;
  assessmentSessions!: Table<AssessmentSession, number>;
  auditLogs!: Table<AuditLogEntry, number>;
  subjects!: Table<Subject, number>;
  learningAreas!: Table<LearningArea, number>;
  skills!: Table<Skill, number>;
  scoreRecords!: Table<ScoreRecord, number>;
  skillAssessmentRecords!: Table<SkillAssessmentRecord, number>;
  remarksBank!: Table<RemarksBankEntry, number>;
  reportRecords!: Table<ReportRecord, number>;
  settings!: Table<AppSettings, number>;
  backupHistory!: Table<BackupHistoryEntry, number>;
  reportTemplates!: Table<ReportTemplate, number>;
  templateSettings!: Table<TemplateSettings, number>;
  generatedReports!: Table<GeneratedReport, number>;
  reportVersions!: Table<ReportVersionEntry, number>;
  printLogs!: Table<PrintLogEntry, number>;
  exportLogs!: Table<ExportLogEntry, number>;
  archives!: Table<TermArchiveEntry, number>;
  systemLogs!: Table<SystemLogEntry, number>;
  exportHistory!: Table<DataExportHistoryEntry, number>;
  diagnosticsSnapshots!: Table<DiagnosticsSnapshotEntry, number>;
  performanceMetrics!: Table<PerformanceMetricEntry, number>;

  constructor() {
    super("actrs-db");

    // ---- Version 1 (Phase 0 foundation schema) -------------------------
    this.version(1).stores({
      schools: "++id, name, circuit",
      academicYears: "++id, label, isActive",
      terms: "++id, academicYearId, termNumber, isActive, [academicYearId+termNumber]",
      levels: "++id, code, sortOrder",
      classes: "++id, levelId, code",
      students: "++id, studentCode, currentClassId, fullName, isActive",
      subjects: "++id, levelId, sortOrder",
      learningAreas: "++id, levelId, sortOrder",
      skills: "++id, learningAreaId, serialNumber",
      scoreRecords:
        "++id, studentId, termId, subjectId, [studentId+termId+subjectId]",
      skillAssessmentRecords:
        "++id, studentId, termId, skillId, [studentId+termId+skillId]",
      remarksBank: "++id, category",
      reportRecords: "++id, studentId, termId, [studentId+termId]",
      settings: "++id, &key",
      backupHistory: "++id, type, performedAt",
    });

    // ---- Version 2 (Phase 1 - System Configuration & Administration) ---
    this.version(2)
      .stores({
        schools: "++id, name, schoolCode, circuit, district, region",
        academicYears: "++id, label, isActive, isCurrent",
        terms: "++id, academicYearId, termNumber, isActive, [academicYearId+termNumber]",
        levels: "++id, code, sortOrder, isActive",
        gradeBands: "++id, levelId, sortOrder, isActive",
        classes: "++id, levelId, code, isActive",
        subjects: "++id, sortOrder, isActive, *levelIds",
        learningAreas: "++id, sortOrder, isActive, *levelIds",
        skills: "++id, learningAreaId, levelId, serialNumber, isActive, [learningAreaId+levelId]",
        remarksBank: "++id, category, sortOrder, isActive",
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();

        await tx.table("levels").toCollection().modify((level: any) => {
          if (level.isActive === undefined) level.isActive = true;
        });
        await tx.table("classes").toCollection().modify((cls: any) => {
          if (cls.isActive === undefined) cls.isActive = true;
        });
        await tx.table("remarksBank").toCollection().modify((entry: any) => {
          if (entry.sortOrder === undefined) entry.sortOrder = 0;
          if (entry.isActive === undefined) entry.isActive = true;
          if (entry.text === undefined && entry.phrase !== undefined) {
            entry.text = entry.phrase;
            delete entry.phrase;
          }
        });
        await tx.table("academicYears").toCollection().modify((year: any) => {
          if (year.isCurrent === undefined) year.isCurrent = false;
        });
        await tx.table("subjects").toCollection().modify((subj: any) => {
          if (!Array.isArray(subj.levelIds)) {
            subj.levelIds = subj.levelId !== undefined ? [subj.levelId] : [];
            delete subj.levelId;
          }
          if (subj.shortName === undefined) subj.shortName = subj.code ?? "";
          if (subj.isActive === undefined) subj.isActive = true;
        });
        await tx.table("learningAreas").toCollection().modify((area: any) => {
          if (!Array.isArray(area.levelIds)) {
            area.levelIds = area.levelId !== undefined ? [area.levelId] : [];
            delete area.levelId;
          }
          if (area.isActive === undefined) area.isActive = true;
        });
        await tx.table("skills").toCollection().modify((skill: any) => {
          if (skill.sortOrder === undefined) skill.sortOrder = skill.serialNumber ?? 0;
          if (skill.isActive === undefined) skill.isActive = true;
        });

        const levels = await tx.table("levels").toArray();
        for (const level of levels as any[]) {
          if (Array.isArray(level.gradeBands)) {
            for (const band of level.gradeBands) {
              await tx.table("gradeBands").add({
                levelId: null,
                minScore: band.minScore,
                maxScore: band.maxScore ?? 100,
                label: band.label,
                code: band.code,
                sortOrder: 0,
                isActive: true,
                createdAt: now,
                updatedAt: now,
              });
            }
            await tx.table("levels").update(level.id, { gradeBands: undefined });
          }
        }
      });

    // ---- Version 3 (Phase 2 - Student Management Module) ---------------
    // Changes vs v2:
    //  - students: completely re-keyed around the permanent `studentId`
    //    (unique) and `admissionNumber` (unique); `currentClassId` and
    //    `fullName` are REMOVED - current placement now lives in
    //    `enrollments` (see below), and name is split into
    //    firstName/middleName/lastName. `status` replaces `isActive` as
    //    the soft-delete mechanism (Module 1 Status Information).
    //  - guardians (new): one primary guardian per student, `studentId`
    //    indexed for the 1:1(ish) lookup.
    //  - enrollments (new): the Phase 2 owner-recommended entity - one
    //    row per student per term. `isCurrent` gives an O(1) "what class
    //    is this student in right now" lookup; `[termId+classId]` powers
    //    fast class-roster queries (Module 12 Class Lists); the unique
    //    compound `[studentId+termId]` enforces "one active class per
    //    academic term" (Module 3) at the index level.
    //  - promotionHistory (new): append-only, never updated in place.
    //  - studentPhotos (new): photo version history (Module 9).
    //  - importLogs (new): one row per bulk import run (Module 7).
    this.version(3)
      .stores({
        students:
          "++id, &studentId, &admissionNumber, emisNumber, lastName, firstName, gender, status, academicYearOfAdmissionId",
        guardians: "++id, studentId, phone",
        enrollments:
          "++id, studentId, academicYearId, termId, levelId, classId, isCurrent, status, [termId+classId], &[studentId+termId]",
        promotionHistory: "++id, studentId, academicYearId, toLevelId, toClassId",
        studentPhotos: "++id, studentId, uploadedAt",
        importLogs: "++id, importedAt",
      })
      .upgrade(async (tx) => {
        // Phase 0/1 never shipped a Students UI, so in practice this
        // table has no real-world rows to migrate. Defensively drop the
        // deprecated fields on any row that does exist (e.g. from manual
        // testing) rather than leaving stale data shapes behind.
        await tx
          .table("students")
          .toCollection()
          .modify((s: any) => {
            delete s.currentClassId;
            delete s.fullName;
            delete s.sex;
            delete s.parentGuardianName;
            delete s.parentGuardianPhone;
            delete s.gpsAddress;
            delete s.parentGuardianEmail;
            if (s.isActive !== undefined) {
              s.status = s.isActive ? "ACTIVE" : "WITHDRAWN";
              delete s.isActive;
            }
          });
      });

    // ---- Version 4 (Phase 3 - Assessment Management Module) ------------
    // New tables only - no changes to existing tables' shapes needed:
    //  - assessmentSessions: one row per (class, term); unique compound
    //    index enforces exactly one session per class+term. `status`
    //    indexed for the Dashboard's completed/pending/finalized counts.
    //  - auditLogs: append-only, indexed by session (to show a session's
    //    history) and by timestamp (for a chronological view).
    // ScoreRecord/SkillAssessmentRecord (Phase 0) and ReportRecord
    // (extended with new optional fields, no index changes) already had
    // everything the assessment engine needs.
    this.version(4).stores({
      assessmentSessions: "++id, classId, termId, status, &[classId+termId]",
      auditLogs: "++id, assessmentSessionId, performedAt, action",
    });

    // ---- Version 5 (Phase 4 - Report Card Generation & Printing) -------
    //  - reportTemplates: registry row per layout (KG/LOWER_PRIMARY/
    //    UPPER_PRIMARY/JHS); appliesToLevelIds is the editable mapping
    //    driving auto-selection - never a hard-coded level->template
    //    switch in the rendering code.
    //  - templateSettings: single settings row (paper size, margins,
    //    fonts, colours, watermark, signature titles) applied to every
    //    generated report - seeded from the existing
    //    SystemSettings.report values below so nothing resets.
    //  - generatedReports: one CURRENT row per [studentId+termId],
    //    holding the frozen ReportSnapshot used to reprint/re-export
    //    without recalculating (Module 13).
    //  - reportVersions: append-only history of every snapshot ever
    //    generated - never updated in place.
    //  - printLogs / exportLogs: append-only action logs backing the
    //    Module 13/14 print-count, export-count and "reports generated
    //    today" figures.
    this.version(5)
      .stores({
        reportTemplates: "++id, &code, assessmentMode, isActive, *appliesToLevelIds",
        templateSettings: "++id",
        generatedReports: "++id, studentId, termId, classId, &[studentId+termId]",
        reportVersions: "++id, studentId, termId, [studentId+termId], versionNumber",
        printLogs: "++id, studentId, termId, performedAt",
        exportLogs: "++id, studentId, termId, performedAt, scope",
      })
      .upgrade(async (tx) => {
        const now = new Date().toISOString();

        // Seed templateSettings from the pre-existing
        // SystemSettings.report section (Phase 1) so a school's already-
        // configured paper size/margins/font carries forward unchanged.
        const existingSettingsCount = await tx.table("templateSettings").count();
        if (existingSettingsCount === 0) {
          const systemSettingsRow = await tx.table("settings").where("key").equals("system").first();
          const report = systemSettingsRow?.value?.report;
          await tx.table("templateSettings").add({
            ...DEFAULT_TEMPLATE_SETTINGS,
            ...(report
              ? {
                  paperSize: report.paperSize ?? DEFAULT_TEMPLATE_SETTINGS.paperSize,
                  orientation: report.orientation ?? DEFAULT_TEMPLATE_SETTINGS.orientation,
                  marginMm: report.marginMm ?? DEFAULT_TEMPLATE_SETTINGS.marginMm,
                  fontFamily: report.fontFamily ?? DEFAULT_TEMPLATE_SETTINGS.fontFamily,
                  fontSizePt: report.fontSizePt ?? DEFAULT_TEMPLATE_SETTINGS.fontSizePt,
                }
              : {}),
            updatedAt: now,
          });
        }

        // Best-effort default template registry, matched against the
        // codes ACTRS's own seed.ts uses (KG1/KG2, BASIC1-6, JHS1-3). A
        // school that renamed or added levels can (re)assign them to a
        // template afterwards under Settings - Report Templates - this
        // seed only saves that step for the common case.
        const existingTemplateCount = await tx.table("reportTemplates").count();
        if (existingTemplateCount === 0) {
          const levels = await tx.table("levels").toArray();
          const idsByCode = (codes: string[]) =>
            levels.filter((l: any) => codes.includes(l.code)).map((l: any) => l.id);

          const templateDefs: Array<{
            code: string;
            name: string;
            assessmentMode: "scored" | "skill-checklist";
            codes: string[];
          }> = [
            { code: "KG", name: "KG Learner Report (NaCCA)", assessmentMode: "skill-checklist", codes: ["KG1", "KG2"] },
            { code: "LOWER_PRIMARY", name: "Lower Primary Report", assessmentMode: "scored", codes: ["BASIC1", "BASIC2", "BASIC3"] },
            { code: "UPPER_PRIMARY", name: "Upper Primary Report", assessmentMode: "scored", codes: ["BASIC4", "BASIC5", "BASIC6"] },
            { code: "JHS", name: "JHS Report", assessmentMode: "scored", codes: ["JHS1", "JHS2", "JHS3"] },
          ];

          for (const t of templateDefs) {
            await tx.table("reportTemplates").add({
              code: t.code,
              name: t.name,
              assessmentMode: t.assessmentMode,
              appliesToLevelIds: idsByCode(t.codes),
              componentVersion: 1,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      });

    // ---- Version 6 (Phase 5 - Records, Archives, Backup & Production
    //      Readiness) ----------------------------------------------------
    //  - archives: one row per archived (permanently closed) term. See
    //    Archive.ts / ArchiveService.ts for why this does NOT duplicate
    //    any student/assessment/report data into a second table.
    //  - systemLogs: general-purpose activity log (Module 6) for
    //    everything that doesn't belong to the Phase 3 `auditLogs` table
    //    (which stays exactly as it was - assessment-session scoped).
    //  - exportHistory: bulk export runs from the new Import & Export
    //    Centre (student lists/assessment sheets/statistics/config/
    //    archives) - distinct from Phase 4's per-report `exportLogs`.
    //  - diagnosticsSnapshots: history of manually-triggered "Run
    //    Diagnostics" checks (Module 7).
    //  - performanceMetrics: best-effort local timing samples (Module 8).
    //  - backupHistory: index list widened to add `scope` (full/partial)
    //    alongside the existing `type`/`performedAt` - the row shape
    //    itself was already widened additively in BackupHistory.ts.
    this.version(6).stores({
      archives: "++id, &termId, academicYearId, archivedAt",
      systemLogs: "++id, module, action, performedBy, performedAt",
      exportHistory: "++id, exportType, performedAt",
      diagnosticsSnapshots: "++id, recordedAt",
      performanceMetrics: "++id, metric, recordedAt",
      backupHistory: "++id, type, performedAt, scope",
    });

    // Version 7 - no schema/index changes, only a one-time data backfill.
    // "Levels & Classes" lets a school split a level into multiple named
    // sections (optional), but a school that had already created its
    // Levels under a previous version - and never visited that screen -
    // had zero Class rows to choose from, which silently blocked Student
    // Registration entirely (the Class field is mandatory and had no
    // options). New installs get one default class per level from
    // seedDefaultConfiguration(); this upgrade gives existing installs
    // the same default retroactively, without touching any class a
    // school may already have created itself.
    this.version(7)
      .stores({})
      .upgrade(async (tx) => {
        const existingClasses = await tx.table("classes").count();
        if (existingClasses > 0) return;
        const levels = await tx.table("levels").toArray();
        const now = new Date().toISOString();
        for (const level of levels as any[]) {
          await tx.table("classes").add({
            levelId: level.id,
            name: level.name,
            code: level.code,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          });
        }
      });

    // Version 8 - Admission Number and Admission Date are no longer
    // mandatory (some schools don't have either on hand at registration
    // time; Admission Number may eventually be auto-generated under
    // rules configured later). `admissionNumber` was a UNIQUE index
    // (`&admissionNumber`) - IndexedDB would throw a constraint error the
    // moment a second student was saved without one, since both would
    // index as the same empty value. Dropped to a regular (non-unique)
    // index, same treatment `emisNumber` already had; the application
    // still checks for duplicate admission numbers itself (see
    // studentSchema.ts) whenever one is actually provided.
    this.version(8).stores({
      students:
        "++id, &studentId, admissionNumber, emisNumber, lastName, firstName, gender, status, academicYearOfAdmissionId",
    });

    // Version 9 - no schema/index changes, only a one-time data backfill.
    // reportTemplates/templateSettings were only ever seeded by the
    // version(5) *upgrade* migration above, which only runs for a
    // database that actually transitions THROUGH version 5 - a database
    // created fresh (opened for the very first time, straight at
    // whatever the current schema version is - true of every genuinely
    // new installation) never runs that migration at all, so
    // reportTemplates stayed permanently empty. That is exactly what
    // made Settings - Report Templates' "Level -> Template assignment"
    // dropdown show nothing but "Unassigned", and would have made every
    // report generation fail with "no template mapped to this level".
    // seedDefaultConfiguration() (src/database/seed.ts) now also seeds
    // this for brand-new installs going forward; this migration is the
    // matching backfill for installs that already exist.
    this.version(9)
      .stores({})
      .upgrade(async (tx) => {
        const now = new Date().toISOString();

        const existingTemplateCount = await tx.table("reportTemplates").count();
        if (existingTemplateCount === 0) {
          const levels = await tx.table("levels").toArray();
          const idsByCode = (codes: string[]) =>
            levels.filter((l: any) => codes.includes(l.code)).map((l: any) => l.id);

          const templateDefs: Array<{
            code: string;
            name: string;
            assessmentMode: "scored" | "skill-checklist";
            codes: string[];
          }> = [
            { code: "KG", name: "KG Learner Report (NaCCA)", assessmentMode: "skill-checklist", codes: ["KG1", "KG2"] },
            { code: "LOWER_PRIMARY", name: "Lower Primary Report", assessmentMode: "scored", codes: ["BASIC1", "BASIC2", "BASIC3"] },
            { code: "UPPER_PRIMARY", name: "Upper Primary Report", assessmentMode: "scored", codes: ["BASIC4", "BASIC5", "BASIC6"] },
            { code: "JHS", name: "JHS Report", assessmentMode: "scored", codes: ["JHS1", "JHS2", "JHS3"] },
          ];

          for (const t of templateDefs) {
            await tx.table("reportTemplates").add({
              code: t.code,
              name: t.name,
              assessmentMode: t.assessmentMode,
              appliesToLevelIds: idsByCode(t.codes),
              componentVersion: 1,
              isActive: true,
              createdAt: now,
              updatedAt: now,
            });
          }
        }

        const existingSettingsCount = await tx.table("templateSettings").count();
        if (existingSettingsCount === 0) {
          await tx.table("templateSettings").add({
            paperSize: "A4",
            orientation: "Portrait",
            marginMm: 15,
            fontFamily: "Segoe UI",
            fontSizePt: 11,
            primaryColorHex: "#1f3864",
            secondaryColorHex: "#2f6fb0",
            showWatermark: false,
            watermarkOpacity: 0.08,
            signatureTitleClassTeacher: "Class Teacher",
            signatureTitleHeadTeacher: "Headteacher",
            batchPdfMode: "individual",
            updatedAt: now,
          });
        }
      });
  }
}

export const db = new ActrsDatabase();

/** Convenience helper used by health checks and the Dashboard. */
export async function getDatabaseSummary() {
  const [
    schools,
    academicYears,
    terms,
    activeTerm,
    levels,
    classes,
    subjects,
    learningAreas,
    skills,
    gradeBands,
    scoreRecords,
    skillAssessmentRecords,
    remarksBank,
    reportRecords,
    backupHistory,
    students,
    activeStudents,
  ] = await Promise.all([
    db.schools.count(),
    db.academicYears.count(),
    db.terms.count(),
    db.terms.filter((t) => t.isActive).count(),
    db.levels.count(),
    db.classes.count(),
    db.subjects.count(),
    db.learningAreas.count(),
    db.skills.count(),
    db.gradeBands.count(),
    db.scoreRecords.count(),
    db.skillAssessmentRecords.count(),
    db.remarksBank.count(),
    db.reportRecords.count(),
    db.backupHistory.count(),
    db.students.count(),
    db.students.where("status").equals("ACTIVE").count(),
  ]);

  return {
    schools,
    academicYears,
    terms,
    activeTerm,
    levels,
    classes,
    subjects,
    learningAreas,
    skills,
    gradeBands,
    scoreRecords,
    skillAssessmentRecords,
    remarksBank,
    reportRecords,
    backupHistory,
    students,
    activeStudents,
    inactiveStudents: students - activeStudents,
  };
}
