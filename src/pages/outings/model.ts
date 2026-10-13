import { useMemo } from "react";
import { dtToMin, fmtMin, type AttRecord } from "@/lib/engine";
import { recordFor, shiftIdFor } from "@/pages/timeline/model";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, type Employee } from "@/store/data";
import { useTasks } from "@/pages/tasks/store";
import { useOutings } from "./store";

export type OutingState =
  | "plan-review" | "plan-approved" | "plan-declined" | "clarification"
  | "away" | "actual-review" | "actual-accepted" | "re-review" | "revoked";

export interface Estimate { outbound: number; onsite: number; ret: number; buffer: number }

export interface OutingEvent {
  /** ISO timestamp */
  at: string;
  actor: string;
  action: string;
  note?: string;
  state: OutingState;
}

/** The check-out punch (the pair it closes) and the return punch (the pair that opens after it). */
export interface OutingLink { outPair: string; inPair: string }

export interface Outing {
  /** OUT-2081 */
  id: string;
  employeeId: string;
  /** TSK-2041 */
  taskCode: string;
  /** the shift date, yyyy-MM-dd */
  date: string;
  destination: string;
  km: number;
  /** HH:MM */
  reqOut: string;
  reqReturn: string;
  est: Estimate;
  actualOut?: string;
  actualReturn?: string;
  /** what the outing is for, in the employee's words */
  purpose?: string;
  /** the punches the actual times were taken from; if they change later, the actual times go stale */
  link?: OutingLink;
  state: OutingState;
  planReviewer?: string;
  actualReviewer?: string;
  history: OutingEvent[];
}

export const PARTS: { key: keyof Estimate; label: string; short: string; bar: string }[] = [
  { key: "outbound", label: "Outbound", short: "out", bar: "bg-brand" },
  { key: "onsite", label: "On site", short: "on site", bar: "bg-work" },
  { key: "ret", label: "Return", short: "back", bar: "bg-permission" },
  { key: "buffer", label: "Buffer", short: "buffer", bar: "bg-duty" },
];

/** Stage of the process each state sits at: REQUEST → ESTIMATE → DEPART → RETURN → REVIEW. */
export const STEPS = ["Request", "Estimate", "Depart", "Return", "Review"] as const;
export const stageOf = (s: OutingState): number =>
  s === "plan-review" || s === "clarification" || s === "plan-declined" ? 1 : s === "plan-approved" ? 2 : s === "away" ? 3 : s === "revoked" ? -1 : 4;
/** Closed outings: nothing more can be decided on the plan. */
export const stopped = (s: OutingState) => s === "plan-declined" || s === "revoked";
export const NEEDS_REVIEW: OutingState[] = ["plan-review", "clarification", "actual-review", "re-review"];

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const validTime = (s: string) => /^\d{2}:\d{2}$/.test(s);
const span = (a: string, b: string) => toMin(b) - toMin(a);

export const estTotal = (e: Estimate) => e.outbound + e.onsite + e.ret + e.buffer;

export interface Figures {
  requested: number;
  estimated: number;
  /** minutes; null until both punches exist */
  actual: number | null;
  /** estimate minus request; positive = the plan is longer than the window asked for */
  reqVsEst: number;
  /** actual minus estimate; positive = the outing ran over the plan */
  actVsEst: number | null;
}

export function figures(o: Outing): Figures {
  const requested = span(o.reqOut, o.reqReturn);
  const estimated = estTotal(o.est);
  const actual = o.actualOut && o.actualReturn ? span(o.actualOut, o.actualReturn) : null;
  return { requested, estimated, actual, reqVsEst: estimated - requested, actVsEst: actual === null ? null : actual - estimated };
}

/** Within 30 minutes over is worth a look; beyond that needs an explanation. */
export const RAISE = 30;
export type Level = "ok" | "amber" | "rose";
export const levelOf = (v: number | null): Level => (v === null || v <= 0 ? "ok" : v <= RAISE ? "amber" : "rose");
export const signed = (v: number) => (v === 0 ? "On plan" : `${v > 0 ? "+" : "−"}${fmtMin(Math.abs(v))}`);

