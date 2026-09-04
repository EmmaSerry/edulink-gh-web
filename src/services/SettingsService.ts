import { db } from "@database/db";
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from "@models/AppSettings";

const SETTINGS_KEY = "system";

/**
 * The system settings (Module 11) are a single JSON blob rather than a
 * full CRUD table - there is only ever one settings record, so this
 * service intentionally does not extend BaseRepository.
 */
class SettingsServiceImpl {
  async get(): Promise<SystemSettings> {
    const row = await db.settings.where("key").equals(SETTINGS_KEY).first();
    return (row?.value as SystemSettings) ?? DEFAULT_SYSTEM_SETTINGS;
  }

  async save(value: SystemSettings): Promise<void> {
    const now = new Date().toISOString();
    const row = await db.settings.where("key").equals(SETTINGS_KEY).first();
    if (row?.id) {
      await db.settings.update(row.id, { value, updatedAt: now });
    } else {
      await db.settings.add({ key: SETTINGS_KEY, value, updatedAt: now });
    }
  }
}

export const SettingsService = new SettingsServiceImpl();
