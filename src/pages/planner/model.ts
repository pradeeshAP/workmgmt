import { useMemo } from "react";
import { addDays, format, parseISO } from "date-fns";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, SHIFTS, type Employee, type PermissionRequest, type Shift } from "@/store/data";
import { useTemplates } from "@/store/templates";
import { recordFor, shiftIdFor } from "@/pages/timeline/model";
import type { AttRecord } from "@/lib/engine";

export interface PlanCell {
  emp: Employee;
  date: string;
  shift: Shift | null;
  /** why the slot is locked, or null when it can still be changed */
  locked: string | null;
}

/**
 * A planned day is protected once real attendance exists for it: punches, a
 * recorded status (leave, absent …) or any permission request.
 */
export function lockReason(
  empId: string,
  date: string,
  shiftId: string | null,
  attendance: Record<string, AttRecord>,
  permissions: PermissionRequest[]
): string | null {
  if (!shiftId) return null;
  const rec = recordFor(empId, date, shiftId, attendance[`${empId}|${date}`]);
  const parts: string[] = [];
  if (rec.pairs.length > 0) parts.push("punches");
  if (rec.status !== "unmarked") parts.push("a recorded status");
  if (permissions.some((p) => p.employeeId === empId && p.date === date)) parts.push("permission history");
  return parts.length ? `Has ${parts.join(", ")}` : null;
}

export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, i) => format(addDays(parseISO(weekStart), i), "yyyy-MM-dd"));

export function usePlannerModel() {
  const filters = useApp((s) => s.filters);
  const assignments = useApp((s) => s.assignments);
  const attendance = useApp((s) => s.attendance);
  const permissions = useApp((s) => s.permissions);
  const templates = useTemplates((s) => s.templates);
  const { week, department, shift: shiftFilter, search } = filters;

  return useMemo(() => {
    const dates = weekDates(week);
    const q = search.trim().toLowerCase();
    const build = (emp: Employee): PlanCell[] =>
      dates.map((date) => {
        const sid = shiftIdFor(emp.id, date, assignments);
        return {
          emp,
          date,
          shift: SHIFTS.find((s) => s.id === sid) ?? null,
          locked: lockReason(emp.id, date, sid, attendance, permissions),
        };
      });

    const rows = EMPLOYEES.filter((e) => (!department || e.dept === department) && (!q || e.name.toLowerCase().includes(q)))
      .map((emp) => ({ emp, cells: build(emp) }))
      .filter((r) => !shiftFilter || r.cells.some((c) => c.shift?.id === shiftFilter));

    const counts = dates.map((_, i) => {
      const byShift: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        const s = r.cells[i].shift;
        if (s) { byShift[s.id] = (byShift[s.id] ?? 0) + 1; total++; }
      }
      return { byShift, total };
    });

    // archived templates only get a footer chip while the week still uses them
    const footerShifts = templates.filter((s) => !s.archived || counts.some((c) => c.byShift[s.id]));
    return { dates, rows, counts, footerShifts, planned: counts.reduce((n, c) => n + c.total, 0) };
  }, [week, department, shiftFilter, search, assignments, attendance, permissions, templates]);
}
