import * as XLSX from "xlsx";
import { db } from "@database/db";
import { SubjectService } from "./SubjectService";
import { LearningAreaService } from "./LearningAreaService";
import { SkillService } from "./SkillService";
import { RemarksBankService } from "./RemarksBankService";
import { SystemLogService } from "./SystemLogService";
import type { RemarksCategory } from "@models/RemarksBank";
import { downloadBlob } from "@utils/downloadBlob";

/**
 * Module 3 (Phase 5) - Import & Export Centre, the config-entity half.
 * Student import/export already existed (Phase 2's ImportService /
 * ExportService, reused as-is here); this file adds the same "parse ->
 * validate -> commit" shape for the four smaller configuration lists
 * the brief calls out by name (Subjects, Remarks, Learning Areas,
 * Skills), using plain case-insensitive header matching rather than
 * Phase 2's full drag-and-drop column mapper - these sheets are a
 * handful of columns each, so a fixed expected-header contract (shown
 * to the admin as a downloadable template) keeps this module small
 * without losing the preview/validation/error-reporting the brief asks
 * for.
 */
export type ConfigEntityKey = "subjects" | "learningAreas" | "skills" | "remarksBank";

export const CONFIG_ENTITY_LABELS: Record<ConfigEntityKey, string> = {
  subjects: "Subjects",
  learningAreas: "Learning Areas",
  skills: "Skills",
  remarksBank: "Remarks Bank",
};

export const CONFIG_ENTITY_TEMPLATE_HEADERS: Record<ConfigEntityKey, string[]> = {
  subjects: ["Name", "Code", "Short Name", "Level Codes", "Sort Order"],
  learningAreas: ["Name", "Level Codes", "Sort Order"],
  skills: ["Learning Area Name", "Level Code", "Serial Number", "Description", "Sort Order"],
  remarksBank: ["Category", "Text", "Sort Order"],
};

export interface ConfigValidatedRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ConfigValidationResult {
  validRows: ConfigValidatedRow[];
  invalidRows: ConfigValidatedRow[];
}

async function parseFile(file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  const headers = json.length > 0 ? Object.keys(json[0]) : [];
  return { headers, rows: json };
}

function findCell(row: Record<string, string>, header: string): string {
  const key = Object.keys(row).find((k) => k.trim().toLowerCase() === header.trim().toLowerCase());
  return key ? String(row[key] ?? "").trim() : "";
}

class ConfigImportExportServiceImpl {
  async parseFile(file: File) {
    return parseFile(file);
  }

  /** Validates every row for the given entity type against the
   *  currently-configured Levels (for Subjects/Learning Areas/Skills'
   *  Level Code column) and against the fixed Remarks category list. */
  async validateRows(entity: ConfigEntityKey, rows: Record<string, string>[]): Promise<ConfigValidationResult> {
    const levels = await db.levels.toArray();
    const learningAreas = entity === "skills" ? await db.learningAreas.toArray() : [];
    const validRows: ConfigValidatedRow[] = [];
    const invalidRows: ConfigValidatedRow[] = [];

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];
      const data: Record<string, string> = {};

