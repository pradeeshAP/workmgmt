import { useMemo } from "react";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, type Employee } from "@/store/data";
import { isDoneOutcome } from "@/pages/tasks/model";
import { useTasks, type Assignee, type TaskItem } from "@/pages/tasks/store";
import { useOutings } from "@/pages/outings/store";
import type { Outing } from "@/pages/outings/model";

/** Lane id of the queue; employee lanes use the employee id. */
export const QUEUE = "unassigned";
const ORIGIN = "Tirunelveli office";

/** One task as it sits in one lane: a task with several owners has a card in each owner's lane. */
export interface KCard {
  key: string;
  task: TaskItem;
  /** null while the task waits in the queue */
  empId: string | null;
  a: Assignee | null;
}
export interface KLane {
  id: string;
  emp: Employee | null;
  cards: KCard[];
  /** an outing this person has left for and not yet returned from */
  away: Outing | null;
}

export const nameOf = (id: string) => (id === QUEUE ? "Unassigned" : EMPLOYEES.find((e) => e.id === id)?.name ?? id);
export const cardDone = (c: KCard) => !!c.a && isDoneOutcome(c.a.outcome);

const cardKey = (t: TaskItem, empId: string | null) => `${t.id}:${empId ?? QUEUE}`;

/** Open work first, soonest deadline first; delivered work settles at the bottom. */
const order = (x: KCard, y: KCard) =>
  Number(cardDone(x)) - Number(cardDone(y)) || x.task.due.localeCompare(y.task.due) || x.task.code.localeCompare(y.task.code);

/**
 * The board inside the page filters. Company is a single workspace, the range keeps tasks whose
 * start-to-due window touches it, Department and the people search choose which employee lanes
 * show (the queue is never hidden), and `query` narrows cards by task, place or person.
 */
export function useBoard(query: string): { lanes: KLane[]; waiting: number; columns: number } {
  const tasks = useTasks((s) => s.tasks);
  const outings = useOutings((s) => s.outings);
  const { from, to, department, search } = useApp((s) => s.filters);
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const person = search.trim().toLowerCase();
    const validRange = from <= to;
    const people = EMPLOYEES.filter((e) => (!department || e.dept === department) && (!person || e.name.toLowerCase().includes(person)));

    const live = tasks.filter(
      (t) =>
        t.lifecycle === "live" &&
        !(validRange && (t.due.slice(0, 10) < from || t.start.slice(0, 10) > to)) &&
        (!q || [t.code, t.title, t.destination, t.category, ...t.assignees.map((a) => nameOf(a.empId))].some((x) => x.toLowerCase().includes(q)))
    );

    const queue: KLane = { id: QUEUE, emp: null, away: null, cards: live.filter((t) => t.assignees.length === 0).map((t) => ({ key: cardKey(t, null), task: t, empId: null, a: null })).sort(order) };
    const lanes = people.map<KLane>((e) => ({
      id: e.id,
      emp: e,
      away: outings.find((o) => o.employeeId === e.id && o.state === "away") ?? null,
      cards: live.flatMap((t) => t.assignees.filter((a) => a.empId === e.id).map((a) => ({ key: cardKey(t, e.id), task: t, empId: e.id, a }))).sort(order),
    }));
    return { lanes: [queue, ...lanes], waiting: queue.cards.length, columns: lanes.length };
  }, [tasks, outings, from, to, department, search, query]);
}

export type Verdict = { ok: true } | { ok: false; reason: string };

/** Why a card can't leave its lane for anyone, or null: delivered work stays put, and so does a task whose owner is out on it. */
export function frozen(card: KCard, outings: Outing[]): string | null {
  const { task, a } = card;
  if (a && isDoneOutcome(a.outcome)) return `${task.code} is already delivered. Reopen it from Update progress before moving it.`;
  const out = card.empId && outings.find((o) => o.taskCode === task.code && o.employeeId === card.empId && o.state === "away");
  if (out) return `Record the employee's return before moving this task. ${nameOf(card.empId!)} is still out on ${out.id}.`;
  return null;
}

/** Whether a card may go to `toId`. The same rules back dragging and the Move to… picker. */
export function checkMove(card: KCard, toId: string, outings: Outing[]): Verdict {
  const why = frozen(card, outings);
  if (why) return { ok: false, reason: why };
  if (toId !== QUEUE && card.task.assignees.some((x) => x.empId === toId)) return { ok: false, reason: `${nameOf(toId)} is already on ${card.task.code}. Pick someone else.` };
  return { ok: true };
}

export interface MovePlan {
  assignees: Assignee[];
  /** goes into the task history */
  history: string;
  /** shown in the success toast */
  toast: string;
  /** outings still planned for the previous owner; they do not follow the task */
  left: Outing[];
}

/** What a move does to the task. The new owner starts at Assigned; the old owner's progress stays in the history. */
export function planMove(card: KCard, toId: string, outings: Outing[]): MovePlan {
  const { task, empId, a } = card;
  const fromId = empId ?? QUEUE;
  const pct = a && a.progress > 0 ? ` ${nameOf(fromId)} had reached ${a.progress}%.` : "";
  const left = empId ? outings.filter((o) => o.taskCode === task.code && o.employeeId === empId && ["plan-review", "clarification", "plan-approved"].includes(o.state)) : [];
  const note = left.length ? ` ${left.map((o) => o.id).join(", ")} stays with ${nameOf(fromId)}.` : "";

  if (toId === QUEUE) {
    return { assignees: task.assignees.filter((x) => x.empId !== empId), history: `Unassigned from ${nameOf(fromId)}.${pct}`, toast: `${task.code} is back in Unassigned.${note}`, left };
  }
  const next: Assignee = { empId: toId, origin: ORIGIN, outcome: "assigned", progress: 0 };
  if (!empId) return { assignees: [...task.assignees, next], history: `Assigned to ${nameOf(toId)}.`, toast: `${task.code} assigned to ${nameOf(toId)}.`, left };
  return {
    assignees: task.assignees.map((x) => (x.empId === empId ? next : x)),
    history: `Reassigned from ${nameOf(fromId)} to ${nameOf(toId)}.${pct}`,
    toast: `${task.code} moved to ${nameOf(toId)}.${note}`,
    left,
  };
}
