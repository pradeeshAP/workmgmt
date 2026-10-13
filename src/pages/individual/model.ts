import { useMemo } from "react";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, type Employee } from "@/store/data";
import { dtToMin, permMinutes, workingIntervals, type Interval } from "@/lib/engine";
import { fmtClock } from "@/lib/utils";
import { analyze, permType, type PermRow } from "@/pages/permissions/model";
import { aggregate, buildDay, buildDays, rangeScope, type EmpDay } from "@/pages/reports/model";

export const DEFAULT_PERSON = "e2";

const len = (a: Interval) => Math.max(0, a.end - a.start);
const overlap = (a: Interval, b: Interval) => Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
const workingIn = (day: EmpDay, iv: Interval) => (day.shift ? workingIntervals(day.shift).reduce((n, w) => n + overlap(w, iv), 0) : 0);

/* ------------------------------ punch evidence ------------------------------ */
export interface Evidence {
  kind: "away" | "present" | "none";
  /** "Out 10:00 → In 13:00" */
  label: string;
  /** minutes the punches show the person away */
  away: number;
  /** working minutes away outside the requested window */
  beyond: number;
}

/** What the punches say about the time a request covers. */
export function punchEvidence(day: EmpDay, win: Interval): Evidence {
  const { shift, rec } = day;
  if (!shift) return { kind: "none", label: "No shift on this date", away: 0, beyond: 0 };
  if (rec.status === "leave") return { kind: "none", label: "Approved leave day", away: 0, beyond: 0 };
  if (rec.status === "absent") return { kind: "none", label: "Marked absent", away: 0, beyond: 0 };
  if (rec.status === "unmarked") return { kind: "none", label: "No punches recorded", away: 0, beyond: 0 };

  const present: Interval[] = [];
  let open = false;
  for (const p of rec.pairs) {
    const a = dtToMin(p.in, day.date);
    if (a === null) continue;
    const b = p.out ? dtToMin(p.out, day.date) : null;
    if (b === null) { open = true; present.push({ start: a, end: shift.end }); } else if (b > a) present.push({ start: a, end: b });
  }
  present.sort((x, y) => x.start - y.start);

  const away: { iv: Interval; label: string }[] = [];
  if (present.length === 0) away.push({ iv: { start: shift.start, end: shift.end }, label: "No punches" });
  else {
    if (present[0].start > shift.start) away.push({ iv: { start: shift.start, end: present[0].start }, label: `Shift start → In ${fmtClock(present[0].start)}` });
    for (let i = 0; i < present.length - 1; i++) {
      if (present[i + 1].start > present[i].end) away.push({ iv: { start: present[i].end, end: present[i + 1].start }, label: `Out ${fmtClock(present[i].end)} → In ${fmtClock(present[i + 1].start)}` });
    }
    const last = present[present.length - 1];
    if (!open && last.end < shift.end) away.push({ iv: { start: last.end, end: shift.end }, label: `Out ${fmtClock(last.end)} → shift end` });
  }

  const best = away.map((a) => ({ ...a, o: overlap(a.iv, win) })).filter((a) => a.o > 0).sort((a, b) => b.o - a.o)[0];
  if (!best) return { kind: "present", label: "Punched in throughout", away: 0, beyond: 0 };
  const inside = { start: Math.max(best.iv.start, win.start), end: Math.min(best.iv.end, win.end) };
  return { kind: "away", label: best.label, away: len(best.iv), beyond: Math.max(0, workingIn(day, best.iv) - workingIn(day, inside)) };
}

/* ------------------------------ time-away entries ------------------------------ */
export interface AwayRow extends PermRow {
  evidence: Evidence;
  /** minutes of the window that fall inside working hours, the break excluded */
  working: number;
  windowMin: number;
}

export interface PersonReport {
  emp: Employee;
  /** shift dates in range with a shift, oldest first */
  days: EmpDay[];
  agg: ReturnType<typeof aggregate>;
  away: AwayRow[];
  valid: boolean;
  beyondToday: boolean;
  dates: string[];
}

export function usePersonReport(empId: string): PersonReport {
  const from = useApp((s) => s.filters.from);
  const to = useApp((s) => s.filters.to);
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);

  return useMemo(() => {
    const emp = EMPLOYEES.find((e) => e.id === empId) ?? EMPLOYEES[0];
    const scope = rangeScope(from, to);
    const days = buildDays([emp], scope.dates, permissions, attendance, assignments);
    const byDate = new Map(days.map((d) => [d.date, d]));

    const away: AwayRow[] = scope.valid
      ? permissions
          .filter((p) => p.employeeId === emp.id && p.date >= from && p.date <= to && p.status !== "cancelled")
          .map((req) => {
            const day = byDate.get(req.date) ?? buildDay(emp, req.date, permissions, attendance, assignments);
            const credit = analyze(req, day.shift, day.rec, req.date);
            return {
              req, emp, shift: day.shift, rec: day.rec, type: permType(req, day.shift), credit,
              evidence: punchEvidence(day, permMinutes(req)),
              working: credit.requested - credit.outside,
              windowMin: credit.requested,
            };
          })
          .sort((a, b) => b.req.date.localeCompare(a.req.date) || permMinutes(b.req).start - permMinutes(a.req).start)
      : [];

    return { emp, days, agg: aggregate(days), away, valid: scope.valid, beyondToday: scope.beyondToday, dates: scope.dates };
  }, [empId, from, to, permissions, attendance, assignments]);
}
