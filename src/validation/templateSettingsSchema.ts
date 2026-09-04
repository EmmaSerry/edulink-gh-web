import { z } from "zod";
import { requiredString } from "./common";

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "Enter a hex colour like #1F3864");

export const templateSettingsSchema = z.object({
  paperSize: z.enum(["A4", "Letter"]),
  orientation: z.enum(["Portrait", "Landscape"]),
  marginMm: z.number({ invalid_type_error: "Margins must be a number" }).min(5, "Margins must be at least 5mm").max(50, "That looks too large"),
  fontFamily: requiredString("Font family"),
  fontSizePt: z.number({ invalid_type_error: "Font size must be a number" }).min(8, "Too small to print legibly").max(16, "That looks too large"),
  primaryColorHex: hexColor,
  secondaryColorHex: hexColor,
  showWatermark: z.boolean(),
  watermarkOpacity: z.number().min(0.02, "Too faint to be a watermark").max(0.4, "That would obscure the report text"),
  signatureTitleClassTeacher: requiredString("Class teacher signature title"),
  signatureTitleHeadTeacher: requiredString("Headteacher signature title"),
  batchPdfMode: z.enum(["single", "individual"]),
});

export type TemplateSettingsFormValues = z.infer<typeof templateSettingsSchema>;
