import { db } from "@database/db";
import { DEFAULT_TEMPLATE_SETTINGS, type TemplateSettings } from "@models/TemplateSettings";

/** Module 12 - Report Customization settings. Singleton row, same
 *  pattern as `SettingsService` (system settings) - there is only ever
 *  one `TemplateSettings` record, so this does not extend
 *  BaseRepository's multi-row CRUD. The Dexie v5 migration already seeds
 *  this row from the school's prior `SystemSettings.report` values; `get()`
 *  still falls back to `DEFAULT_TEMPLATE_SETTINGS` defensively in case a
 *  fresh database is opened before that migration has ever run. */
class TemplateSettingsServiceImpl {
  async get(): Promise<TemplateSettings> {
    const row = await db.templateSettings.toCollection().first();
    return row ?? { ...DEFAULT_TEMPLATE_SETTINGS, id: undefined };
  }

  async save(values: Omit<TemplateSettings, "id" | "updatedAt">): Promise<void> {
    const now = new Date().toISOString();
    const existing = await db.templateSettings.toCollection().first();
    if (existing?.id) {
      await db.templateSettings.update(existing.id, { ...values, updatedAt: now });
    } else {
      await db.templateSettings.add({ ...values, updatedAt: now });
    }
  }
}

export const TemplateSettingsService = new TemplateSettingsServiceImpl();
