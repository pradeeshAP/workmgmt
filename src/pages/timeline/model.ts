import { useMemo } from "react";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, SHIFTS, empCode, type Employee, type Shift } from "@/store/data";
import { computeDay, defaultShiftId, seedRecord, toTimelineRow, type AttRecord, type DayResult } from "@/lib/engine";
import type { TimelineRow } from "@/components/kit/ShiftTimeline";

export interface PersonDay {
  emp: Employee;
  key: string;
  date: string;
  shift: Shift | null;
  rec: AttRecord;
  res: DayResult;
  row: TimelineRow;
}

const EMPTY: AttRecord = { status: "unmarked", pairs: [], note: "", approveExtra: false };

export function recordFor(empId: string, date: string, shiftId: string | null, edited?: AttRecord): AttRecord {
  if (edited) return edited;
  const emp = EMPLOYEES.find((e) => e.id === empId);
  // an ad-hoc assignment has no seeded punches
  if (!shiftId || shiftId !== emp?.shiftId) return EMPTY;
  return seedRecord(empId, date);
}

export function shiftIdFor(empId: string, date: string, assignments: Record<string, string>): string | null {
  const key = `${empId}|${date}`;
  if (key in assignments) return assignments[key] || null;
  return defaultShiftId(empId, date);
}

export function useDayModel() {
  const filters = useApp((s) => s.filters);
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const { date, department, shift: shiftFilter, search } = filters;

  return useMemo(() => {
    const all: PersonDay[] = EMPLOYEES.map((emp) => {
      const key = `${emp.id}|${date}`;
      const sid = shiftIdFor(emp.id, date, assignments);
      const shift = SHIFTS.find((s) => s.id === sid) ?? null;
      const rec = recordFor(emp.id, date, sid, attendance[key]);
      const res = computeDay(shift, rec, permissions.filter((p) => p.employeeId === emp.id), date);
      return { emp, key, date, shift, rec, res, row: toTimelineRow(emp.id, emp.name, `${empCode(emp.id)} · ${emp.dept}`, shift, res, rec) };
    });
    const q = search.trim().toLowerCase();
    const people = all.filter(
      (p) =>
        (!department || p.emp.dept === department) &&
        (!shiftFilter || p.shift?.id === shiftFilter) &&
        (!q || p.emp.name.toLowerCase().includes(q))
    );
    return { all, people };
  }, [date, department, shiftFilter, search, permissions, attendance, assignments]);
}
