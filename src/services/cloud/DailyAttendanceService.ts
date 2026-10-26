import { rest } from "@/lib/supabaseClient";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceEntry {
  student_id: string;
  status: AttendanceStatus;
  note: string | null;
}

export interface AttendanceSaveRow {
  student_id: string;
  status: AttendanceStatus | "";
  note?: string;
}

export interface AttendanceSummaryRow {
  student_id: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
  days_marked: number;
}

export interface SchoolDayRow {
  class_id: string;
  class_name: string;
  enrolled: number;
  marked: number;
  present: number;
  absent: number;
}

/** Local calendar date as YYYY-MM-DD (not UTC, so Ghana evenings don't flip the day). */
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export const CloudDailyAttendanceService = {
  async getDay(classId: string, date: string): Promise<AttendanceEntry[]> {
    return rest.select<AttendanceEntry>("daily_attendance", {
      select: "student_id,status,note",
      filters: { class_id: `eq.${classId}`, attendance_date: `eq.${date}` },
    });
  },

  async saveDay(classId: string, termId: string, date: string, rows: AttendanceSaveRow[]): Promise<number> {
    return rest.rpc<number>("save_class_attendance", {
      p_class_id: classId,
      p_term_id: termId,
      p_date: date,
      p_rows: rows,
    });
  },

  async summary(classId: string, termId: string): Promise<AttendanceSummaryRow[]> {
    return rest.rpc<AttendanceSummaryRow[]>("class_attendance_summary", {
      p_class_id: classId,
      p_term_id: termId,
    });
  },

  async schoolDay(schoolId: string, termId: string, date: string): Promise<SchoolDayRow[]> {
    return rest.rpc<SchoolDayRow[]>("school_attendance_day", {
      p_school_id: schoolId,
      p_term_id: termId,
      p_date: date,
    });
  },
};
