import { db } from "@database/db";
import { SettingsService } from "./SettingsService";

/**
 * Generates the student's PERMANENT ID (Module 10). Requirements from
 * the brief:
 *  - automatically generated, human-readable, configurable prefix
 *  - never changes once assigned
 *  - unique across all academic years
 *  - never reused
 *
 * Implementation: a single monotonic counter (`SystemSettings.studentId.
 * nextSequence`) that only ever increases, regardless of academic year -
 * this trivially satisfies "unique across all years" and "never reused"
 * without needing per-year counters that could collide on rollover. The
 * counter increment and the settings write happen inside one Dexie
 * transaction so two concurrent registrations can never be handed the
 * same number.
 *
 * Format (example): `ACTRS-2026-000001`
 *   - prefix: configurable (default "ACTRS")
 *   - year: the calendar year the ID was generated (cosmetic only -
 *     changing it later has no effect on uniqueness, which comes purely
 *     from the sequence)
 *   - sequence: zero-padded to `sequenceDigits` (default 6)
 */
class StudentIdServiceImpl {
  async generateNext(): Promise<string> {
    return db.transaction("rw", db.settings, async () => {
      const settings = await SettingsService.get();
      const { prefix, includeYear, sequenceDigits, nextSequence } = settings.studentId;

      const sequence = nextSequence;
      const padded = String(sequence).padStart(sequenceDigits, "0");
      const year = new Date().getFullYear();
      const id = includeYear ? `${prefix}-${year}-${padded}` : `${prefix}-${padded}`;

      await SettingsService.save({
        ...settings,
        studentId: { ...settings.studentId, nextSequence: sequence + 1 },
      });

      return id;
    });
  }
}

export const StudentIdService = new StudentIdServiceImpl();
