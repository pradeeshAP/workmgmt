import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { EMPLOYEES, TODAY, type Employee } from "@/store/data";
import { classicDay, type ClassicDay, type Ctx } from "@/pages/register/model";

export const METHOD = "Rate = (Present + ½ × Half-day) ÷ (Scheduled − Leave). Weekly offs, holidays and days still to come are not scheduled.";

export interface EmpMonth {
  emp: Employee;
  days: ClassicDay[];
  scheduled: number;
  P: number; HD: number; L: number; A: number; U: number;
  late: number;
  missing: number;
  /** minutes */
  worked: number;
  /** null when there is nothing to rate yet */
  rate: number | null;
}

export interface Totals {
  scheduled: number; P: number; HD: number; L: number; A: number; U: number; late: number; missing: number; worked: number;
  credit: number;
  rate: number | null;
}

/** Rate = (Present + ½ × Half-day) ÷ (Scheduled − Leave), as a whole percentage. */
export const rateOf = (p: number, hd: number, scheduled: number, leave: number): number | null => {
  const base = scheduled - leave;
  return base > 0 ? Math.round(((p + hd / 2) / base) * 100) : null;
};

export function monthDates(month: string): string[] {
  const start = startOfMonth(parseISO(`${month}-01`));
  return eachDayOfInterval({ start, end: endOfMonth(start) }).map((d) => format(d, "yyyy-MM-dd"));
}

export function buildMonth(ctx: Ctx, month: string, department: string, search: string) {
  const dates = monthDates(month);
  const q = search.trim().toLowerCase();
  const people = EMPLOYEES.filter((e) => (!department || e.dept === department) && (!q || e.name.toLowerCase().includes(q)));
  const rows: EmpMonth[] = people.map((emp) => {
    const days = dates.map((d) => classicDay(ctx, emp, d));
    const n = (c: string) => days.filter((d) => d.code === c).length;
    const P = n("P"), HD = n("HD"), L = n("L"), A = n("A"), U = n("U");
    const scheduled = P + HD + L + A + U;
    return {
      emp, days, scheduled, P, HD, L, A, U,
      late: days.filter((d) => d.late > 0).length,
      missing: days.filter((d) => d.review?.kind === "missing").length,
      worked: days.reduce((m, d) => m + (d.hours ?? 0), 0),
      rate: rateOf(P, HD, scheduled, L),
    };
  });
  const sum = (f: (r: EmpMonth) => number) => rows.reduce((m, r) => m + f(r), 0);
  const t = { scheduled: sum((r) => r.scheduled), P: sum((r) => r.P), HD: sum((r) => r.HD), L: sum((r) => r.L), A: sum((r) => r.A), U: sum((r) => r.U), late: sum((r) => r.late), missing: sum((r) => r.missing), worked: sum((r) => r.worked) };
  const totals: Totals = { ...t, credit: t.P + t.HD / 2, rate: rateOf(t.P, t.HD, t.scheduled, t.L) };
  const ended = TODAY > dates[dates.length - 1];
  return { dates, rows, totals, ended };
}

export type Month = ReturnType<typeof buildMonth>;

export interface DeptRate { dept: string; people: number; rate: number | null; scheduled: number }
export function byDepartment(rows: EmpMonth[]): DeptRate[] {
  const names = Array.from(new Set(rows.map((r) => r.emp.dept)));
  return names.map((dept) => {
    const rs = rows.filter((r) => r.emp.dept === dept);
    const s = (f: (r: EmpMonth) => number) => rs.reduce((m, r) => m + f(r), 0);
    return { dept, people: rs.length, scheduled: s((r) => r.scheduled), rate: rateOf(s((r) => r.P), s((r) => r.HD), s((r) => r.scheduled), s((r) => r.L)) };
  });
}

export interface Check { label: string; pass: boolean; detail: string }
export function checklist(m: Month): Check[] {
  const { totals, ended, rows } = m;
  const unassigned = rows.filter((r) => r.emp.dept === "Unassigned").length;
  return [
    { label: "Every working day is marked", pass: totals.U === 0, detail: totals.U === 0 ? "No unmarked days." : `${totals.U} unmarked ${totals.U === 1 ? "day" : "days"} to resolve.` },
    { label: "No missing punches", pass: totals.missing === 0, detail: totals.missing === 0 ? "Every present day has a check-in and check-out." : `${totals.missing} ${totals.missing === 1 ? "day is" : "days are"} missing a punch.` },
    { label: "The reporting month has ended", pass: ended, detail: ended ? "All working days are in the past." : "Days still to come are not counted yet." },
    { label: "Everyone belongs to a department", pass: unassigned === 0, detail: unassigned === 0 ? "Department totals include every employee." : `${unassigned} without a department.` },
  ];
}
