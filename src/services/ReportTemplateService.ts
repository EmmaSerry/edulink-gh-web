import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { ReportTemplate, ReportTemplateCode } from "@models/ReportTemplate";

/**
 * Module 2 - Template Engine registry. `appliesToLevelIds` is the single
 * source of truth for "which template does this Level use" - the
 * rendering side (`src/reporting/templateRegistry.tsx`) and the
 * validation/snapshot side (`ReportDataService`) both call
 * `resolveTemplateCodeForLevel` instead of ever branching on a Level's
 * code/name string, so adding a new Level and pointing it at an existing
 * template (or building a brand new template code) never requires an
 * application-logic change - only a data change here.
 */
class ReportTemplateServiceImpl extends BaseRepository<ReportTemplate> {
  constructor() {
    super(db.reportTemplates);
  }

  async getByCode(code: ReportTemplateCode): Promise<ReportTemplate | undefined> {
    return db.reportTemplates.where("code").equals(code).first();
  }

  async resolveTemplateCodeForLevel(levelId: number): Promise<ReportTemplateCode | undefined> {
    const templates = await db.reportTemplates.filter((t) => t.isActive && t.appliesToLevelIds.includes(levelId)).toArray();
    return templates[0]?.code;
  }

  /** Administrator remapping (Module 2/12) - moves a level from whichever
   *  template it currently belongs to onto a different one. A level may
   *  only belong to one template at a time, so it is removed from every
   *  other template's list first. */
  async assignLevelToTemplate(levelId: number, templateCode: ReportTemplateCode): Promise<void> {
    const now = new Date().toISOString();
    await db.transaction("rw", db.reportTemplates, async () => {
      const all = await db.reportTemplates.toArray();
      for (const t of all) {
        const hasLevel = t.appliesToLevelIds.includes(levelId);
        const shouldHaveLevel = t.code === templateCode;
        if (hasLevel !== shouldHaveLevel) {
          const nextIds = shouldHaveLevel
            ? [...t.appliesToLevelIds, levelId]
            : t.appliesToLevelIds.filter((id) => id !== levelId);
          await db.reportTemplates.update(t.id!, { appliesToLevelIds: nextIds, updatedAt: now });
        }
      }
    });
  }
}

export const ReportTemplateService = new ReportTemplateServiceImpl();
