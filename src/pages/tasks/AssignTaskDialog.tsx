import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, empCode } from "@/store/data";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";
import { SegmentedControl } from "@/components/kit/Segmented";
import { EmployeePicker, Field, Input } from "@/components/kit/forms";
import { rememberedReviewer } from "@/pages/permissions/model";
import { safeSet } from "@/lib/utils";
import { useTasks, type TaskItem } from "./store";

type Act = "assign" | "unassign";
const ORIGIN = "Tirunelveli office";
const name = (id: string) => EMPLOYEES.find((e) => e.id === id)?.name ?? id;

/** Assign, move or unassign: pick who owns the task now. People who stay keep their progress. */
export function AssignTaskDialog({ task, onClose }: { task: TaskItem | null; onClose: () => void }) {
  const setAssignees = useTasks((s) => s.setAssignees);
  const toast = useApp((s) => s.toast);
  const [act, setAct] = useState<Act>("assign");
  const [people, setPeople] = useState<string[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const [last, setLast] = useState(task);
  useEffect(() => {
    if (!task) return;
    setLast(task);
    setAct("assign");
    setPeople(task.assignees.map((a) => a.empId));
    setReviewer(rememberedReviewer());
    setNote("");
    setTried(false);
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = task ?? last;
  const PEOPLE = useMemo(() => EMPLOYEES.map((e) => ({ id: e.id, name: e.name, sub: `${empCode(e.id)} · ${e.dept} · ${e.role}` })), []);
  if (!t) return null;

  const chosen = act === "unassign" ? [] : people;
  const before = t.assignees.map((a) => a.empId);
  const added = chosen.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !chosen.includes(id));
  const err = {
    people: tried && act === "assign" && people.length === 0 ? "Choose at least one person, or switch to Unassign." : tried && act === "assign" && t.mode === "individual" && people.length > 1 ? "An individual task has one owner. Choose one person." : "",
    reviewer: tried && reviewer.trim().length < 2 ? "Enter your name for the history." : "",
  };
  const unchanged = added.length === 0 && removed.length === 0;

  const save = () => {
    setTried(true);
    if (reviewer.trim().length < 2) return;
    if (act === "assign" && (people.length === 0 || (t.mode === "individual" && people.length > 1))) return;
    if (unchanged) { toast("info", "Nobody changed."); onClose(); return; }
    safeSet("ascending.reviewer", reviewer.trim());
    const next = chosen.map((id) => t.assignees.find((a) => a.empId === id) ?? { empId: id, origin: ORIGIN, outcome: "assigned" as const, progress: 0 });
    const verb = chosen.length === 0 ? "Unassigned" : before.length === 0 ? "Assigned" : "Reassigned";
    const text = `${verb}.${added.length ? ` Now with ${added.map(name).join(", ")}.` : ""}${removed.length ? ` Removed ${removed.map(name).join(", ")}.` : ""}${note.trim() ? ` ${note.trim()}` : ""}`;
    setAssignees(t.id, next, reviewer.trim(), text);
    toast("success", chosen.length === 0 ? `${t.code} is back in the Unassigned queue.` : `${t.code} is now with ${chosen.map(name).join(", ")}.`);
    onClose();
  };

  return (
    <Modal
      open={!!task}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={`${before.length ? "Assign / move" : "Assign"} ${t.code}`}
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={save}>{act === "unassign" ? "Unassign task" : before.length ? "Save owners" : "Assign task"}</button>}
    >
      <div className="space-y-5">
        {before.length > 0 && (
          <SegmentedControl<Act> label="Action" value={act} onChange={setAct} options={[{ value: "assign", label: "Assign or move" }, { value: "unassign", label: "Unassign everyone" }]} />
        )}
        {act === "assign" ? (
          <Field label="Owners" required error={err.people}>
            <EmployeePicker people={PEOPLE} selected={people} onChange={(ids) => setPeople(t.mode === "individual" && ids.length > 1 ? ids.slice(-1) : ids)} />
          </Field>
        ) : (
          <Callout kind="warning" lead={`${t.code} goes back to the Unassigned queue.`} />
        )}
        {!unchanged && act === "assign" && (
          <p className="text-body text-ink-2" aria-live="polite">
            {added.length > 0 && <>Adds <b className="text-ink">{added.map(name).join(", ")}</b>. </>}
            {removed.length > 0 && <>Removes <b className="text-ink">{removed.map(name).join(", ")}</b>.</>}
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Done by" required error={err.reviewer}><Input value={reviewer} maxLength={60} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" /></Field>
          <Field label="Note" optional><Input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="Why the change" /></Field>
        </div>
      </div>
    </Modal>
  );
}
