import { useEffect, useState } from "react";
import { differenceInMinutes } from "date-fns";

import { useApp } from "@/store/useApp";
import { EMPLOYEES } from "@/store/data";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";
import { SegmentedControl } from "@/components/kit/Segmented";
import { DateTimePicker, Field, NumberInput, Textarea } from "@/components/kit/forms";
import { TASK_STATUS } from "@/components/kit/Status";
import { rememberedReviewer } from "@/pages/permissions/model";
import { fmtStamp, isDoneOutcome } from "./model";
import { useTasks, type Outcome, type TaskItem } from "./store";

type Choice = Exclude<Outcome, "on-time" | "late-done"> | "done";
const CHOICES: { value: Choice; label: string }[] = [
  { value: "assigned", label: "Assigned" },
  { value: "in-progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Completed" },
];

const asDate = (s: string) => new Date(`${s}:00Z`);

/** Record where one person has got to on a task. Finishing is judged against the completion time you enter. */
export function ProgressDialog({ task, empId, assessAt, onClose }: { task: TaskItem | null; empId: string | null; assessAt: string; onClose: () => void }) {
  const setAssignee = useTasks((s) => s.setAssignee);
  const toast = useApp((s) => s.toast);
  const [choice, setChoice] = useState<Choice>("in-progress");
  const [pct, setPct] = useState<number | null>(0);
  const [started, setStarted] = useState("");
  const [completed, setCompleted] = useState("");
  const [evidence, setEvidence] = useState("");
  const [tried, setTried] = useState(false);
  const [last, setLast] = useState({ task, empId });
  useEffect(() => { if (task && empId) setLast({ task, empId }); }, [task, empId]);

  const a = task?.assignees.find((x) => x.empId === empId);
  useEffect(() => {
    if (!task || !a) return;
    const done = isDoneOutcome(a.outcome);
    setChoice(done ? "done" : (a.outcome as Choice));
    setPct(done ? 100 : a.progress);
    setStarted(a.startedAt ?? "");
    setCompleted(a.completedAt ?? assessAt);
    setEvidence(a.evidence ?? "");
    setTried(false);
  }, [task?.id, empId]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = task ?? last.task;
  const id = empId ?? last.empId;
  if (!t || !id) return null;
  const name = EMPLOYEES.find((e) => e.id === id)?.name ?? id;
  const fixed = choice === "assigned" || choice === "done";
  const shown = choice === "assigned" ? 0 : choice === "done" ? 100 : pct ?? 0;
  const needsEvidence = choice === "done" || choice === "blocked";

  const left = differenceInMinutes(asDate(t.due), asDate(assessAt));
  const err = {
    evidence: tried && needsEvidence && evidence.trim().length < 5 ? (choice === "done" ? "Say what was delivered, or add a reference." : "Say what is blocking the work.") : "",
    started: tried && started && started > (choice === "done" ? completed : assessAt) ? "Started must be before it finished." : "",
    completed: tried && choice === "done" && (!completed || (started && completed < started)) ? "Enter when it was completed, after it started." : "",
  };

  const save = () => {
    setTried(true);
    if (err.evidence || (needsEvidence && evidence.trim().length < 5)) return;
    if (choice === "done" && (!completed || (started && completed < started))) return;
    if (started && started > (choice === "done" ? completed : assessAt)) return;
    const by = rememberedReviewer() || "HR administrator";
    const base = { startedAt: started || undefined, evidence: evidence.trim() || undefined };
    if (choice === "done") {
      const outcome: Outcome = completed <= t.due ? "on-time" : "late-done";
      setAssignee(t.id, id, { ...base, outcome, progress: 100, completedAt: completed }, by, `${name} completed the task ${outcome === "on-time" ? "on time" : "late"}.${base.evidence ? ` ${base.evidence}` : ""}`);
      toast("success", `${name} completed ${t.code} ${outcome === "on-time" ? "on time" : "late"}.`);
    } else {
      const progress = choice === "assigned" ? 0 : Math.min(99, Math.max(0, pct ?? 0));
      setAssignee(t.id, id, { ...base, outcome: choice, progress, completedAt: undefined }, by, `${name} is now ${TASK_STATUS[choice].label.toLowerCase()}${choice === "assigned" ? "" : ` at ${progress}%`}.${base.evidence ? ` ${base.evidence}` : ""}`);
      toast("success", `${t.code} updated: ${TASK_STATUS[choice].label.toLowerCase()}${choice === "assigned" ? "" : `, ${progress}%`}.`);
    }
    onClose();
  };

  return (
    <Modal
      open={!!task && !!empId}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Update task progress"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={save}>Save progress</button>}
    >
      <div className="space-y-5">
        <p className="text-body font-semibold text-ink">{t.title}</p>
        <Callout kind={left < 0 ? "warning" : "info"} lead={left < 0 ? `Past its deadline of ${fmtStamp(t.due)}.` : `Due ${fmtStamp(t.due)}.`} />

        <Field label="Status">
          <SegmentedControl<Choice>
            label="Status"
            value={choice}
            onChange={(v) => { setChoice(v); if ((v === "in-progress" || v === "blocked") && (pct === 0 || pct === 100 || pct === null)) setPct(50); }}
            options={CHOICES}
            className="max-w-full overflow-x-auto"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="progress-range" className="text-h3 text-ink">Progress</label>
            <div className="w-[150px]"><NumberInput value={shown} onChange={(v) => !fixed && setPct(v === null ? null : Math.min(99, v))} unit="%" min={0} max={choice === "done" ? 100 : 99} step={5} /></div>
          </div>
          <input id="progress-range" type="range" min={0} max={100} step={5} disabled={fixed} value={shown} onChange={(e) => setPct(Math.min(99, Number(e.target.value)))} className="mt-2 w-full accent-[var(--brand)] disabled:opacity-50" />
          <p className="mt-1 text-small text-muted">{choice === "done" ? "Completed work counts as 100%." : choice === "assigned" ? "Not started." : "Drag the slider or type a number."}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Started at" optional error={err.started}><DateTimePicker value={started} baseDate={t.start.slice(0, 10)} onChange={setStarted} /></Field>
          {choice === "done" && <Field label="Completed at" required error={err.completed}><DateTimePicker value={completed} baseDate={t.start.slice(0, 10)} onChange={setCompleted} /></Field>}
        </div>

        <Field label="Outcome / evidence" required={needsEvidence} optional={!needsEvidence} error={err.evidence}>
          <Textarea value={evidence} rows={3} onChange={(e) => setEvidence(e.target.value)} placeholder={choice === "done" ? "What was delivered, who signed it off, any reference" : "Notes for the record"} />
        </Field>
      </div>
    </Modal>
  );
}
