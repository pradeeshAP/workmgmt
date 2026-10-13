import { useMemo } from "react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, SHIFTS, TODAY, type Employee, type PermissionRequest, type Shift } from "@/store/data";
import { computeDay, dtToMin, lateEarlyOf, workingIntervals, type AttRecord, type DayResult, type Interval } from "@/lib/engine";
import { recordFor, shiftIdFor } from "@/pages/timeline/model";
import type { TimeAccount } from "@/components/kit/TimeAccountBar";
import type { Tone } from "@/components/kit/Status";

/** Minutes of late arrival or early departure that policy forgives before it counts as unexcused. */
export const GRACE_MIN = 10;
export const MAX_DAYS = 93;

/* ------------------------------ dates ------------------------------ */
export interface Scope {
  dates: string[];
  /** from and to are in order and span MAX_DAYS or fewer */
  valid: boolean;
  /** the range runs past the last day with records, which is left out */
  beyondToday: boolean;
}

export function rangeScope(from: string, to: string): Scope {
  const span = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  if (!(span >= 1 && span <= MAX_DAYS)) return { dates: [], valid: false, beyondToday: false };
  const dates: string[] = [];
  for (let i = 0; i < span; i++) {
    const d = format(addDays(parseISO(from), i), "yyyy-MM-dd");
    if (d <= TODAY) dates.push(d);
  }
  return { dates, valid: true, beyondToday: to > TODAY };
}

/* ------------------------------ one person, one shift date ------------------------------ */
export interface EmpDay {
  emp: Employee;
  date: string;
  key: string;
  shift: Shift | null;
  rec: AttRecord;
  res: DayResult;
  /** every request this person raised for the date, in any status */
  perms: PermissionRequest[];
  /** minutes from the shift start date's midnight */
  firstIn: number | null;
  /** null while a session is still open, or when nothing was punched */
  lastOut: number | null;
  sessions: number;
  /** uncovered minutes at the start and end of the shift that no approved request explains */
  late: number;
  early: number;
  /** all minutes of working time missed after the last check-out, covered or not */
  earlyTotal: number;
  /** approved permission, business duty and leave */
  away: number;
  provisional: boolean;
}

const clipLen = (a: Interval, b: Interval) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));

export function buildDay(
  emp: Employee,
  date: string,
  perms: PermissionRequest[],
  attendance: Record<string, AttRecord>,
  assignments: Record<string, string>
): EmpDay {
  const key = `${emp.id}|${date}`;
  const sid = shiftIdFor(emp.id, date, assignments);
  const shift = SHIFTS.find((s) => s.id === sid) ?? null;
  const rec = recordFor(emp.id, date, sid, attendance[key]);
  const mine = perms.filter((p) => p.employeeId === emp.id);
  const res = computeDay(shift, rec, mine, date);

  const ins: number[] = [];
  const outs: number[] = [];
  if (rec.status === "working") {
    for (const p of rec.pairs) {
      const a = dtToMin(p.in, date);
      if (a === null) continue;
      ins.push(a);
      const b = p.out ? dtToMin(p.out, date) : null;
      if (b !== null && b > a) outs.push(b);
    }
  }
  const open = res.openPunch !== undefined;
  const lastOut = !open && outs.length ? Math.max(...outs) : null;
  const { late, early } = shift ? lateEarlyOf(res.segments, shift, rec.status, res.openPunch) : { late: 0, early: 0 };
  const earlyTotal =
    shift && lastOut !== null && lastOut < shift.end
      ? workingIntervals(shift).reduce((n, w) => n + clipLen(w, { start: lastOut, end: shift.end }), 0)
      : 0;

  return {
    emp, date, key, shift, rec, res,
    perms: mine.filter((p) => p.date === date),
    firstIn: ins.length ? Math.min(...ins) : null,
    lastOut,
    sessions: rec.status === "working" ? rec.pairs.length : 0,
    late, early, earlyTotal,
    away: res.permission + res.duty,
    provisional: !!shift && (res.unresolved > 0 || res.pending.length > 0 || rec.status === "unmarked" || open),
  };
}

export function buildDays(
  emps: Employee[],
  dates: string[],
  permissions: PermissionRequest[],
  attendance: Record<string, AttRecord>,
  assignments: Record<string, string>
): EmpDay[] {
  const days: EmpDay[] = [];
  for (const emp of emps) {
    const mine = permissions.filter((p) => p.employeeId === emp.id);
    for (const date of dates) {
      const d = buildDay(emp, date, mine, attendance, assignments);
      if (d.shift) days.push(d);
    }
  }
  return days;
}

/* ------------------------------ totals ------------------------------ */
export interface Agg {
  shifts: number;
  leave: number;
  absent: number;
  required: number;
  work: number;
  /** approved personal permission and leave */
  permission: number;
  /** approved business duty */
  duty: number;
  /** of `permission`, the minutes that are approved full-day leave */
  leaveMin: number;
  gap: number;
  unresolved: number;
  extra: number;
  extraApproved: number;
  late: number;
  early: number;
  earlyTotal: number;
  /** days with an unmarked status or an open punch */
  missingDays: number;
  /** of `early`, the minutes beyond the grace period, summed per day */
  earlyAfterGrace: number;
  lateAfterGrace: number;
  /** work + permission + duty */
  covered: number;
  /** 0–100 */
  coverage: number;
  provisional: boolean;
}

