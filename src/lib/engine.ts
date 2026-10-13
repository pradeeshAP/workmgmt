import { addDays, differenceInCalendarDays, format, getDay, parseISO } from "date-fns";
import { EMPLOYEES, SHIFTS, TODAY, type PermissionRequest, type Shift } from "@/store/data";
import type { Bucket } from "@/components/kit/buckets";
import type { TimelineRow, TimelineSegment } from "@/components/kit/ShiftTimeline";
import type { FlagKind } from "@/components/kit/Status";
import { fmtClock, fmtDuration } from "./utils";

/* ------------------------------ types ------------------------------ */
export interface Interval { start: number; end: number }
export type AttStatus = "working" | "leave" | "absent" | "unmarked";

export interface Pair {
  id: string;
  /** "yyyy-MM-ddTHH:mm" */
  in: string;
  /** empty string = open punch, awaiting out */
  out: string;
  reason: string;
  taskId: string;
  note: string;
}
export interface AttRecord {
  status: AttStatus;
  pairs: Pair[];
  note: string;
  approveExtra: boolean;
}

export interface Issue { kind: FlagKind; text: string; severity: number }
export interface DayResult {
  required: number;
  work: number;
  permission: number;
  duty: number;
  gap: number;
  unresolved: number;
  extra: number;
  segments: TimelineSegment[];
  pending: { start: number; end: number; label: string }[];
  openPunch?: number;
  flags: { kind: FlagKind; detail?: string }[];
  issues: Issue[];
  /** 0–100 */
  coverage: number;
}

export const POLICY_MAX_PAIRS = 8;

