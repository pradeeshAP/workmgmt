import { useCallback, useMemo } from "react";
import { useApp } from "@/store/useApp";
import { SHIFTS, TODAY, type PermissionRequest } from "@/store/data";
import { computeDay, toTimelineRow, type AttRecord } from "@/lib/engine";
import { useDayModel, type PersonDay } from "@/pages/timeline/model";
import { PRACTICE_ID, PRACTICE_STEPS, TASK_META, defaultPolicyId, practicePermissions, type TaskMeta } from "./data";
import { buildEvents, buildSessions, dayState, rebasePairs } from "./model-core";
import { allPolicies, useSessions } from "./store";

export const DEFAULT_EMPLOYEE = "e2";

export function useSessionDay() {
  const filters = useApp((s) => s.filters);
  const permissions = useApp((s) => s.permissions);
  const saveAttendance = useApp((s) => s.saveAttendance);
  const { all } = useDayModel();
  const { customPolicies, assignments, practicePairs, practicePolicyId, setPracticePairs } = useSessions();

  const empId = filters.employee || DEFAULT_EMPLOYEE;
  const date = filters.date;
  const isPractice = empId === PRACTICE_ID;

  const model = useMemo(() => {
    const base = all.find((p) => p.emp.id === empId) ?? all[0];
    const policies = allPolicies(customPolicies);
    const policyId = isPractice ? practicePolicyId : assignments[base.emp.id] ?? defaultPolicyId(base.emp.dept);
    const policy = policies.find((p) => p.id === policyId) ?? policies[0];

    let person: PersonDay = base;
    let perms: PermissionRequest[] = permissions.filter((p) => p.employeeId === base.emp.id && p.date === date);
    if (isPractice) {
      // the practice account is a sandbox: its punches never reach the real attendance records
      const shift = SHIFTS.find((s) => s.id === "general") ?? null;
      perms = practicePermissions(date);
      const pairs = rebasePairs(practicePairs, TODAY, date);
      const rec: AttRecord = { status: pairs.length ? "working" : "unmarked", pairs, note: "", approveExtra: false };
      const res = computeDay(shift, rec, perms, date);
      person = { emp: base.emp, key: `${base.emp.id}|${date}`, date, shift, rec, res, row: toTimelineRow(base.emp.id, base.emp.name, base.emp.dept, shift, res, rec) };
    }

    const sessions = buildSessions(person.rec, person.shift, perms, date, policy.allowed);
    const state = dayState(person.rec, sessions, policy.allowed);
    const punches = sessions.length * 2 - sessions.filter((s) => s.outMin === null).length;
    const future = date > TODAY;

    const linked = new Set(sessions.map((s) => s.pair.taskId).filter(Boolean));
    const lastOut = [...sessions].reverse().find((s) => s.outMin !== null)?.outMin;
    const tasks: TaskMeta[] = TASK_META
      .filter((t) => (t.employeeId === person.emp.id && (t.date === date || t.date === "*")) || linked.has(t.id))
      .map((t) => {
        if (!isPractice) return t;
        // the practice tasks follow the day: linked while it runs, done once it closes
        if (!linked.has(t.id)) return t;
        return state === "closed" && lastOut != null
          ? { ...t, status: "on-time" as const, progress: 100, completed: `${String(Math.floor((lastOut % 1440) / 60)).padStart(2, "0")}:${String(lastOut % 60).padStart(2, "0")}` }
          : { ...t, status: "in-progress" as const, progress: 60 };
      })
      .sort((a, b) => a.due.localeCompare(b.due));

    return {
      person, perms, policy, policies, sessions, state, punches, future, tasks,
      used: sessions.length,
      events: buildEvents(sessions),
      canRecord: !!person.shift && !future && state !== "closed",
      nextStep: isPractice ? PRACTICE_STEPS[punches] : undefined,
    };
  }, [all, empId, date, isPractice, customPolicies, assignments, practicePairs, practicePolicyId, permissions]);

  /** Save a changed record: the practice sandbox in memory, everyone else to attendance. */
  const commit = useCallback(
    (rec: AttRecord) => {
      if (isPractice) setPracticePairs(rebasePairs(rec.pairs, date, TODAY));
      else saveAttendance(model.person.key, rec);
    },
    [isPractice, date, model.person.key, saveAttendance, setPracticePairs]
  );

  return { ...model, empId, date, isPractice, commit };
}

export type SessionDay = ReturnType<typeof useSessionDay>;
