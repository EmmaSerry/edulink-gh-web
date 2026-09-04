import { db } from "./db";
import { DEFAULT_GRADE_BANDS } from "@models/GradeBand";
import { DEFAULT_SYSTEM_SETTINGS } from "@models/AppSettings";
import { DEFAULT_TEMPLATE_SETTINGS } from "@models/TemplateSettings";

/**
 * Default curriculum & system configuration, captured from:
 *  - The three existing Amenfi Central workbooks (Lower Primary, Upper
 *    Primary, JHS subject lists).
 *  - The official NaCCA "Kindergarten Assessment Tool - Learner's Report
 *    Form KG2" (learning areas & skills).
 *  - The GES 5-band grading scale.
 *
 * This is reference/configuration data only - every value seeded here is
 * fully editable afterwards through the Levels & Classes and Settings
 * screens (Modules 4-11). Calling `seedDefaultConfiguration()` is
 * idempotent: it no-ops if levels already exist.
 */
export async function seedDefaultConfiguration(): Promise<void> {
  const existing = await db.levels.count();
  if (existing > 0) return;

  const now = new Date().toISOString();

  // ---- Levels -------------------------------------------------------------
  const levelDefs: Array<{ code: string; name: string; assessmentMode: "scored" | "skill-checklist" }> = [
    { code: "KG1", name: "Kindergarten 1", assessmentMode: "skill-checklist" },
    { code: "KG2", name: "Kindergarten 2", assessmentMode: "skill-checklist" },
    { code: "BASIC1", name: "Basic 1", assessmentMode: "scored" },
    { code: "BASIC2", name: "Basic 2", assessmentMode: "scored" },
    { code: "BASIC3", name: "Basic 3", assessmentMode: "scored" },
    { code: "BASIC4", name: "Basic 4", assessmentMode: "scored" },
    { code: "BASIC5", name: "Basic 5", assessmentMode: "scored" },
    { code: "BASIC6", name: "Basic 6", assessmentMode: "scored" },
    { code: "JHS1", name: "JHS 1", assessmentMode: "scored" },
    { code: "JHS2", name: "JHS 2", assessmentMode: "scored" },
    { code: "JHS3", name: "JHS 3", assessmentMode: "scored" },
  ];

  const levelIdByCode: Record<string, number> = {};
  await db.transaction("rw", db.levels, async () => {
    for (const [i, lvl] of levelDefs.entries()) {
      const id = await db.levels.add({
        code: lvl.code,
        name: lvl.name,
        assessmentMode: lvl.assessmentMode,
        sortOrder: i + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      levelIdByCode[lvl.code] = id;
    }
  });

  const kgLevelIds = [levelIdByCode.KG1, levelIdByCode.KG2];
  const lowerPrimaryLevelIds = [levelIdByCode.BASIC1, levelIdByCode.BASIC2, levelIdByCode.BASIC3];
  const upperPrimaryLevelIds = [levelIdByCode.BASIC4, levelIdByCode.BASIC5, levelIdByCode.BASIC6];
  const jhsLevelIds = [levelIdByCode.JHS1, levelIdByCode.JHS2, levelIdByCode.JHS3];

  // ---- Default classes (one per level) -------------------------------------
  // "Levels & Classes" lets a school split a level into multiple named
  // sections/streams (e.g. "Basic 1 Gold", "Basic 1 Blue") for schools
  // that need it, but that is an optional customisation, not a
  // prerequisite - a school that hasn't touched that screen yet still
  // needs to be able to register a student on day one. Seeding exactly
  // one class per level, named identically to the level (e.g. "Basic
  // 1"), guarantees the Class field on Student Registration is never
  // empty out of the box; schools that do want streams can rename this
  // default or add more classes under the same level at any time.
  await db.transaction("rw", db.classes, async () => {
    for (const lvl of levelDefs) {
      const levelId = levelIdByCode[lvl.code];
      await db.classes.add({
        levelId,
        name: lvl.name,
        code: lvl.code,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  // ---- Grade bands (global defaults, Module 9) -----------------------------
  await Promise.all(
    DEFAULT_GRADE_BANDS.map((band) =>
      db.gradeBands.add({
        levelId: null,
        ...band,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );

  // ---- Subjects (scored levels, Module 6) ----------------------------------
  const subjectDefs: Array<{ name: string; code: string; levelIds: number[] }> = [
    { name: "Language & Literacy", code: "LL", levelIds: lowerPrimaryLevelIds },
    { name: "Numeracy", code: "NU", levelIds: lowerPrimaryLevelIds },
    { name: "Creative Arts", code: "CA", levelIds: lowerPrimaryLevelIds },
    { name: "English Language", code: "EN", levelIds: [...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "Mathematics", code: "MA", levelIds: [...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "Science", code: "SC", levelIds: [...lowerPrimaryLevelIds, ...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "Our World Our People", code: "OW", levelIds: upperPrimaryLevelIds },
    { name: "Religious & Moral Education", code: "RM", levelIds: [...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "History", code: "HI", levelIds: upperPrimaryLevelIds },
    { name: "Computing", code: "CO", levelIds: [...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "Ghanaian Language", code: "GH", levelIds: [...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "Creative Arts & Design", code: "CD", levelIds: [...upperPrimaryLevelIds, ...jhsLevelIds] },
    { name: "Social Studies", code: "SS", levelIds: jhsLevelIds },
    { name: "Career Technology", code: "CT", levelIds: jhsLevelIds },
  ];

  await Promise.all(
    subjectDefs.map((s, i) =>
      db.subjects.add({
        name: s.name,
        code: s.code,
        shortName: s.code,
        sortOrder: i + 1,
        levelIds: s.levelIds,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }),
    ),
  );

  // ---- KG Learning areas & skills (Modules 7 & 8, from the NaCCA form) -----
  const kgLearningAreas: Array<{ name: string; skills: string[] }> = [
    {
      name: "Language and Literacy",
      skills: [
        "Listens to and participates in songs and rhymes, and relates them to real life experiences",
        "Listens and follows instructions and directions for a variety of purposes",
        "Tells own story and talks about a favourite character",
        "Blends syllables to read words",
        "Extends a story heard",
        "Draws and labels pictures to communicate ideas",
        "Writes simple sentences",
      ],
    },
    {
      name: "Numeracy",
      skills: [
        "Describes positions and motions of objects in space using words like left, right, centre, up and down, etc.",
        "Measures the capacity and volume of two containers and tells the difference",
        "Compares objects according to their physical attributes (volume, capacity)",
        "Collects data, creates and interprets simple graphs (concrete and pictorial)",
      ],
    },
    {
      name: "Creative Arts",
      skills: [
        "Makes creative artworks such as festive cards, kites, etc.",
        "Creates an album using own artworks",
      ],
    },
    {
      name: "Our World and Our People",
      skills: [
        "Differentiates between living and non-living things (reproduction, breathing, life)",
        "Identifies and cares for domestic and wild animals",
        "Describes the various weather conditions in Ghana",
        "Explains how we connect with people in other parts of the world e.g., food, clothes, transport, money, sports",
        "Demonstrates understanding of how plants grow",
      ],
    },
    {
      name: "Socio-Emotional Learning",
      skills: [
        "Shares, cooperates, and plays well with others",
        "Expresses feelings appropriately and manage emotions",
        "Shows confidence and independence in activities",
        "Listens to and follow instructions",
        "Takes turns and waits for others to also do same in activities",
        "Participates in active plays like running, jumping, and balancing",
      ],
    },
  ];

  for (const [areaIndex, area] of kgLearningAreas.entries()) {
    const learningAreaId = await db.learningAreas.add({
      name: area.name,
      sortOrder: areaIndex + 1,
      levelIds: kgLevelIds,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    // Skills are seeded per KG level so KG1 and KG2 can diverge later
    // without restructuring anything - they start identical.
    for (const levelId of kgLevelIds) {
      await Promise.all(
        area.skills.map((description, i) =>
          db.skills.add({
            learningAreaId,
            levelId,
            serialNumber: i + 1,
            description,
            sortOrder: i + 1,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          }),
        ),
      );
    }
  }

  // ---- Remarks bank (Module 10) --------------------------------------------
  const remarksSeed: Array<{ category: import("@models/RemarksBank").RemarksCategory; texts: string[] }> = [
    {
      category: "INTEREST",
      texts: ["Reading", "Singing and Dancing", "Sports in General", "Drawing", "Drumming"],
    },
    {
      category: "CONDUCT",
      texts: ["Calm and Respectful", "Serious and very active in class", "Very disciplined and dresses neatly"],
    },
    {
      category: "ATTITUDE",
      texts: ["Satisfactory", "Quite Satisfactory", "Good"],
    },
    {
      category: "TEACHER_REMARKS",
      texts: [
        "Needs a lot of encouragement",
        "Should be more serious with academic work",
        "Should be encouraged to do more studies at home",
      ],
    },
    {
      category: "HEADTEACHER_REMARKS",
      texts: ["A commendable result", "Can do better with more effort", "Keep it up"],
    },
  ];

  for (const group of remarksSeed) {
    await Promise.all(
      group.texts.map((text, i) =>
        db.remarksBank.add({
          category: group.category,
          text,
          sortOrder: i + 1,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
  }

  // ---- Report templates (Module 2) & report appearance defaults
  //      (Module 12) --------------------------------------------------------
  // These previously only existed as a Dexie version(5) *upgrade*
  // migration, which only ever runs for a database that is being
  // upgraded FROM an earlier version - a database created fresh
  // (opened for the very first time, straight at the current schema
  // version, as every truly new installation is) never passes through
  // that migration at all, so `reportTemplates` stayed permanently
  // empty. That is exactly what made "Level -> Template assignment"
  // show nothing but "Unassigned" (there was nothing to assign, for
  // any level), and would have made every report generation fail with
  // "no template mapped to this level" - seeding it here as well
  // guarantees a fresh install gets it too, not just an upgraded one.
  const templateDefs: Array<{
    code: "KG" | "LOWER_PRIMARY" | "UPPER_PRIMARY" | "JHS";
    name: string;
    assessmentMode: "scored" | "skill-checklist";
    levelIds: number[];
  }> = [
    { code: "KG", name: "KG Learner Report (NaCCA)", assessmentMode: "skill-checklist", levelIds: kgLevelIds },
    { code: "LOWER_PRIMARY", name: "Lower Primary Report", assessmentMode: "scored", levelIds: lowerPrimaryLevelIds },
    { code: "UPPER_PRIMARY", name: "Upper Primary Report", assessmentMode: "scored", levelIds: upperPrimaryLevelIds },
    { code: "JHS", name: "JHS Report", assessmentMode: "scored", levelIds: jhsLevelIds },
  ];
  for (const t of templateDefs) {
    await db.reportTemplates.add({
      code: t.code,
      name: t.name,
      assessmentMode: t.assessmentMode,
      appliesToLevelIds: t.levelIds,
      componentVersion: 1,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db.templateSettings.add({
    ...DEFAULT_TEMPLATE_SETTINGS,
    updatedAt: now,
  });

  // ---- System settings (Module 11) -----------------------------------------
  await db.settings.add({
    key: "system",
    value: DEFAULT_SYSTEM_SETTINGS,
    updatedAt: now,
  });
}
