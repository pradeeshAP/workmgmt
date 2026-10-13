import { create } from "zustand";
import { safeGet, safeSet } from "@/lib/utils";

const LS = "ascending.tasks";

export type Outcome = "assigned" | "in-progress" | "blocked" | "on-time" | "late-done";
export type Mode = "individual" | "team-all" | "team-any";
export type Priority = "high" | "medium" | "low";
export type Lifecycle = "live" | "revoked" | "deleted";

export interface Assignee {
  empId: string;
  /** where they set out from */
  origin: string;
  outcome: Outcome;
  /** 0–100 */
  progress: number;
  /** "yyyy-MM-ddTHH:mm" */
  startedAt?: string;
  /** "yyyy-MM-ddTHH:mm" */
  completedAt?: string;
  /** what was delivered, or why it is blocked */
  evidence?: string;
}

export interface TaskEvent { at: string; actor: string; text: string }

export interface TaskItem {
  id: string;
  /** TSK-2041 */
  code: string;
  category: string;
  title: string;
  destination: string;
  mode: Mode;
  assignees: Assignee[];
  /** "yyyy-MM-ddTHH:mm" */
  start: string;
  due: string;
  priority: Priority;
  lifecycle: Lifecycle;
  history: TaskEvent[];
  company?: string;
  department?: string;
  location?: "off-site" | "on-site";
  instructions?: string;
  /** teams the task was assigned through; their members are in `assignees` */
  teamIds?: string[];
}

export const MODE_LABEL: Record<Mode, string> = {
  individual: "Individual task",
  "team-all": "Team · everyone completes",
  "team-any": "Team · any one completes",
};
export const CATEGORIES = ["Field visit", "Client", "Engineering", "Logistics", "Admin"] as const;

const A = (empId: string, origin: string, outcome: Outcome, progress: number, completedAt?: string): Assignee => ({ empId, origin, outcome, progress, completedAt });
const made = (at: string, text: string): TaskEvent => ({ at, actor: "Farah Nizam", text });
const T = (code: string, category: string, title: string, destination: string, mode: Mode, assignees: Assignee[], start: string, due: string, priority: Priority, lifecycle: Lifecycle = "live", extra: TaskEvent[] = []): TaskItem => ({
  id: code.toLowerCase(), code, category, title, destination, mode, assignees, start, due, priority, lifecycle,
  history: [made(`${start.slice(0, 10)}T03:30:00Z`, assignees.length ? "Task created and assigned." : "Task created. Waiting for an owner."), ...extra],
});

/** Sample work for 1–9 October 2026. Open deadlines are judged against the “assess at” time on the screen. */
const SEEDS: TaskItem[] = [
  T("TSK-2041", "Field visit", "Client visit, Palayamkottai", "Palayamkottai", "individual", [A("e2", "Tirunelveli office", "in-progress", 60)], "2026-10-08T09:00", "2026-10-08T17:00", "high"),
  T("TSK-2043", "Field visit", "Site survey, Tenkasi", "Tenkasi", "individual", [A("e5", "Tirunelveli office", "in-progress", 35)], "2026-10-08T13:00", "2026-10-08T21:00", "medium"),
  T("TSK-2044", "Logistics", "Vendor pickup", "Gangaikondan Industrial Estate", "individual", [A("e10", "Tirunelveli office", "assigned", 0)], "2026-10-08T18:00", "2026-10-08T20:00", "medium"),
  T("TSK-2049", "Admin", "Customer cheque collection", "Nagercoil", "individual", [A("e9", "Tirunelveli office", "in-progress", 40)], "2026-10-08T09:30", "2026-10-08T15:30", "high"),
  T("TSK-2045", "Engineering", "Staging smoke tests", "Staging environment", "team-all", [A("e2", "Remote", "on-time", 100, "2026-10-08T12:40"), A("e3", "Tirunelveli office", "on-time", 100, "2026-10-08T11:50")], "2026-10-08T09:00", "2026-10-08T13:00", "medium"),
  T("TSK-2042", "Engineering", "Release preparation", "Tirunelveli office", "team-all", [A("e1", "Tirunelveli office", "on-time", 100, "2026-10-08T10:40"), A("e3", "Tirunelveli office", "on-time", 100, "2026-10-08T09:55")], "2026-10-08T06:30", "2026-10-08T11:00", "high"),
  T("TSK-2046", "Admin", "Bank deposit run", "City Union Bank", "individual", [A("e1", "Tirunelveli office", "late-done", 100, "2026-10-08T12:10")], "2026-10-08T09:30", "2026-10-08T11:30", "low"),
  T("TSK-2047", "Logistics", "Courier documents to Nagercoil", "Nagercoil", "individual", [A("e6", "Home", "assigned", 0)], "2026-10-07T09:00", "2026-10-07T18:00", "high"),
  T("TSK-2048", "Admin", "Quarterly asset audit", "Head office, Tirunelveli", "team-all", [A("e4", "Tirunelveli office", "blocked", 20), A("e7", "Tirunelveli office", "in-progress", 70)], "2026-10-06T09:00", "2026-10-08T10:00", "medium"),
  T("TSK-2050", "Client", "Vendor SLA review, Madurai", "Madurai regional office", "individual", [A("e12", "Tirunelveli office", "assigned", 0)], "2026-10-09T07:30", "2026-10-09T19:30", "high"),
  T("TSK-2054", "Logistics", "Warehouse stock count", "Gangaikondan warehouse", "team-any", [A("e5", "Tirunelveli office", "in-progress", 20), A("e10", "Tirunelveli office", "assigned", 0)], "2026-10-09T09:00", "2026-10-09T17:00", "low"),
  // waiting in the queue: nobody owns these yet
  T("TSK-2071", "Client", "Onboarding visit, Kumar Textiles", "Kumar Textiles, Palayamkottai", "individual", [], "2026-10-09T10:00", "2026-10-12T16:00", "high"),
  T("TSK-2072", "Field visit", "Meter installation check", "Vannarpettai", "individual", [], "2026-10-08T15:00", "2026-10-08T19:00", "medium"),
  T("TSK-2073", "Logistics", "Hardware delivery to Sankarankovil", "Sankarankovil", "individual", [], "2026-10-09T09:00", "2026-10-09T18:00", "low"),
  T("TSK-2074", "Admin", "Renew trade licence", "Tirunelveli Corporation office", "individual", [], "2026-10-08T10:00", "2026-10-08T13:00", "high"),
  T("TSK-2075", "Engineering", "Load test on the staging cluster", "Staging environment", "team-all", [], "2026-10-09T09:00", "2026-10-10T13:00", "medium"),
  T("TSK-2038", "Field visit", "Network cabling check, Tirunelveli Junction", "Tirunelveli Junction", "individual", [A("e2", "Tirunelveli office", "late-done", 100, "2026-10-05T12:55")], "2026-10-05T09:30", "2026-10-05T12:30", "medium"),
  T("TSK-2036", "Client", "Release sign-off, client office", "Client office, Palayamkottai", "individual", [A("e1", "Tirunelveli office", "on-time", 100, "2026-10-06T15:40")], "2026-10-06T09:00", "2026-10-06T16:00", "high"),
  T("TSK-2052", "Admin", "KYC visit, bank branch", "Kokkirakulam", "individual", [A("e3", "Tirunelveli office", "assigned", 0)], "2026-10-07T10:00", "2026-10-07T13:00", "low", "revoked", [
    { at: "2026-10-07T04:10:00Z", actor: "Maya Raj", text: "Revoked. The bank visit was handled online." },
  ]),
  T("TSK-2053", "Logistics", "Courier parcel pickup (duplicate)", "Tirunelveli Junction", "individual", [A("e10", "Home", "assigned", 0)], "2026-10-07T11:00", "2026-10-07T15:00", "low", "deleted", [
    { at: "2026-10-07T05:00:00Z", actor: "Farah Nizam", text: "Deleted as a duplicate of TSK-2044." },
  ]),
];

