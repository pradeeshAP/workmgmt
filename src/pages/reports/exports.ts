import { format, parseISO } from "date-fns";
import { fmtClock } from "@/lib/utils";
import { empCode, SHIFTS, type PermissionRequest } from "@/store/data";
import { permMinutes } from "@/lib/engine";
import type { PermRow } from "@/pages/permissions/model";
import { reviewFlags, type EmpDay, type EmpRow } from "./model";
import { FLAGS } from "@/components/kit/Status";

export const clock = (m: number | null, open = "") => (m === null ? open : fmtClock(m));
export const dayLabel = (date: string) => format(parseISO(date), "EEE dd MMM yyyy");

export function summaryCsv(rows: EmpRow[]): (string | number)[][] {
  return [
    ["Employee", "ID", "Department", "Shifts", "Leave days", "Absent days", "Required (min)", "Work in shift (min)", "Permission and leave (min)", "Business duty (min)", "Uncovered, known gaps (min)", "Unresolved (min)", "Late, unexcused (min)", "Early, unexcused (min)", "Extra time (min)", "Extra approved (min)", "Coverage (%)", "Status"],
    ...rows.map(({ emp, agg: a }) => [
      emp.name, empCode(emp.id), emp.dept, a.shifts, a.leave, a.absent, a.required, a.work, a.permission, a.duty, a.gap, a.unresolved,
      a.late, a.early, a.extra, a.extraApproved, a.coverage, a.provisional ? "Provisional" : "Reconciled",
    ]),
  ];
}

export function exceptionsCsv(days: EmpDay[]): (string | number)[][] {
  return [
    ["Employee", "ID", "Shift date", "Shift", "Assigned window", "First in", "Last out", "Worked (min)", "Required (min)", "Permission and duty (min)", "Uncovered (min)", "Unresolved (min)", "Review"],
    ...days.map((d) => [
      d.emp.name, empCode(d.emp.id), d.date, d.shift?.name ?? "", d.shift ? `${fmtClock(d.shift.start)} - ${fmtClock(d.shift.end)}` : "",
      clock(d.firstIn), d.res.openPunch !== undefined ? "Still open" : clock(d.lastOut),
      d.res.work, d.res.required, d.away, d.res.gap, d.res.unresolved,
      reviewFlags(d).map((f) => FLAGS[f.kind].label + (f.detail ? ` ${f.detail}` : "")).join("; "),
    ]),
  ];
}

export function auditCsv(rows: PermRow[]): (string | number)[][] {
  return [
    ["Employee", "ID", "Shift date", "Shift", "Type", "Window from", "Window to", "Requested (min)", "Credited (min)", "Reason", "Purpose", "Destination", "Task", "Decision", "Reviewer", "Decided at"],
    ...rows.map(({ req, emp, shift, type, credit }) => {
      const w = permMinutes(req as PermissionRequest);
      return [
        emp.name, empCode(emp.id), req.date, shift?.name ?? SHIFTS.find((s) => s.id === emp.shiftId)?.name ?? "", type,
        fmtClock(w.start), fmtClock(w.end), credit.requested, credit.credited, req.reason, req.purpose ?? "", req.destination ?? "", req.ref ?? "",
        req.status, req.reviewer ?? "", req.decidedAt ?? "",
      ];
    }),
  ];
}
