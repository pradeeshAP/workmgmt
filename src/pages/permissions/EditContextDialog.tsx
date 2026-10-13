import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/store/useApp";
import type { PermissionRequest } from "@/store/data";
import { Modal } from "@/components/kit/Modal";
import { Field, Input, Select, Textarea } from "@/components/kit/forms";
import { useTasks } from "@/pages/tasks/store";
import { rememberedReviewer } from "./model";
import { safeSet } from "@/lib/utils";

/** Change what a request says it was for: the task, the destination and the reference. The credit never changes. */
export function EditContextDialog({ open, req, onClose }: { open: boolean; req: PermissionRequest; onClose: () => void }) {
  const { permissions, setPermissions, toast } = useApp();
  const tasks = useTasks((s) => s.tasks);
  const [code, setCode] = useState("");
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [ref, setRef] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(tasks.some((t) => t.code === req.ref) ? req.ref! : "");
    setPurpose(req.purpose ?? "");
    setDestination(req.destination ?? "");
    setRef(req.ref ?? "");
    setReviewer(rememberedReviewer());
    setNote("");
    setTried(false);
  }, [open, req.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = useMemo(
    () => tasks.filter((t) => t.lifecycle === "live" && t.assignees.some((a) => a.empId === req.employeeId)),
    [tasks, req.employeeId]
  );
  const business = req.kind === "Business duty";
  const err = {
    purpose: tried && purpose.trim().length < 3 ? "Add the task or purpose." : "",
    destination: tried && business && destination.trim().length < 2 ? "A business outing needs a destination." : "",
    reviewer: tried && reviewer.trim().length < 2 ? "Enter your name for the history." : "",
  };

  const pick = (c: string) => {
    setCode(c);
    const t = tasks.find((x) => x.code === c);
    if (t) { setPurpose(t.title); setDestination(t.destination); setRef(t.code); }
  };

  const save = () => {
    setTried(true);
    if (purpose.trim().length < 3 || (business && destination.trim().length < 2) || reviewer.trim().length < 2) return;
    const who = reviewer.trim();
    safeSet("ascending.reviewer", who);
    const changed = [
      (req.purpose ?? "") !== purpose.trim() && "task",
      (req.destination ?? "") !== destination.trim() && "destination",
      (req.ref ?? "") !== ref.trim() && "reference",
    ].filter(Boolean) as string[];
    if (changed.length === 0) { toast("info", "Nothing was changed."); onClose(); return; }
    const event = { status: req.status, actor: who, at: new Date().toISOString(), note: `Edited the ${changed.join(", ")}.${note.trim() ? ` ${note.trim()}` : ""}` };
    setPermissions(
      permissions.map((p) =>
        p.id === req.id ? { ...p, purpose: purpose.trim(), destination: destination.trim() || undefined, ref: ref.trim() || undefined, history: [...(p.history ?? []), event] } : p
      )
    );
    toast("success", "Task and destination saved. The credit is unchanged.");
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Edit task & destination"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={save}>Save changes</button>}
    >
      <div className="space-y-4">
        <Field label="Linked task" optional>
          <Select value={code} onChange={(e) => pick(e.target.value)} options={[{ value: "", label: "No linked task" }, ...mine.map((t) => ({ value: t.code, label: `${t.code} · ${t.title}` }))]} />
        </Field>
        <Field label="Task or purpose" required error={err.purpose}><Input value={purpose} maxLength={60} onChange={(e) => setPurpose(e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Destination" required={business} optional={!business} error={err.destination}><Input value={destination} maxLength={60} onChange={(e) => setDestination(e.target.value)} /></Field>
          <Field label="Reference" optional><Input value={ref} maxLength={30} onChange={(e) => setRef(e.target.value)} /></Field>
        </div>
        <Field label="Edited by" required error={err.reviewer}><Input value={reviewer} maxLength={60} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" /></Field>
        <Field label="Why" optional><Textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Shown in the history" /></Field>
      </div>
    </Modal>
  );
}
