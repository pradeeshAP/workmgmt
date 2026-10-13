import { useMemo } from "react";
import { useApp } from "@/store/useApp";
import { safeGet, safeSet } from "@/lib/utils";
import { EMPLOYEES, SHIFTS, type Employee, type PermissionRequest, type Shift } from "@/store/data";
import { dtToMin, permMinutes, workingIntervals, type AttRecord, type Interval } from "@/lib/engine";
import { recordFor, shiftIdFor } from "@/pages/timeline/model";

export type PermType = "Late arrival" | "In-shift permission" | "Early departure" | "Business outing";

const len = (a: Interval) => Math.max(0, a.end - a.start);
const sum = (xs: Interval[]) => xs.reduce((n, x) => n + len(x), 0);
const clip = (a: Interval, b: Interval): Interval | null => {
  const s = Math.max(a.start, b.start), e = Math.min(a.end, b.end);
  return e > s ? { start: s, end: e } : null;
};
const clipAll = (xs: Interval[], b: Interval) => xs.map((x) => clip(x, b)).filter(Boolean) as Interval[];

function merge(xs: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of [...xs].sort((a, b) => a.start - b.start)) {
    const last = out[out.length - 1];
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end);
    else out.push({ ...x });
  }
  return out;
}
const subtract = (xs: Interval[], cut: Interval[]): Interval[] =>
  xs.flatMap((x) => {
    let pieces = [x];
    for (const c of cut) pieces = pieces.flatMap((p) => [clip(p, { start: -1e9, end: c.start }), clip(p, { start: c.end, end: 1e9 })].filter(Boolean) as Interval[]);
    return pieces;
  });

/** What kind of time away this is, read from where the window sits in the shift. */
export function permType(req: Pick<PermissionRequest, "from" | "to" | "kind">, shift: Shift | null): PermType {
  if (req.kind === "Business duty") return "Business outing";
  const w = permMinutes(req);
  if (shift && w.start <= shift.start) return "Late arrival";
  if (shift && w.end >= shift.end) return "Early departure";
  return "In-shift permission";
}

export interface Credit {
  requested: number;
  /** minutes an approval would credit: inside working hours and not already worked */
  eligible: number;
  /** minutes actually credited: only approved requests earn credit */
  credited: number;
  eligibleIv: Interval[];
  /** minutes of the window outside working hours, or in the shift break */
  outside: number;
  /** minutes of the window that were already worked */
  worked: number;
  /** closed punch intervals, for the evidence timeline */
  punches: Interval[];
  open?: number;
}

export function analyze(req: PermissionRequest, shift: Shift | null, rec: AttRecord, date: string): Credit {
  const win = permMinutes(req);
  const requested = len(win);
  const punches: Interval[] = [];
  let open: number | undefined;
  if (rec.status === "working") {
    for (const p of rec.pairs) {
      const a = dtToMin(p.in, date);
      if (a === null) continue;
      if (!p.out) { open = open === undefined ? a : Math.min(open, a); continue; }
      const b = dtToMin(p.out, date);
      if (b !== null && b > a) punches.push({ start: a, end: b });
    }
  }
  // leave and absence days are accounted whole, so a request adds nothing on top
  const counts = !!shift && (rec.status === "working" || rec.status === "unmarked");
  const inside = shift && counts ? clipAll(workingIntervals(shift), win) : [];
  const eligibleIv = subtract(inside, merge(punches));
  const eligible = sum(eligibleIv);
  return {
    requested,
    eligible,
    credited: req.status === "approved" ? eligible : 0,
    eligibleIv,
    outside: counts ? requested - sum(inside) : requested,
    worked: sum(inside) - eligible,
    punches,
    open,
  };
}

export interface PermRow {
  req: PermissionRequest;
  emp: Employee;
  shift: Shift | null;
  rec: AttRecord;
  type: PermType;
  credit: Credit;
}

export const STATUS_ORDER: Record<PermissionRequest["status"], number> = { pending: 0, approved: 1, declined: 2, cancelled: 3 };

const rowOf = (req: PermissionRequest, assignments: Record<string, string>, attendance: Record<string, AttRecord>): PermRow | null => {
  const emp = EMPLOYEES.find((e) => e.id === req.employeeId);
  if (!emp) return null;
  const sid = shiftIdFor(emp.id, req.date, assignments);
  const shift = SHIFTS.find((s) => s.id === sid) ?? null;
  const rec = recordFor(emp.id, req.date, sid, attendance[`${emp.id}|${req.date}`]);
  return { req, emp, shift, rec, type: permType(req, shift), credit: analyze(req, shift, rec, req.date) };
};

/** Every request inside the page filters, before the status filter is applied. */
export function usePermissionRows(): PermRow[] {
  const filters = useApp((s) => s.filters);
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const { from, to, department, shift: shiftFilter, search } = filters;

  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const validRange = from <= to;
    const rows: PermRow[] = [];
    for (const req of permissions) {
      const row = rowOf(req, assignments, attendance);
      if (!row) continue;
      const { emp, shift } = row;
      if (validRange && (req.date < from || req.date > to)) continue;
      if (department && emp.dept !== department) continue;
      if (shiftFilter && shift?.id !== shiftFilter) continue;
      if (q && ![emp.name, req.reason, req.purpose, req.destination, req.ref].some((t) => t?.toLowerCase().includes(q))) continue;
      rows.push(row);
    }
    return rows.sort(
      (a, b) =>
        STATUS_ORDER[a.req.status] - STATUS_ORDER[b.req.status] ||
        b.req.date.localeCompare(a.req.date) ||
        permMinutes(a.req).start - permMinutes(b.req).start
    );
  }, [permissions, attendance, assignments, from, to, department, shiftFilter, search]);
}

/** One request by id, whatever the page filters say. */
export function usePermissionRow(id: string | null): PermRow | null {
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  return useMemo(() => {
    const req = permissions.find((p) => p.id === id);
    return req ? rowOf(req, assignments, attendance) : null;
  }, [id, permissions, attendance, assignments]);
}

/* ------------------------------ decisions ------------------------------ */
const REVIEWER_KEY = "ascending.reviewer";
export const rememberedReviewer = () => safeGet(REVIEWER_KEY) ?? "";

/** Record a decision on each request, adding it to that request's history. */
export function applyDecision(
  all: PermissionRequest[],
  ids: string[],
  status: Exclude<PermissionRequest["status"], "pending">,
  actor: string,
  note?: string
): PermissionRequest[] {
  const name = actor.trim();
  safeSet(REVIEWER_KEY, name);
  const at = new Date().toISOString();
  const event = { status, actor: name, at, ...(note?.trim() ? { note: note.trim() } : {}) };
  return all.map((p) => (ids.includes(p.id) ? { ...p, status, reviewer: name, decidedAt: at, history: [...(p.history ?? []), event] } : p));
}