export function aggregate(days: EmpDay[]): Agg {
  const a: Agg = {
    shifts: 0, leave: 0, absent: 0, required: 0, work: 0, permission: 0, duty: 0, leaveMin: 0, gap: 0, unresolved: 0,
    extra: 0, extraApproved: 0, late: 0, early: 0, earlyTotal: 0, missingDays: 0, earlyAfterGrace: 0, lateAfterGrace: 0,
    covered: 0, coverage: 0, provisional: false,
  };
  for (const d of days) {
    if (!d.shift) continue;
    a.shifts++;
    if (d.rec.status === "leave") { a.leave++; a.leaveMin += d.res.permission; }
    if (d.rec.status === "absent") a.absent++;
    a.required += d.res.required;
    a.work += d.res.work;
    a.permission += d.res.permission;
    a.duty += d.res.duty;
    a.gap += d.res.gap;
    a.unresolved += d.res.unresolved;
    a.extra += d.res.extra;
    if (d.rec.approveExtra) a.extraApproved += d.res.extra;
    a.late += d.late;
    a.early += d.early;
    a.earlyTotal += d.earlyTotal;
    a.lateAfterGrace += Math.max(0, d.late - GRACE_MIN);
    a.earlyAfterGrace += Math.max(0, d.early - GRACE_MIN);
    if (d.rec.status === "unmarked" || d.res.openPunch !== undefined) a.missingDays++;
    if (d.provisional) a.provisional = true;
  }
  a.covered = a.work + a.permission + a.duty;
  a.coverage = a.required ? Math.round((a.covered / a.required) * 100) : 0;
  return a;
}

export const toAccount = (a: Pick<Agg, "required" | "work" | "permission" | "duty" | "gap" | "unresolved">): TimeAccount => ({
  required: a.required, work: a.work, permission: a.permission, duty: a.duty, gap: a.gap, unresolved: a.unresolved,
});

export function groupBy<T>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const k = key(it);
    const list = m.get(k);
    if (list) list.push(it); else m.set(k, [it]);
  }
  return m;
}

/** What a day looks like in one phrase, and which colour family it belongs to. */
export function dayStatus(d: EmpDay): { label: string; tone: Tone } {
  if (!d.shift) return { label: "No shift", tone: "neutral" };
  const { rec, res } = d;
  if (rec.status === "leave") return { label: "Approved leave", tone: "permission" };
  if (rec.status === "absent") return { label: "Absent", tone: "gap" };
  if (rec.status === "unmarked") return { label: "Awaiting entry", tone: "neutral" };
  if (res.openPunch !== undefined) return { label: "Awaiting check-out", tone: "gap" };
  if (res.gap > 0) return { label: `${res.coverage}% covered`, tone: "gap" };
  if (res.pending.length) return { label: "Pending request", tone: "pending" };
  if (res.permission + res.duty > 0) return { label: "Covered by permission", tone: "permission" };
  return { label: "Reconciled", tone: "work" };
}

export const TONE_TEXT: Record<Tone, string> = {
  work: "text-work", permission: "text-permission", duty: "text-duty", gap: "text-gap", extra: "text-extra",
  brand: "text-brand", neutral: "text-muted", pending: "text-duty",
};

/** "H:MM" or an em dash for nothing. */
export const dashIfZero = (m: number, f: (m: number) => string) => (m > 0 ? f(m) : "—");

/* ------------------------------ the Reports scope ------------------------------ */
export function useReportScope() {
  const filters = useApp((s) => s.filters);
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const { from, to, department, shift, search } = filters;

  return useMemo(() => {
    const scope = rangeScope(from, to);
    const q = search.trim().toLowerCase();
    const people = EMPLOYEES.filter((e) => (!department || e.dept === department) && (!q || e.name.toLowerCase().includes(q)));
    const days = buildDays(people, scope.dates, permissions, attendance, assignments).filter((d) => !shift || d.shift?.id === shift);
    const employees = people.filter((e) => days.some((d) => d.emp.id === e.id));
    return { ...scope, people, employees, days };
  }, [from, to, department, shift, search, permissions, attendance, assignments]);
}

export type ReportScope = ReturnType<typeof useReportScope>;

/* ------------------------------ report rows ------------------------------ */
export interface EmpRow { emp: Employee; agg: Agg; days: EmpDay[] }

export function summaryRows(days: EmpDay[], employees: Employee[]): EmpRow[] {
  const by = groupBy(days, (d) => d.emp.id);
  return employees.map((emp) => {
    const mine = by.get(emp.id) ?? [];
    return { emp, agg: aggregate(mine), days: mine };
  });
}

export interface ShiftRow { shift: Shift; agg: Agg; people: number; /** share of all required minutes, 0–100 */ weight: number }

export function shiftRows(days: EmpDay[]): ShiftRow[] {
  const total = days.reduce((n, d) => n + d.res.required, 0);
  const by = groupBy(days, (d) => d.shift!.id);
  return SHIFTS.flatMap((shift) => {
    const mine = by.get(shift.id);
    if (!mine?.length) return [];
    const agg = aggregate(mine);
    return [{ shift, agg, people: new Set(mine.map((d) => d.emp.id)).size, weight: total ? (agg.required / total) * 100 : 0 }];
  });
}

/** Days that need a person to look at them, most serious first. */
export function exceptionDays(days: EmpDay[]): EmpDay[] {
  const worst = (d: EmpDay) => Math.max(0, ...d.res.issues.map((i) => i.severity));
  return days
    .filter((d) => d.res.issues.length > 0)
    .sort((a, b) => worst(b) - worst(a) || b.date.localeCompare(a.date) || a.emp.name.localeCompare(b.emp.name));
}

/** The flags worth showing next to an exception: the ones the engine raised an issue for. */
export function reviewFlags(d: EmpDay) {
  const kinds = new Set(d.res.issues.map((i) => i.kind));
  return d.res.flags.filter((f) => kinds.has(f.kind));
}
