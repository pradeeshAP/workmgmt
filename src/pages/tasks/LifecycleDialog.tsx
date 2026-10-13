import { useEffect, useState } from "react";
import { safeSet } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";
import { Field, Input, Textarea } from "@/components/kit/forms";
import { rememberedReviewer } from "@/pages/permissions/model";
import { useTasks, type TaskItem } from "./store";

export type LifecycleAction = "revoke" | "delete" | "restore";

const COPY: Record<LifecycleAction, { title: (c: string) => string; subtitle: string; lead: string; body: string; button: string; danger: boolean; reason: "required" | "optional"; done: (c: string) => string }> = {
  revoke: {
    title: (c) => `Revoke ${c}`,
    subtitle: "Withdraw the task without erasing it.",
    lead: "People stop seeing it as work to do.",
    body: "Their progress is kept. Outings already planned for it are not credited until it is restored. You can restore it later.",
    button: "Revoke task", danger: true, reason: "required", done: (c) => `${c} revoked.`,
  },
  delete: {
    title: (c) => `Delete ${c}`,
    subtitle: "Move the task out of every list.",
    lead: "It moves to Deleted and leaves the board and the task list.",
    body: "Outings already recorded for it stay in the register. You can restore it from the Deleted group.",
    button: "Delete task", danger: true, reason: "required", done: (c) => `${c} deleted.`,
  },
  restore: {
    title: (c) => `Restore ${c}`,
    subtitle: "Bring the task back to work on.",
    lead: "It returns to the lists with each person's progress as it was.",
    body: "Deadlines are judged again from now, so a task whose deadline has passed will read Overdue.",
    button: "Restore task", danger: false, reason: "optional", done: (c) => `${c} restored.`,
  },
};

/** Revoke, delete or restore one task, with who did it and why. */
export function LifecycleDialog({ task, action, onClose }: { task: TaskItem | null; action: LifecycleAction | null; onClose: () => void }) {
  const setLifecycle = useTasks((s) => s.setLifecycle);
  const toast = useApp((s) => s.toast);
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [last, setLast] = useState<{ task: TaskItem; action: LifecycleAction } | null>(null);

  useEffect(() => {
    if (task && action) { setLast({ task, action }); setReviewer(rememberedReviewer()); setReason(""); setTried(false); }
  }, [task?.id, action]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = task && action ? { task, action } : last;
  if (!cur) return null;
  const c = COPY[cur.action];
  const needs = c.reason === "required";
  const err = {
    reviewer: tried && reviewer.trim().length < 2 ? "Enter your name for the history." : "",
    reason: tried && needs && reason.trim().length < 5 ? "Add a reason of at least 5 characters." : "",
  };

  const submit = () => {
    setTried(true);
    if (reviewer.trim().length < 2 || (needs && reason.trim().length < 5)) return;
    safeSet("ascending.reviewer", reviewer.trim());
    const next = cur.action === "restore" ? "live" : cur.action === "revoke" ? "revoked" : "deleted";
    setLifecycle(cur.task.id, next, reviewer.trim(), reason.trim() || undefined);
    toast(cur.action === "restore" ? "success" : "info", c.done(cur.task.code));
    onClose();
  };

  return (
    <Modal
      open={!!task && !!action}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={c.title(cur.task.code)}
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className={c.danger ? "btn border-gap bg-gap text-white hover:brightness-95" : "btn btn-primary"} onClick={submit}>{c.button}</button>}
    >
      <div className="space-y-4">
        <p className="text-body font-semibold text-ink">{cur.task.title}</p>
        <Callout kind={c.danger ? "warning" : "info"} lead={c.lead}>{c.body}</Callout>
        <Field label="Reviewer" required error={err.reviewer}><Input value={reviewer} maxLength={60} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" /></Field>
        <Field label="Reason" required={needs} optional={!needs} error={err.reason}><Textarea value={reason} rows={3} onChange={(e) => setReason(e.target.value)} placeholder="Shown in the task history" /></Field>
      </div>
    </Modal>
  );
}
