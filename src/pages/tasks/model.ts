import { useMemo } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Minus, Play, type LucideIcon } from "lucide-react";
import { useApp } from "@/store/useApp";
import { EMPLOYEES } from "@/store/data";
import { TASK_STATUS, type Def, type TaskStatus } from "@/components/kit/Status";
import { creditOf, type Outing } from "@/pages/outings/model";
import { useOutings } from "@/pages/outings/store";
import { MODE_LABEL, useTasks, type Assignee, type Outcome, type Priority, type TaskItem } from "./store";

export type Segment = "active" | "overdue" | "completed" | "revoked" | "deleted";
export const SEGMENTS: { value: Segment; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "revoked", label: "Revoked" },
  { value: "deleted", label: "Deleted" },
];

/** The sample day is 8 October 2026; open deadlines are judged against this unless the person picks another time. */
export const DEFAULT_ASSESS = "2026-10-08T14:30";

export const isDoneOutcome = (o: Outcome) => o === "on-time" || o === "late-done";

/** Everyone for individual and "everyone completes" tasks; one person for "any one completes". */
export const taskDone = (t: TaskItem) => t.assignees.length > 0 && (t.mode === "team-any" ? t.assignees.some((a) => isDoneOutcome(a.outcome)) : t.assignees.every((a) => isDoneOutcome(a.outcome)));

export function segmentOf(t: TaskItem, assessAt: string): Segment {
  if (t.lifecycle !== "live") return t.lifecycle;
  if (taskDone(t)) return "completed";
  return t.due < assessAt ? "overdue" : "active";
}

/** A person's outcome as shown: an unfinished assignment past its deadline reads Overdue. */
export function outcomeOf(a: Assignee, t: TaskItem, assessAt: string): TaskStatus {
  if (t.lifecycle !== "live") return t.lifecycle;
  if (isDoneOutcome(a.outcome)) return a.outcome as TaskStatus;
  if (t.due < assessAt && !(t.mode === "team-any" && taskDone(t))) return "overdue";
  return a.outcome;
}

export const SEG_DEF: Record<Segment, Def> = {
  active: { label: "Active", tone: "brand", icon: Play },
  overdue: TASK_STATUS.overdue,
  completed: { label: "Completed", tone: "work", icon: CheckCircle2 },
  revoked: TASK_STATUS.revoked,
  deleted: TASK_STATUS.deleted,
};
export const PRIORITY_DEF: Record<Priority, Def> = {
  high: { label: "High priority", tone: "gap", icon: ArrowUp },
  medium: { label: "Medium priority", tone: "duty", icon: Minus },
  low: { label: "Low priority", tone: "neutral", icon: ArrowDown },
};
export const OVERDUE_ICON: LucideIcon = AlertTriangle;

export interface TaskRow {
  t: TaskItem;
  seg: Segment;
  done: number;
  total: number;
  /** 0–100 */
  avg: number;
  outings: Outing[];
  /** minutes of duty credit from accepted outings */
  credit: number;
}

export const modeLabel = (t: TaskItem) => MODE_LABEL[t.mode];

/** "yyyy-MM-ddTHH:mm" as "08 Oct · 17:00" */
export const fmtStamp = (s: string) => {
  const d = new Date(`${s}:00Z`);
  return `${d.toLocaleDateString("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" })} · ${s.slice(11, 16)}`;
};

/** Tasks inside the page filters, with their segment and delivery figures. */
export function useTaskRows(assessAt: string): TaskRow[] {
  const tasks = useTasks((s) => s.tasks);
  const outings = useOutings((s) => s.outings);
  const { from, to, department, search } = useApp((s) => s.filters);
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const validRange = from <= to;
    const rows: TaskRow[] = [];
    for (const t of tasks) {
      const people = t.assignees.map((a) => EMPLOYEES.find((e) => e.id === a.empId)).filter(Boolean) as typeof EMPLOYEES;
      // a task is in range when any part of start-to-due touches it
      if (validRange && (t.due.slice(0, 10) < from || t.start.slice(0, 10) > to)) continue;
      if (department && !people.some((e) => e.dept === department)) continue;
      if (q && ![t.code, t.title, t.destination, t.category, ...people.map((e) => e.name)].some((x) => x.toLowerCase().includes(q))) continue;
      const mine = outings.filter((o) => o.taskCode === t.code && o.state !== "revoked");
      const done = t.assignees.filter((a) => isDoneOutcome(a.outcome)).length;
      const avg = t.assignees.length ? Math.round(t.assignees.reduce((n, a) => n + (isDoneOutcome(a.outcome) ? 100 : a.progress), 0) / t.assignees.length) : 0;
      rows.push({ t, seg: segmentOf(t, assessAt), done, total: t.assignees.length, avg, outings: mine, credit: mine.reduce((n, o) => n + creditOf(o), 0) });
    }
    return rows.sort((a, b) => a.t.due.localeCompare(b.t.due) || a.t.code.localeCompare(b.t.code));
  }, [tasks, outings, from, to, department, search, assessAt]);
}

export interface TaskTotals {
  active: number;
  viaTeams: number;
  assignments: number;
  onTime: number;
  late: number;
  open: number;
  overdue: number;
}

/** Headline figures over live tasks: the ones that are neither revoked nor deleted. */
export function totalsOf(rows: TaskRow[], assessAt: string): TaskTotals {
  const live = rows.filter((r) => r.t.lifecycle === "live");
  const open = live.filter((r) => r.seg !== "completed");
  const people = live.flatMap((r) => r.t.assignees.map((a) => ({ a, t: r.t })));
  const notDone = people.filter(({ a, t }) => !isDoneOutcome(a.outcome) && !(t.mode === "team-any" && taskDone(t)));
  return {
    active: open.length,
    viaTeams: open.filter((r) => r.t.mode !== "individual").length,
    assignments: people.length,
    onTime: people.filter(({ a }) => a.outcome === "on-time").length,
    late: people.filter(({ a }) => a.outcome === "late-done").length,
    open: notDone.length,
    overdue: notDone.filter(({ t }) => t.due < assessAt).length,
  };
}

export const OUTCOME_LABEL: Record<Outcome, string> = { assigned: "Assigned", "in-progress": "In progress", blocked: "Blocked", "on-time": "Completed on time", "late-done": "Completed late" };

export function tasksCsv(rows: TaskRow[], assessAt: string): (string | number)[][] {
  const head = ["Task", "Category", "Title", "Destination", "Assignment", "Assignee", "Employee ID", "Origin", "Outcome", "Progress %", "Start", "Due", "Priority", "Status", "Outings", "Duty credit (min)"];
  const body = rows.flatMap((r) =>
    r.t.assignees.map((a) => {
      const e = EMPLOYEES.find((x) => x.id === a.empId);
      return [
        r.t.code, r.t.category, r.t.title, r.t.destination, modeLabel(r.t), e?.name ?? a.empId, a.empId.toUpperCase(), a.origin,
        TASK_STATUS[outcomeOf(a, r.t, assessAt)].label, isDoneOutcome(a.outcome) ? 100 : a.progress,
        r.t.start.replace("T", " "), r.t.due.replace("T", " "), r.t.priority, SEG_DEF[r.seg].label, r.outings.length, r.credit,
      ];
    })
  );
  return [head, ...body];
}
