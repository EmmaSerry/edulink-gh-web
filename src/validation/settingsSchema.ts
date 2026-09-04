import { z } from "zod";
import { requiredString } from "./common";

export const systemSettingsSchema = z.object({
  general: z.object({
    applicationName: requiredString("Application name"),
    version: requiredString("Version"),
    defaultLanguage: requiredString("Default language"),
    dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  }),
  report: z.object({
    paperSize: z.enum(["A4", "Letter"]),
    orientation: z.enum(["Portrait", "Landscape"]),
    marginMm: z.number().min(5).max(50),
    fontFamily: requiredString("Font family"),
    fontSizePt: z.number().min(6).max(24),
  }),
  assessment: z.object({
    enableRanking: z.boolean(),
    autoCalculateTotals: z.boolean(),
    autoGeneratePositions: z.boolean(),
  }),
  backup: z.object({
    backupReminderEnabled: z.boolean(),
    autoBackupFrequencyDays: z.number().min(1).max(90),
    exportFormat: z.enum(["JSON", "XLSX"]),
  }),
});

export type SystemSettingsFormValues = z.infer<typeof systemSettingsSchema>;
