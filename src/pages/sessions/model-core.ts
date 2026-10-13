import { addDays, format, parseISO } from "date-fns";
import { fmtClock } from "@/lib/utils";
import { dtToMin, minToDt, permMinutes, workingIntervals, type AttRecord, type Interval, type Pair } from "@/lib/engine";
import type { PermissionRequest, Shift } from "@/store/data";
import type { PunchEvent } from "@/components/kit/MovementStrip";
import { FINAL_REASON, taskMeta } from "./data";

/* ------------------------------ punches ------------------------------ */
export interface PunchInput {
  type: "in" | "out";
  /** minutes from the shift start date's midnight */
  at: number;
  reason?: string;
  taskId?: string;
  note?: string;
}

/** Append a check-in, or close the open session with a check-out. */
export function applyPunch(rec: AttRecord, key: string, date: string, p: PunchInput): AttRecord {
  const pairs = rec.status === "working" ? [...rec.pairs] : [];
  if (p.type === "in") {
    pairs.push({ id: `${key}-${Date.now()}-${pairs.length}`, in: minToDt(p.at, date), out: "", reason: "", taskId: "", note: "" });
  } else {
    const open = pairs.map((x) => !x.out).lastIndexOf(true);
    if (open < 0) return rec;
    const cur = pairs[open];
    pairs[open] = { ...cur, out: minToDt(p.at, date), reason: p.reason ?? "", taskId: p.taskId ?? cur.taskId, note: p.note ?? cur.note };
  }
  return { ...rec, status: "working", pairs };
}

/** Shift practice punches, stored against one base date, onto the date being viewed. */
export function rebasePairs(pairs: Pair[], from: string, to: string): Pair[] {
  if (from === to) return pairs;
  const move = (dt: string) => (dt ? minToDt(dtToMin(dt, from) ?? 0, to) : "");
  return pairs.map((p) => ({ ...p, in: move(p.in), out: move(p.out) }));
}

/* ------------------------------ time away ------------------------------ */
const len = (a: Interval) => Math.max(0, a.end - a.start);
const sum = (xs: Interval[]) => xs.reduce((n, x) => n + len(x), 0);
const clip = (a: Interval, b: Interval): Interval | null => {
  const s = Math.max(a.start, b.start), e = Math.min(a.end, b.end);
  return e > s ? { start: s, end: e } : null;
};
const clipAll = (xs: Interval[], b: Interval) => xs.map((x) => clip(x, b)).filter(Boolean) as Interval[];

export type AwayStatus = "none" | "break" | "covered" | "pending" | "uncovered";
export interface AwayInfo {
  from: number;
  /** null while the employee has not returned */
  to: number | null;
  /** minutes between the exit and the return (or the end of the shift while still away) */
  total: number;
  breakMin: number;
  duty: number;
  permission: number;
  /** uncovered minutes that a pending request would cover once approved */
  pending: number;
  /** uncovered minutes nothing covers */
  gap: number;
  status: AwayStatus;
  /** still away: the return has not been recorded */
  awaiting: boolean;
  /** left after the final exit, before the shift ended */
  early: boolean;
}

export function analyzeAway(from: number, to: number, shift: Shift, perms: PermissionRequest[]) {
  const win = { start: from, end: to };
  const pieces = clipAll(workingIntervals(shift), win);
  const working = sum(pieces);
  const breakMin = sum(clipAll([{ start: shift.breakStart, end: shift.breakEnd }], win));
  let duty = 0, permission = 0, pend = 0;
  for (const p of perms) {
    const covered = sum(clipAll(pieces, permMinutes(p)));
    if (p.status === "approved" && p.kind === "Business duty") duty += covered;
    else if (p.status === "approved") permission += covered;
    else if (p.status === "pending") pend += covered;
  }
  duty = Math.min(duty, working);
  permission = Math.min(permission, working - duty);
  const uncovered = Math.max(0, working - duty - permission);
  const pending = Math.min(pend, uncovered);
  const gap = uncovered - pending;
  const total = len(win);
  const status: AwayStatus = total === 0 ? "none" : working === 0 ? "break" : gap > 0 ? "uncovered" : pending > 0 ? "pending" : "covered";
  return { total, breakMin, duty, permission, pending, gap, status };
}

