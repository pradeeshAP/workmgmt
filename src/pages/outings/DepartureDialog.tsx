import { useEffect, useState } from "react";
import { safeSet } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES } from "@/store/data";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";
import { BigTime } from "@/components/kit/BigTime";
import { Field, Input, Textarea } from "@/components/kit/forms";
import { rememberedReviewer } from "@/pages/permissions/model";
import { fmtMin } from "@/lib/engine";
import { toMin, validTime } from "./model";
import { useOutings } from "./store";

/** Record the moment someone left for an approved outing, when the check-out punch is missing or late. */
export function DepartureDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const outings = useOutings((s) => s.outings);
  const apply = useOutings((s) => s.apply);
  const toast = useApp((s) => s.toast);
  const [time, setTime] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  const live = outings.find((o) => o.id === id) ?? null;
  const [last, setLast] = useState(live);
  useEffect(() => { if (live) setLast(live); }, [live]);
  useEffect(() => {
    if (!id) return;
    const o = outings.find((x) => x.id === id);
    setTime(o?.reqOut ?? "");
    setReviewer(rememberedReviewer());
    setNote("");
    setTried(false);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const o = live ?? last;
  if (!o) return null;
  const emp = EMPLOYEES.find((e) => e.id === o.employeeId);
  const diff = validTime(time) ? toMin(time) - toMin(o.reqOut) : 0;
  const err = {
    time: tried && !validTime(time) ? "Enter the time as HH:MM." : "",
    reviewer: tried && reviewer.trim().length < 2 ? "Enter your name for the record." : "",
    note: tried && Math.abs(diff) > 30 && note.trim().length < 5 ? "Say why the departure is this far from the plan." : "",
  };

  const save = () => {
    setTried(true);
    if (!validTime(time) || reviewer.trim().length < 2 || (Math.abs(diff) > 30 && note.trim().length < 5)) return;
    safeSet("ascending.reviewer", reviewer.trim());
    apply(o.id, { state: "away", action: `Recorded the departure at ${time}`, actor: reviewer.trim(), note: note.trim() || undefined, patch: { actualOut: time } });
    toast("success", `${emp?.name ?? "The employee"} is away from ${time}. The return starts the review.`);
    onClose();
  };

  return (
    <Modal
      open={!!live && live.state === "plan-approved"}
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      title="Record outing departure"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={save}>Record departure</button>}
    >
      <div className="space-y-3">
        <Field label="Left at" required error={err.time}>
          <BigTime value={time} onChange={setTime} />
        </Field>
        {validTime(time) && diff !== 0 && (
          <Callout kind={Math.abs(diff) > 30 ? "warning" : "info"} lead={`${fmtMin(Math.abs(diff))} ${diff > 0 ? "after" : "before"} the requested ${o.reqOut}`} />
        )}
        <Field label="Recorded by" required error={err.reviewer}><Input value={reviewer} maxLength={60} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" /></Field>
        <Field label="Note" required={Math.abs(diff) > 30} optional={Math.abs(diff) <= 30} error={err.note}><Textarea value={note} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="Added to the history" /></Field>
      </div>
    </Modal>
  );
}