function load(): TaskItem[] {
  try {
    const raw = safeGet(LS);
    if (!raw) return SEEDS;
    const saved = JSON.parse(raw) as TaskItem[];
    if (!Array.isArray(saved)) return SEEDS;
    return [...SEEDS.map((s) => saved.find((x) => x.id === s.id) ?? s), ...saved.filter((x) => !SEEDS.some((s) => s.id === x.id))];
  } catch {
    return SEEDS;
  }
}

export type TaskDraft = Pick<TaskItem, "category" | "title" | "destination" | "mode" | "assignees" | "start" | "due" | "priority"> &
  Partial<Pick<TaskItem, "company" | "department" | "location" | "instructions" | "teamIds">>;

interface TaskState {
  tasks: TaskItem[];
  create: (d: TaskDraft, actor: string) => TaskItem;
  update: (id: string, d: TaskDraft, actor: string, reason?: string) => void;
  setLifecycle: (id: string, lifecycle: Lifecycle, actor: string, note?: string) => void;
  setAssignee: (id: string, empId: string, patch: Partial<Assignee>, actor: string, text: string) => void;
  /** replace who owns a task (assign, reassign, unassign); the history line explains why */
  setAssignees: (id: string, assignees: Assignee[], actor: string, text: string) => void;
}

export const useTasks = create<TaskState>((set, get) => {
  const commit = (tasks: TaskItem[]) => {
    set({ tasks });
    safeSet(LS, JSON.stringify(tasks));
  };
  const ev = (actor: string, text: string): TaskEvent => ({ at: new Date().toISOString(), actor, text });
  return {
    tasks: load(),
    create: (d, actor) => {
      const list = get().tasks;
      const n = list.reduce((m, t) => Math.max(m, Number(t.code.slice(4)) || 0), 2054) + 1;
      const item: TaskItem = { ...d, id: `tsk-${n}`, code: `TSK-${n}`, lifecycle: "live", history: [ev(actor, d.assignees.length ? "Task created and assigned." : "Task created. Waiting for an owner.")] };
      commit([...list, item]);
      return item;
    },
    update: (id, d, actor, reason) => commit(get().tasks.map((t) => (t.id === id ? { ...t, ...d, history: [...t.history, ev(actor, `Task edited.${reason ? ` ${reason}` : ""}`)] } : t))),
    setLifecycle: (id, lifecycle, actor, note) =>
      commit(get().tasks.map((t) => (t.id === id ? { ...t, lifecycle, history: [...t.history, ev(actor, `${lifecycle === "live" ? "Restored" : lifecycle === "revoked" ? "Revoked" : "Deleted"}${note ? `. ${note}` : "."}`)] } : t))),
    setAssignee: (id, empId, patch, actor, text) =>
      commit(get().tasks.map((t) => (t.id === id ? { ...t, assignees: t.assignees.map((a) => (a.empId === empId ? { ...a, ...patch } : a)), history: [...t.history, ev(actor, text)] } : t))),
    setAssignees: (id, assignees, actor, text) =>
      commit(get().tasks.map((t) => (t.id === id ? { ...t, assignees, history: [...t.history, ev(actor, text)] } : t))),
  };
});

export const taskByCode = (list: TaskItem[], code: string) => list.find((t) => t.code === code);