/* ------------------------------ helpers ------------------------------ */
export const fmtMin = (m: number) => (m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`);
const len = (a: Interval) => Math.max(0, a.end - a.start);
const sum = (xs: Interval[]) => xs.reduce((n, x) => n + len(x), 0);
const clip = (a: Interval, b: Interval): Interval | null => {
  const s = Math.max(a.start, b.start), e = Math.min(a.end, b.end);
  return e > s ? { start: s, end: e } : null;
};

/** "09:30" or "02:00+1" -> minutes from the shift start date's midnight */
export const toMin = (s: string): number => {
  const [clock, plus] = s.split("+");
  const [h, m] = clock.split(":").map(Number);
  return h * 60 + m + (plus ? Number(plus) * 1440 : 0);
};
export const permMinutes = (p: Pick<PermissionRequest, "from" | "to">): Interval => ({ start: toMin(p.from), end: toMin(p.to) });

export const dtToMin = (dt: string, date: string): number | null => {
  if (!dt || !dt.includes("T")) return null;
  const [d, t] = dt.split("T");
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return differenceInCalendarDays(parseISO(d), parseISO(date)) * 1440 + h * 60 + m;
};
export const minToDt = (min: number, date: string): string => {
  const day = Math.floor(min / 1440);
  const r = min - day * 1440;
  return `${format(addDays(parseISO(date), day), "yyyy-MM-dd")}T${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
};

export const workingIntervals = (s: Shift): Interval[] => [
  { start: s.start, end: s.breakStart },
  { start: s.breakEnd, end: s.end },
];

/* ------------------------------ seed data ------------------------------ */
/** [in, out, exit reason?, task id?, destination?] — omitted reasons default to Break / End of shift */
type Span = [string, string, string?, string?, string?];
const mkPairs = (key: string, date: string, spans: Span[]): Pair[] =>
  spans.map(([a, b, reason, taskId, note], i) => ({
    id: `${key}-${i}`,
    in: minToDt(toMin(a), date),
    out: b ? minToDt(toMin(b), date) : "",
    reason: b ? (reason ?? (i < spans.length - 1 ? "Break" : "End of shift")) : "",
    taskId: taskId ?? "",
    note: note ?? "",
  }));

const DAY8: Record<string, { status?: AttStatus; spans?: Span[]; approveExtra?: boolean }> = {
  e1: { spans: [["09:05", "11:00", "Personal permission", "", "Bank visit"], ["12:00", "18:00"]] },
  e2: { spans: [["09:00", "11:30", "Business task", "t1", "Palayamkottai"], ["14:00", "15:30", "Personal permission"], ["16:00", "18:45"]] },
  e3: { spans: [["06:00", "10:00"], ["10:30", "13:20"]] },
  e4: { status: "leave" },
  e5: { spans: [["14:05", "18:00", "Break"], ["18:30", ""]] },
  e6: { status: "unmarked" },
  e7: { spans: [["09:00", "13:00"], ["14:00", "18:00"]] },
  e8: { spans: [["22:05", "02:00+1"], ["02:30+1", "06:30+1"]], approveExtra: true },
  e9: { spans: [["10:00", "13:00"], ["14:00", "16:00", "Personal permission", "", "Parent-teacher meeting"]] },
  e10: { spans: [["14:00", "16:40", "Personal permission", "", "Clinic"], ["17:40", "18:00"], ["18:30", "22:00"]] },
  e11: { spans: [["22:00", "02:00+1"], ["03:00+1", ""]] },
};

/** Past days with a story to tell: late arrivals, business outings and early exits that match the sample requests. */
const HISTORY: Record<string, Span[]> = {
  "e2|2026-10-01": [["09:45", "13:00"], ["14:00", "18:00"]],
  "e2|2026-10-05": [["09:00", "10:00", "Business task", "t9", "Tirunelveli Junction"], ["13:00", "18:00"]],
  "e2|2026-10-06": [["09:00", "13:00"], ["14:00", "15:30", "Personal permission", "", "Passport Seva Kendra"], ["16:30", "18:00"]],
  "e2|2026-10-07": [["09:00", "13:00"], ["14:00", "17:00", "Personal permission", "", "Family function"]],
  "e1|2026-10-06": [["09:00", "14:00", "Business task", "t10", "Client office, Palayamkottai"], ["16:00", "18:00"]],
};

export const isWeekend = (date: string) => [0, 6].includes(getDay(parseISO(date)));

/** Which shift is the employee assigned to on this date? null = unassigned. */
export function defaultShiftId(empId: string, date: string): string | null {
  if (isWeekend(date)) return null;
  if (date === TODAY && empId === "e12") return null;
  return EMPLOYEES.find((e) => e.id === empId)?.shiftId ?? null;
}

export function seedRecord(empId: string, date: string): AttRecord {
  const key = `${empId}|${date}`;
  const emp = EMPLOYEES.find((e) => e.id === empId);
  const shift = SHIFTS.find((s) => s.id === emp?.shiftId);
  const empty: AttRecord = { status: "unmarked", pairs: [], note: "", approveExtra: false };
  if (!emp || !shift) return empty;

  if (date === TODAY) {
    const d = DAY8[empId];
    if (!d) return empty;
    return { status: d.status ?? "working", pairs: d.spans ? mkPairs(key, date, d.spans) : [], note: "", approveExtra: !!d.approveExtra };
  }
  if (date > TODAY) return empty;
  if (HISTORY[key]) return { status: "working", pairs: mkPairs(key, date, HISTORY[key]), note: "", approveExtra: false };

  const i = Number(empId.slice(1));
  const dn = Number(date.slice(-2));
  if ((i + dn) % 13 === 0) return { ...empty, status: "leave" };
  const late = (i * 3 + dn) % 9 === 0 ? 20 : 0;
  const early = (i + dn) % 10 === 4 ? 25 : 0;
  const span = (m: number) => fmtClock(m).replace(" +", "+");
  return {
    status: "working",
    pairs: mkPairs(key, date, [
      [span(shift.start + late), span(shift.breakStart)],
      [span(shift.breakEnd), span(shift.end - early)],
    ]),
    note: "",
    approveExtra: false,
  };
}

/** Minutes lost at the start and end of a worked shift that no approved time away covers. */
export function lateEarlyOf(segs: TimelineSegment[], shift: Shift, status: AttStatus, open: number | undefined): { late: number; early: number } {
  if (status !== "working") return { late: 0, early: 0 };
  const first = segs.find((s) => s.start === shift.start && s.kind === "gap");
  const lastGap = [...segs].reverse().find((s) => s.end === shift.end && s.kind === "gap");
  const late = first && !first.label ? first.end - first.start : 0;
  const early = open === undefined && lastGap && !lastGap.label && lastGap !== first ? lastGap.end - lastGap.start : 0;
  return { late, early };
}

/* ------------------------------ engine ------------------------------ */
const ZERO: DayResult = {
  required: 0, work: 0, permission: 0, duty: 0, gap: 0, unresolved: 0, extra: 0,
  segments: [], pending: [], flags: [], issues: [], coverage: 0,
};

export function computeDay(shift: Shift | null, rec: AttRecord, perms: PermissionRequest[], date: string, approveExtraOverride?: boolean): DayResult {
  if (!shift) return ZERO;
  const wi = workingIntervals(shift);
  const required = sum(wi);

  const closed: Interval[] = [];
  let open: number | undefined;
  if (rec.status === "working") {
    for (const p of rec.pairs) {
      const a = dtToMin(p.in, date);
      if (a === null) continue;
      if (!p.out) { open = open === undefined ? a : Math.min(open, a); continue; }
      const b = dtToMin(p.out, date);
      if (b !== null && b > a) closed.push({ start: a, end: b });
    }
  }

  const mine = perms.filter((p) => p.date === date && p.status === "approved").map((p) => ({ iv: permMinutes(p), kind: p.kind, reason: p.reason }));
  const workIv = closed.flatMap((c) => wi.map((w) => clip(c, w)).filter(Boolean) as Interval[]);
  const unresolvedIv: Interval[] = [];
  if (rec.status === "unmarked") unresolvedIv.push(...wi);
  if (open !== undefined) unresolvedIv.push(...wi.map((w) => clip({ start: open!, end: shift.end }, w)).filter(Boolean) as Interval[]);

  const cutPoints = new Set<number>();
  wi.forEach((w) => { cutPoints.add(w.start); cutPoints.add(w.end); });
  [...workIv, ...unresolvedIv, ...mine.map((m) => m.iv)].forEach((x) => { cutPoints.add(x.start); cutPoints.add(x.end); });
  const pts = [...cutPoints].sort((a, b) => a - b);

  const within = (x: number, list: Interval[]) => list.some((i) => x >= i.start && x < i.end);
  const segs: TimelineSegment[] = [];
  const push = (kind: Bucket, start: number, end: number, label?: string) => {
    const last = segs[segs.length - 1];
    if (last && last.kind === kind && last.end === start && last.label === label) last.end = end;
    else segs.push({ kind, start, end, label });
  };

  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k], b = pts[k + 1], mid = (a + b) / 2;
    if (!within(mid, wi)) continue;
    if (rec.status === "leave") { push("permission", a, b, "Approved leave"); continue; }
    if (rec.status === "absent") { push("gap", a, b, "Absent"); continue; }
    const perm = mine.find((m) => mid >= m.iv.start && mid < m.iv.end);
    if (within(mid, workIv)) push("work", a, b);
    else if (perm?.kind === "Business duty") push("duty", a, b, `Business duty · ${perm.reason}`);
    else if (perm) push("permission", a, b, `Permission · ${perm.reason}`);
    else if (within(mid, unresolvedIv)) push("unresolved", a, b, "Unresolved");
    else push("gap", a, b);
  }

  const total = (k: Bucket) => segs.filter((s) => s.kind === k).reduce((n, s) => n + (s.end - s.start), 0);

  // extra time: punches outside the planned shift window
  const shiftIv = { start: shift.start, end: shift.end };
  let extra = 0;
  for (const c of closed) {
    const before = clip(c, { start: -1e6, end: shiftIv.start });
    const after = clip(c, { start: shiftIv.end, end: 1e6 });
    for (const x of [before, after]) if (x) { extra += len(x); segs.push({ kind: "extra", start: x.start, end: x.end, label: "Extra time" }); }
  }

  const pending = perms
    .filter((p) => p.date === date && p.status === "pending")
    .map((p) => ({ ...permMinutes(p), label: p.reason }));

  const r: DayResult = {
    required,
    work: total("work"),
    permission: total("permission"),
    duty: total("duty"),
    gap: total("gap"),
    unresolved: total("unresolved"),
    extra,
    segments: segs,
    pending,
    openPunch: open,
    flags: [],
    issues: [],
    coverage: 0,
  };
  r.coverage = required ? Math.round(((r.work + r.permission + r.duty) / required) * 100) : 0;

  /* flags + issues */
  const { late, early } = lateEarlyOf(segs, shift, rec.status, open);
  const restGap = r.gap - late - early;
  const approvedExtra = approveExtraOverride ?? rec.approveExtra;

  const add = (kind: FlagKind, detail: string | undefined, text: string, severity: number) => {
    r.flags.push({ kind, detail });
    r.issues.push({ kind, text, severity });
  };
  if (rec.status === "unmarked") add("unmarked", undefined, "Unmarked, no entry yet", 5);
  if (open !== undefined) add("missing-out", undefined, `Missing check-out since ${fmtClock(open)}`, 5);
  if (rec.status === "absent") add("absent", undefined, "Absent for the full shift", 4);
  if (restGap > 0) add("gap", fmtMin(restGap), `Uncovered gap of ${fmtDuration(restGap)}`, 3);
  if (pending.length) add("pending", String(pending.length), `${pending.length} pending request${pending.length > 1 ? "s" : ""} earn no credit`, 3);
  if (late > 0) add("late", fmtMin(late), `Arrived ${fmtDuration(late)} after shift start`, 2);
  if (early > 0) add("early", fmtMin(early), `Left ${fmtDuration(early)} before shift end`, 2);
  if (extra > 0 && !approvedExtra) add("extra-review", undefined, `${fmtDuration(extra)} extra time awaiting approval`, 1);
  if (rec.status === "leave") r.flags.push({ kind: "on-leave" });
  if (r.permission + r.duty > 0 && rec.status === "working") r.flags.push({ kind: "permission-covered" });
  if (rec.status !== "unmarked" && r.gap === 0 && r.unresolved === 0 && pending.length === 0) r.flags.push({ kind: "reconciled" });
  return r;
}

export const needsReview = (r: DayResult) => r.issues.length > 0;

/* ------------------------------ row builder ------------------------------ */
export function toTimelineRow(
  empId: string, name: string, sub: string, shift: Shift | null, res: DayResult, rec: AttRecord
): TimelineRow {
  const state = !shift ? undefined : rec.status === "leave" ? "approved-leave" : rec.status === "absent" ? "absent" : rec.status === "unmarked" ? "awaiting-entry" : undefined;
  return {
    id: empId,
    name,
    sub,
    tone: shift?.tone ?? "blue",
    planned: shift ? { start: shift.start, end: shift.end, breakStart: shift.breakStart, breakEnd: shift.breakEnd } : undefined,
    segments: state ? [] : res.segments,
    pending: res.pending,
    openPunch: res.openPunch,
    state,
  };
}
