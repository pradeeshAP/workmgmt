import { useCallback, useState, type ReactNode } from "react";
import { AssignTaskDialog } from "./AssignTaskDialog";
import { LifecycleDialog, type LifecycleAction } from "./LifecycleDialog";
import { ProgressDialog } from "./ProgressDialog";
import { navigate } from "@/lib/useHashRoute";
import { useTasks } from "./store";

export interface TaskSubActions {
  edit: (id: string) => void;
  assign: (id: string) => void;
  life: (id: string, action: LifecycleAction) => void;
  progress: (id: string, empId: string) => void;
  teams: () => void;
}

/**
 * The small dialogs that hang off a task: assign, revoke / delete / restore and progress. Editing and teams are screens.
 * Both the Tasks and Kanban screens use them, so the state lives here and each screen renders `node` once.
 */
export function useTaskSub(assessAt: string): { node: ReactNode; actions: TaskSubActions } {
  const tasks = useTasks((s) => s.tasks);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [life, setLife] = useState<{ id: string; action: LifecycleAction } | null>(null);
  const [progress, setProgress] = useState<{ id: string; empId: string } | null>(null);
  const byId = (id: string | null) => tasks.find((t) => t.id === id) ?? null;

  const actions: TaskSubActions = {
    edit: useCallback((id) => {
      // Back and Save lead to the screen the editing started from
      const here = window.location.hash;
      navigate("/task-edit", { id, from: here.includes("/kanban") ? "kanban" : here.includes("/task-manage") ? "manage" : "tasks" });
    }, []),
    assign: useCallback((id) => setAssignId(id), []),
    life: useCallback((id, action) => setLife({ id, action }), []),
    progress: useCallback((id, empId) => setProgress({ id, empId }), []),
    teams: useCallback(() => navigate("/teams"), []),
  };

  const node = (
    <>
      <AssignTaskDialog task={byId(assignId)} onClose={() => setAssignId(null)} />
      <LifecycleDialog task={byId(life?.id ?? null)} action={life?.action ?? null} onClose={() => setLife(null)} />
      <ProgressDialog task={byId(progress?.id ?? null)} empId={progress?.empId ?? null} assessAt={assessAt} onClose={() => setProgress(null)} />
    </>
  );
  return { node, actions };
}
