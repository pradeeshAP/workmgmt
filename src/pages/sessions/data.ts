import { TODAY, type Dept } from "@/store/data";
import type { TaskStatus } from "@/components/kit/Status";

/* ------------------------------ policies ------------------------------ */
export const EXIT_REASONS = ["Break", "Business task", "Personal permission", "End of shift", "Other"] as const;
/** A check-out with this reason is the final exit: the day closes and a return is blocked. */
export const FINAL_REASON = "End of shift";
/** What the check-out chips say, and the reason each one records. */
export const REASON_CHIPS: { value: string; label: string }[] = [
  { value: "Business task", label: "Business task" },
  { value: "Personal permission", label: "Personal" },
  { value: "Break", label: "Break" },
  { value: FINAL_REASON, label: "Final check-out" },
  { value: "Other", label: "Other" },
];
export const CHECK_IN_MODES = ["Self check-in", "Supervisor entry", "Kiosk or biometric"] as const;

export interface SessionPolicy {
  id: string;
  name: string;
  checkInMode: string;
  /** punch pairs (sessions) allowed per day */
  allowed: number;
  exitReason: "Required" | "Optional";
  builtIn?: boolean;
}

export const BUILT_IN_POLICIES: SessionPolicy[] = [
  { id: "standard", name: "Office standard", checkInMode: "Self check-in", allowed: 3, exitReason: "Required", builtIn: true },
  { id: "field", name: "Field & flexible duty", checkInMode: "Self check-in", allowed: 4, exitReason: "Required", builtIn: true },
  { id: "split", name: "Split shift", checkInMode: "Kiosk or biometric", allowed: 2, exitReason: "Required", builtIn: true },
  { id: "single", name: "Single session", checkInMode: "Kiosk or biometric", allowed: 1, exitReason: "Optional", builtIn: true },
];

export const defaultPolicyId = (dept: Dept) => (dept === "Operations" ? "field" : "standard");

/** Credit for time away is always granted after HR approval, never by the punch alone. */
export const BUSINESS_CREDIT = "After HR approval";

/* ------------------------------ tasks ------------------------------ */
export interface TaskMeta {
  /** matches the id in store/data TASKS, which is what a punch pair links to */
  id: string;
  code: string;
  category: string;
  title: string;
  employeeId: string;
  /** ISO date, or "*" for the practice account on any day */
  date: string;
  status: TaskStatus;
  progress: number;
  /** HH:MM */
  due: string;
  completed?: string;
}

export const PRACTICE_ID = "e12";

export const TASK_META: TaskMeta[] = [
  { id: "t1", code: "TSK-2041", category: "Field visit", title: "Client visit, Palayamkottai", employeeId: "e2", date: TODAY, status: "in-progress", progress: 60, due: "17:00" },
  { id: "t5", code: "TSK-2045", category: "Engineering", title: "Staging smoke tests", employeeId: "e2", date: TODAY, status: "on-time", progress: 100, due: "16:00", completed: "15:20" },
  { id: "t2", code: "TSK-2042", category: "Engineering", title: "Release preparation", employeeId: "e1", date: TODAY, status: "on-time", progress: 100, due: "17:00", completed: "16:40" },
  { id: "t6", code: "TSK-2046", category: "Admin", title: "Bank deposit run", employeeId: "e1", date: TODAY, status: "late-done", progress: 100, due: "11:30", completed: "12:10" },
  { id: "t3", code: "TSK-2043", category: "Field visit", title: "Site survey, Tenkasi", employeeId: "e5", date: TODAY, status: "in-progress", progress: 35, due: "21:00" },
  { id: "t4", code: "TSK-2044", category: "Logistics", title: "Vendor pickup", employeeId: "e10", date: TODAY, status: "late-done", progress: 100, due: "18:30", completed: "19:10" },
  { id: "t9", code: "TSK-2038", category: "Field visit", title: "Network cabling check, Tirunelveli Junction", employeeId: "e2", date: "2026-10-05", status: "late-done", progress: 100, due: "12:30", completed: "12:55" },
  { id: "t10", code: "TSK-2036", category: "Client", title: "Release sign-off, client office", employeeId: "e1", date: "2026-10-06", status: "on-time", progress: 100, due: "16:00", completed: "15:40" },
  { id: "t7", code: "TSK-9001", category: "Field visit", title: "Practice site visit", employeeId: PRACTICE_ID, date: "*", status: "assigned", progress: 0, due: "12:00" },
  { id: "t8", code: "TSK-9002", category: "Logistics", title: "Practice parts pickup", employeeId: PRACTICE_ID, date: "*", status: "assigned", progress: 0, due: "16:00" },
];
export const taskMeta = (id: string) => TASK_META.find((t) => t.id === id);

/* ------------------------------ practice lab ------------------------------ */
export interface PracticeStep {
  at: string;
  type: "in" | "out";
  label: string;
  reason?: string;
  note?: string;
}

/** Four sessions, eight punches: 09–11, 12–13, 14–16 and 16:30–18:00. */
export const PRACTICE_STEPS: PracticeStep[] = [
  { at: "09:00", type: "in", label: "First check-in" },
  { at: "11:00", type: "out", label: "Check-out · business task", reason: "Business task", note: "Palayamkottai" },
  { at: "12:00", type: "in", label: "Return check-in" },
  { at: "13:00", type: "out", label: "Check-out · break", reason: "Break" },
  { at: "14:00", type: "in", label: "Return check-in" },
  { at: "16:00", type: "out", label: "Check-out · permission", reason: "Personal permission", note: "Bank visit" },
  { at: "16:30", type: "in", label: "Return check-in" },
  { at: "18:00", type: "out", label: "Final check-out", reason: FINAL_REASON },
];

/** HR decisions that already exist for the practice day, so credit can be shown next to the punches. */
export const practicePermissions = (date: string) => [
  { id: "pp1", employeeId: PRACTICE_ID, date, from: "11:00", to: "12:00", kind: "Business duty" as const, reason: "Client site visit", status: "approved" as const },
  { id: "pp2", employeeId: PRACTICE_ID, date, from: "16:00", to: "16:30", kind: "Personal" as const, reason: "Bank visit", status: "approved" as const },
];