/** Duty credit given once HR accepts the actual time. */
export const creditOf = (o: Outing): number => (o.state === "actual-accepted" ? figures(o).actual ?? 0 : 0);

export function creditText(o: Outing): string {
  const f = figures(o);
  switch (o.state) {
    case "actual-accepted": return `${fmtMin(f.actual ?? 0)} credited`;
    case "re-review": return "Credit on hold";
    case "actual-review": return "Credit after review";
    case "away": return "Credit after return";
    case "plan-approved": return "Credit after departure";
    case "plan-review": case "clarification": return "No credit yet";
    default: return "No credit";
  }
}

export interface OutingRow { o: Outing; emp: Employee; f: Figures }

/** Outings inside the page filters. Pages without an employee filter pass `withEmployee: false`. */
export function useOutingRows(withEmployee = true): OutingRow[] {
  const outings = useOutings((s) => s.outings);
  const tasks = useTasks((s) => s.tasks);
  const { from, to, department, search, employee } = useApp((s) => s.filters);
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const validRange = from <= to;
    const rows: OutingRow[] = [];
    for (const o of outings) {
      const emp = EMPLOYEES.find((e) => e.id === o.employeeId);
      if (!emp) continue;
      if (validRange && (o.date < from || o.date > to)) continue;
      if (department && emp.dept !== department) continue;
      if (withEmployee && employee && emp.id !== employee) continue;
      if (q) {
        const task = tasks.find((t) => t.code === o.taskCode);
        if (![emp.name, o.id, o.taskCode, task?.title, o.destination].some((t) => t?.toLowerCase().includes(q))) continue;
      }
      rows.push({ o, emp, f: figures(o) });
    }
    return rows.sort((a, b) => b.o.date.localeCompare(a.o.date) || b.o.id.localeCompare(a.o.id));
  }, [outings, tasks, from, to, department, search, employee, withEmployee]);
}

/* ------------------------------ punch evidence ------------------------------ */
export interface PunchPair { id: string; /** minutes from the shift date's midnight */ inMin: number; outMin: number | null; reason: string; note: string }

const hhmm = (m: number) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, "0")}:${String((((m % 60) + 60) % 60)).padStart(2, "0")}`;
export const minToClock = hhmm;

/** The check-in / check-out pairs recorded for the person on the outing's date. */
export function pairsFor(o: Pick<Outing, "employeeId" | "date">, attendance: Record<string, AttRecord>, assignments: Record<string, string>): PunchPair[] {
  const sid = shiftIdFor(o.employeeId, o.date, assignments);
  const rec = recordFor(o.employeeId, o.date, sid, attendance[`${o.employeeId}|${o.date}`]);
  if (rec.status !== "working") return [];
  const out: PunchPair[] = [];
  for (const p of rec.pairs) {
    const a = dtToMin(p.in, o.date);
    if (a === null) continue;
    out.push({ id: p.id, inMin: a, outMin: p.out ? dtToMin(p.out, o.date) : null, reason: p.reason, note: p.note });
  }
  return out.sort((x, y) => x.inMin - y.inMin);
}

export interface LinkState {
  /** punches the outing is linked to, as HH:MM, read from the attendance records as they are now */
  now: { out: string; ret: string | null } | null;
  /** linked, but the punches were edited or removed since */
  stale: boolean;
  /** the linked punches no longer exist */
  broken: boolean;
  /** the outing has actual times but nothing ties them to a punch */
  unlinked: boolean;
}

const HAS_ACTUAL: OutingState[] = ["away", "actual-review", "re-review", "actual-accepted"];

export function linkState(o: Outing, pairs: PunchPair[]): LinkState {
  if (!o.link) return { now: null, stale: false, broken: false, unlinked: HAS_ACTUAL.includes(o.state) && !!o.actualOut };
  const a = pairs.find((p) => p.id === o.link!.outPair);
  const b = pairs.find((p) => p.id === o.link!.inPair);
  if (!a || a.outMin === null) return { now: null, stale: false, broken: true, unlinked: false };
  const now = { out: hhmm(a.outMin), ret: b ? hhmm(b.inMin) : null };
  return { now, stale: now.out !== o.actualOut || (now.ret ?? undefined) !== o.actualReturn, broken: false, unlinked: false };
}
