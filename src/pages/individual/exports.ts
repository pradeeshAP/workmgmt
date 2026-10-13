import { format, parseISO } from "date-fns";
import { fmtClock } from "@/lib/utils";
import { empCode } from "@/store/data";
import { permMinutes } from "@/lib/engine";
import { dayStatus, type EmpDay } from "@/pages/reports/model";
import { clock } from "@/pages/reports/exports";
import type { AwayRow, PersonReport } from "./model";

export function ledgerCsv(rep: PersonReport): (string | number)[][] {
  const { emp, days } = rep;
  return [
    ["Employee", "ID", "Shift date", "Weekday", "Shift", "First in", "Last out", "Sessions", "Required (min)", "Work in shift (min)", "Away, approved (min)", "Uncovered (min)", "Unresolved (min)", "Late, unexcused (min)", "Early, unexcused (min)", "Extra (min)", "Coverage (%)", "Status"],
    ...days.map((d: EmpDay) => [
      emp.name, empCode(emp.id), d.date, format(parseISO(d.date), "EEEE"), d.shift?.name ?? "",
      clock(d.firstIn), d.res.openPunch !== undefined ? "Still open" : clock(d.lastOut), d.sessions,
      d.res.required, d.res.work, d.away, d.res.gap, d.res.unresolved, d.late, d.early, d.res.extra, d.res.coverage, dayStatus(d).label,
    ]),
  ];
}

export function awayCsv(rep: PersonReport, rows: AwayRow[]): (string | number)[][] {
  const { emp } = rep;
  return [
    ["Employee", "ID", "Shift date", "Request", "Type", "Window from", "Window to", "Working time in window (min)", "Punch evidence", "Punched away (min)", "Beyond request (min)", "Purpose", "Reason", "Destination", "Task", "Decision", "Reviewer", "Credited (min)"],
    ...rows.map((r) => {
      const w = permMinutes(r.req);
      return [
        emp.name, empCode(emp.id), r.req.date, r.req.id.toUpperCase(), r.type, fmtClock(w.start), fmtClock(w.end), r.working,
        r.evidence.label, r.evidence.away, r.evidence.beyond, r.req.purpose ?? "", r.req.reason, r.req.destination ?? "", r.req.ref ?? "",
        r.req.status, r.req.reviewer ?? "", r.credit.credited,
      ];
    }),
  ];
}