/* ------------------------------ sessions ------------------------------ */
export interface Session {
  n: number;
  pair: Pair;
  inMin: number;
  /** null while the session is open */
  outMin: number | null;
  /** minutes worked, with the shift break taken out; null while open */
  net: number | null;
  nextIn: number | null;
  /** time away that follows this session's check-out */
  away: AwayInfo | null;
}

export type DayState = "not-in" | "in" | "away" | "closed";

const isFinalExit = (s: Session, allowed: number) => s.pair.reason === FINAL_REASON || s.n >= allowed;

export function dayState(rec: AttRecord, sessions: Session[], allowed: number): DayState {
  if (rec.status === "leave") return "closed";
  const last = sessions[sessions.length - 1];
  if (!last) return "not-in";
  if (last.outMin === null) return "in";
  return isFinalExit(last, allowed) ? "closed" : "away";
}

export function buildSessions(rec: AttRecord, shift: Shift | null, perms: PermissionRequest[], date: string, allowed: number): Session[] {
  if (rec.status !== "working") return [];
  const base = rec.pairs
    .map((p) => ({ p, a: dtToMin(p.in, date) }))
    .filter((x): x is { p: Pair; a: number } => x.a !== null)
    .sort((x, y) => x.a - y.a);

  const out: Session[] = base.map(({ p, a }, i) => {
    const b = p.out ? dtToMin(p.out, date) : null;
    const breakOverlap = b !== null && shift ? sum(clipAll([{ start: shift.breakStart, end: shift.breakEnd }], { start: a, end: b })) : 0;
    return { n: i + 1, pair: p, inMin: a, outMin: b !== null && b > a ? b : null, net: b !== null && b > a ? b - a - breakOverlap : null, nextIn: base[i + 1]?.a ?? null, away: null };
  });
  out.forEach((s, i) => {
    if (s.outMin === null || !shift) return;
    const last = i === out.length - 1;
    const final = isFinalExit(s, allowed);
    if (!last) {
      s.away = { from: s.outMin, to: s.nextIn, ...analyzeAway(s.outMin, s.nextIn as number, shift, perms), awaiting: false, early: false };
    } else if (s.outMin < shift.end) {
      s.away = { from: s.outMin, to: null, ...analyzeAway(s.outMin, shift.end, shift, perms), awaiting: !final, early: final };
    }
  });
  return out;
}

/* ------------------------------ movement strip ------------------------------ */
export function buildEvents(sessions: Session[]): PunchEvent[] {
  const events: PunchEvent[] = [];
  let n = 0;
  sessions.forEach((s, i) => {
    events.push({ n: ++n, type: "IN", at: s.inMin, title: i === 0 ? "First check-in" : "Return check-in" });
    if (s.outMin !== null) {
      const code = taskMeta(s.pair.taskId)?.code;
      events.push({
        n: ++n,
        type: "OUT",
        at: s.outMin,
        title: s.pair.reason === FINAL_REASON ? "Final check-out" : `Check-out · ${s.pair.reason || "no reason"}`,
        tasks: code ? [code] : undefined,
      });
    }
  });
  return events;
}

/* ------------------------------ CSV ------------------------------ */
const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function sessionsCsv(args: { name: string; code: string; date: string; policy: string; sessions: Session[] }): string {
  const { name, code, date, policy, sessions } = args;
  const day = (m: number) => format(addDays(parseISO(date), Math.floor(m / 1440)), "yyyy-MM-dd");
  const head = ["Employee", "ID", "Policy", "Session", "Check-in date", "Check-in", "Check-out date", "Check-out", "Exit reason", "Net work (min)", "Task ID", "Task", "Destination", "Next return", "Away (min)", "Business duty credit (min)", "Permission credit (min)", "Uncovered (min)", "Away status"];
  const rows = sessions.map((s) => {
    const t = taskMeta(s.pair.taskId);
    const a = s.away;
    return [
      name, code, policy, s.n,
      day(s.inMin), fmtClock(s.inMin),
      s.outMin === null ? "" : day(s.outMin), s.outMin === null ? "Still open" : fmtClock(s.outMin),
      s.pair.reason, s.net ?? "",
      t?.code ?? "", t?.title ?? "", s.pair.note,
      s.nextIn === null ? "" : fmtClock(s.nextIn),
      a ? a.total : "", a ? a.duty : "", a ? a.permission : "", a ? a.pending + a.gap : "",
      a ? (a.awaiting ? "awaiting return" : a.status) : "",
    ];
  });
  return [head, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}
