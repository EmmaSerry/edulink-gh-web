import { db } from "@database/db";
import { getFullName } from "@models/Student";
import { recordPerformanceMetric } from "./PerformanceMetricService";

/**
 * Module 5 (Phase 5) - System-wide search. Reads directly from Dexie
 * (no separate search index table - see file header of AnalyticsService
 * for the same reasoning: a few thousand rows scanned in memory is fast
 * enough client-side, and a persisted index would just be a second
 * place for data to go stale). Results are capped per category and
 * grouped, per the brief's "grouped by category" requirement.
 */
export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  path: string;
}

export interface SearchResultGroup {
  category: string;
  items: SearchResultItem[];
}

const MAX_PER_CATEGORY = 6;

function matches(haystack: string | undefined | null, needle: string): boolean {
  return !!haystack && haystack.toLowerCase().includes(needle);
}

class GlobalSearchServiceImpl {
  async search(rawQuery: string): Promise<SearchResultGroup[]> {
    const startedAt = performance.now();
    const query = rawQuery.trim().toLowerCase();
    if (query.length < 2) return [];

    const [
      students,
      classes,
      years,
      terms,
      subjects,
      skills,
      remarksBank,
      assessmentSessions,
      generatedReports,
    ] = await Promise.all([
      db.students.toArray(),
      db.classes.toArray(),
      db.academicYears.toArray(),
      db.terms.toArray(),
      db.subjects.toArray(),
      db.skills.toArray(),
      db.remarksBank.toArray(),
      db.assessmentSessions.toArray(),
      db.generatedReports.toArray(),
    ]);

    const groups: SearchResultGroup[] = [];

    const studentItems: SearchResultItem[] = students
      .filter((s) => matches(getFullName(s), query) || matches(s.studentId, query) || matches(s.admissionNumber ?? "", query))
      .slice(0, MAX_PER_CATEGORY)
      .map((s) => ({ id: `student-${s.id}`, title: getFullName(s), subtitle: s.studentId, path: `/students/${s.id}` }));
    if (studentItems.length > 0) groups.push({ category: "Students", items: studentItems });

    const classItems: SearchResultItem[] = classes
      .filter((c) => matches(c.name, query) || matches(c.code, query))
      .slice(0, MAX_PER_CATEGORY)
      .map((c) => ({ id: `class-${c.id}`, title: c.name, subtitle: c.code, path: "/levels-classes" }));
    if (classItems.length > 0) groups.push({ category: "Classes", items: classItems });

    const yearItems: SearchResultItem[] = years
      .filter((y) => matches(y.label, query))
      .slice(0, MAX_PER_CATEGORY)
      .map((y) => ({ id: `year-${y.id}`, title: y.label, subtitle: y.isCurrent ? "Current" : undefined, path: "/academic-years" }));
    if (yearItems.length > 0) groups.push({ category: "Academic Years", items: yearItems });

    const termItems: SearchResultItem[] = terms
      .filter((t) => matches(t.termName, query))
      .slice(0, MAX_PER_CATEGORY)
      .map((t) => ({ id: `term-${t.id}`, title: t.termName, subtitle: t.isActive ? "Active" : undefined, path: "/terms" }));
    if (termItems.length > 0) groups.push({ category: "Terms", items: termItems });

    const subjectItems: SearchResultItem[] = subjects
      .filter((s) => matches(s.name, query) || matches(s.code, query))
      .slice(0, MAX_PER_CATEGORY)
      .map((s) => ({ id: `subject-${s.id}`, title: s.name, subtitle: s.code, path: "/settings?tab=subjects" }));
    if (subjectItems.length > 0) groups.push({ category: "Subjects", items: subjectItems });

    const skillItems: SearchResultItem[] = skills
      .filter((s) => matches(s.description, query))
      .slice(0, MAX_PER_CATEGORY)
      .map((s) => ({ id: `skill-${s.id}`, title: s.description, subtitle: `S/N ${s.serialNumber}`, path: "/settings?tab=skills" }));
    if (skillItems.length > 0) groups.push({ category: "Skills", items: skillItems });

    const remarksItems: SearchResultItem[] = remarksBank
      .filter((r) => matches(r.text, query))
      .slice(0, MAX_PER_CATEGORY)
      .map((r) => ({ id: `remark-${r.id}`, title: r.text, subtitle: r.category, path: "/settings?tab=remarks" }));
    if (remarksItems.length > 0) groups.push({ category: "Remarks", items: remarksItems });

    const assessmentItems: SearchResultItem[] = assessmentSessions
      .filter((session) => {
        const cls = classes.find((c) => c.id === session.classId);
        return matches(cls?.name, query);
      })
      .slice(0, MAX_PER_CATEGORY)
      .map((session) => {
        const cls = classes.find((c) => c.id === session.classId);
        return {
          id: `assessment-${session.id}`,
          title: `${cls?.name ?? "Class"} assessment`,
          subtitle: session.status,
          path: `/assessments/${session.classId}`,
        };
      });
    if (assessmentItems.length > 0) groups.push({ category: "Assessments", items: assessmentItems });

    const reportItems: SearchResultItem[] = generatedReports
      .filter((r) => {
        const student = students.find((s) => s.id === r.studentId);
        return matches(student ? getFullName(student) : "", query);
      })
      .slice(0, MAX_PER_CATEGORY)
      .map((r) => {
        const student = students.find((s) => s.id === r.studentId);
        return {
          id: `report-${r.id}`,
          title: `${student ? getFullName(student) : "Report"} - report card`,
          subtitle: `v${r.versionNumber}`,
          path: `/report-cards/preview?mode=live&classId=${r.classId}&termId=${r.termId}&studentIds=${r.studentId}`,
        };
      });
    if (reportItems.length > 0) groups.push({ category: "Reports", items: reportItems });

    void recordPerformanceMetric("GLOBAL_SEARCH_MS", performance.now() - startedAt, `"${rawQuery}"`);
    return groups;
  }
}

export const GlobalSearchService = new GlobalSearchServiceImpl();