      if (entity === "subjects" || entity === "learningAreas") {
        data.name = findCell(row, "Name");
        data.levelCodes = findCell(row, "Level Codes");
        data.sortOrder = findCell(row, "Sort Order");
        if (entity === "subjects") {
          data.code = findCell(row, "Code");
          data.shortName = findCell(row, "Short Name");
          if (!data.code) errors.push("Missing Code");
        }
        if (!data.name) errors.push("Missing Name");
        const codes = data.levelCodes.split(",").map((c) => c.trim()).filter(Boolean);
        if (codes.length === 0) errors.push("Missing Level Codes (comma-separated, e.g. \"BASIC1, BASIC2\")");
        else {
          const unknown = codes.filter((c) => !levels.some((l) => l.code.toLowerCase() === c.toLowerCase()));
          if (unknown.length > 0) errors.push(`Unknown level code(s): ${unknown.join(", ")}`);
        }
      } else if (entity === "skills") {
        data.learningAreaName = findCell(row, "Learning Area Name");
        data.levelCode = findCell(row, "Level Code");
        data.serialNumber = findCell(row, "Serial Number");
        data.description = findCell(row, "Description");
        data.sortOrder = findCell(row, "Sort Order");
        if (!data.learningAreaName) errors.push("Missing Learning Area Name");
        else if (!learningAreas.some((a) => a.name.toLowerCase() === data.learningAreaName.toLowerCase())) {
          errors.push(`Unknown Learning Area "${data.learningAreaName}"`);
        }
        if (!data.levelCode) errors.push("Missing Level Code");
        else if (!levels.some((l) => l.code.toLowerCase() === data.levelCode.toLowerCase())) {
          errors.push(`Unknown level code "${data.levelCode}"`);
        }
        if (!data.description) errors.push("Missing Description");
        if (data.serialNumber && Number.isNaN(Number(data.serialNumber))) errors.push("Serial Number must be a number");
      } else {
        data.category = findCell(row, "Category").toUpperCase();
        data.text = findCell(row, "Text");
        data.sortOrder = findCell(row, "Sort Order");
        const validCategories: RemarksCategory[] = ["CONDUCT", "INTEREST", "ATTITUDE", "TEACHER_REMARKS", "HEADTEACHER_REMARKS"];
        if (!validCategories.includes(data.category as RemarksCategory)) {
          errors.push(`Category must be one of: ${validCategories.join(", ")}`);
        }
        if (!data.text) errors.push("Missing Text");
      }

      const entry: ConfigValidatedRow = { rowNumber, data, errors };
      if (errors.length === 0) validRows.push(entry);
      else invalidRows.push(entry);
    });

    return { validRows, invalidRows };
  }

  async commitImport(entity: ConfigEntityKey, validRows: ConfigValidatedRow[], performedBy: string): Promise<number> {
    const now = new Date().toISOString();
    const levels = await db.levels.toArray();
    const learningAreas = entity === "skills" ? await db.learningAreas.toArray() : [];
    let successCount = 0;

    for (const row of validRows) {
      const d = row.data;
      if (entity === "subjects") {
        const levelIds = d.levelCodes.split(",").map((c) => c.trim()).filter(Boolean)
          .map((c) => levels.find((l) => l.code.toLowerCase() === c.toLowerCase())!.id!);
        await SubjectService.create({
          name: d.name,
          code: d.code,
          shortName: d.shortName || d.code,
          sortOrder: Number(d.sortOrder) || 0,
          levelIds,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (entity === "learningAreas") {
        const levelIds = d.levelCodes.split(",").map((c) => c.trim()).filter(Boolean)
          .map((c) => levels.find((l) => l.code.toLowerCase() === c.toLowerCase())!.id!);
        await LearningAreaService.create({
          name: d.name,
          sortOrder: Number(d.sortOrder) || 0,
          levelIds,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      } else if (entity === "skills") {
        const area = learningAreas.find((a) => a.name.toLowerCase() === d.learningAreaName.toLowerCase())!;
        const level = levels.find((l) => l.code.toLowerCase() === d.levelCode.toLowerCase())!;
        await SkillService.create({
          learningAreaId: area.id!,
          levelId: level.id!,
          serialNumber: Number(d.serialNumber) || 0,
          description: d.description,
          sortOrder: Number(d.sortOrder) || 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await RemarksBankService.create({
          category: d.category as RemarksCategory,
          text: d.text,
          sortOrder: Number(d.sortOrder) || 0,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      }
      successCount++;
    }

    await SystemLogService.record({
      module: "IMPORT",
      action: `${CONFIG_ENTITY_LABELS[entity]} imported`,
      performedBy,
      details: `${successCount} of ${validRows.length} row(s) imported.`,
    });

    return successCount;
  }

  /** Downloadable header-only template so an admin knows the exact
   *  expected column names before filling in a sheet. */
  downloadTemplate(entity: ConfigEntityKey) {
    const headers = CONFIG_ENTITY_TEMPLATE_HEADERS[entity];
    const sheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Template");
    const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
    downloadBlob(blob, `${entity}-import-template.xlsx`);
  }
}

export const ConfigImportExportService = new ConfigImportExportServiceImpl();
