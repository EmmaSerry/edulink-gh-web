import { rest } from "@/lib/supabaseClient";

export type AttScope = "class" | "school" | "district";
export type AttPeriod = "day" | "week" | "month" | "term";

export interface PeriodRow {
  bucket: string;
  label: string;
  gender: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
}

export interface BreakdownRow {
  unit_id: string;
  unit_name: string;
  parent_name: string | null;
  m_learners: number;
  f_learners: number;
  m_present: number;
  m_late: number;
  m_absent: number;
  m_excused: number;
  f_present: number;
  f_late: number;
  f_absent: number;
  f_excused: number;
}

export interface RawRow {
  student_id: string;
  student_name: string;
  gender: string;
  attendance_date: string;
  status: string;
  note: string | null;
}

export interface Insights {
  overall: {
    marked: number;
    counted: number;
    late: number;
    m_marked: number;
    m_counted: number;
    f_marked: number;
    f_counted: number;
    learners: number;
    dates: number;
    classes: number;
  } | null;
  weekday: { dow: number; marked: number; counted: number }[];
  weekly: {
    wkstart: string;
    marked: number;
    counted: number;
    m_marked: number;
    m_counted: number;
    f_marked: number;
    f_counted: number;
  }[];
  chronic_count: number;
  chronic: { name: string; class: string; gender: string; rate: number; absent: number; marked: number }[];
  streaks: { name: string; class: string; gender: string }[];
  performance: { band: string; learners: number; avg_score: number }[];
}

export const CloudAttendanceReportService = {
  period(scope: AttScope, id: string, from: string, to: string, period: AttPeriod) {
    return rest.rpc<PeriodRow[]>("att_report", { p_scope: scope, p_id: id, p_from: from, p_to: to, p_period: period });
  },
  breakdown(scope: AttScope, id: string, from: string, to: string) {
    return rest.rpc<BreakdownRow[]>("att_breakdown", { p_scope: scope, p_id: id, p_from: from, p_to: to });
  },
  raw(classId: string, from: string, to: string) {
    return rest.rpc<RawRow[]>("att_raw", { p_class_id: classId, p_from: from, p_to: to });
  },
  insights(scope: AttScope, id: string, from: string, to: string) {
    return rest.rpc<Insights>("att_insights", { p_scope: scope, p_id: id, p_from: from, p_to: to });
  },
};

export function rate(counted: number, marked: number): number | null {
  return marked > 0 ? Math.round((counted / marked) * 1000) / 10 : null;
}

export function downloadCsv(filename: string, rows: (string | number | null)[][]): void {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
