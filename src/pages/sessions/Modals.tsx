import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Lock } from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { toMin } from "@/lib/engine";
import { navigate } from "@/lib/useHashRoute";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";
import { CheckboxCard, Field, Input, NumberInput, Select, Textarea } from "@/components/kit/forms";
import { BigTime } from "@/components/kit/BigTime";
import { cn } from "@/lib/utils";
import { BUSINESS_CREDIT, CHECK_IN_MODES, FINAL_REASON, REASON_CHIPS, type SessionPolicy } from "./data";

import { applyPunch, type Session } from "./model-core";
import type { SessionDay } from "./model";
import { useSessions } from "./store";

const clock = (m: number) => fmtClock(((m % 1440) + 1440) % 1440);

/* ------------------------------ record a punch ------------------------------ */
export function PunchModal({ open, onClose, day }: { open: boolean; onClose: () => void; day: SessionDay }) {
  const { toast } = useApp();
  const { person, sessions, policy, state, used, tasks, nextStep, commit, date } = day;
  const shift = person.shift;
  const type = state === "in" ? "out" : "in";
  const last = sessions.reduce((n, s) => Math.max(n, s.outMin ?? s.inMin), -1);

  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTried(false);
    // the practice lab suggests its next scripted step; everyone else starts half an hour after the last punch
    const suggested = nextStep ? toMin(nextStep.at) : last >= 0 ? last + 30 : shift?.start ?? 540;
    setTime(clock(suggested));
    setReason(nextStep?.type === "out" ? nextStep.reason ?? "" : "");
    setNote(nextStep?.note ?? "");
    setTaskId("");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!shift) return null;

  // a clock time earlier than the shift start belongs to the next day on overnight shifts
  const raw = time ? toMin(time) : null;
  const at = raw === null ? null : shift.end > 1440 && raw < shift.start ? raw + 1440 : raw;

  const error = {
    time: !tried ? "" : at === null ? "Enter a time." : at <= last ? `Must be after the last punch at ${clock(last)}.` : "",
    reason: tried && type === "out" && policy.exitReason === "Required" && !reason ? "This policy needs an exit reason." : "",
  };
  const lastAllowed = type === "out" && used >= policy.allowed;

  const submit = () => {
    setTried(true);
    if (at === null || at <= last || (type === "out" && policy.exitReason === "Required" && !reason)) return;
    commit(applyPunch(person.rec, person.key, date, { type, at, reason, taskId: type === "out" ? taskId : "", note: type === "out" ? note.trim() : "" }));
    toast("success", type === "in" ? (used === 0 ? "First check-in recorded." : "Return check-in recorded.") : reason === FINAL_REASON || lastAllowed ? "Final check-out recorded. The day is closed." : "Check-out recorded. The next entry is the return.");
    onClose();
  };

  const title = type === "out" ? "Record check-out" : used === 0 ? "Record first check-in" : "Record return check-in";
  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={title}
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={submit}>{title}</button>}
    >
      <div className="space-y-3.5">
        <Field label={type === "out" ? "Check-out time" : "Check-in time"} required error={error.time}>
          <BigTime value={time} onChange={setTime} />
        </Field>
        {type === "out" && (
          <>
            <Field label="Why are you leaving?" required={policy.exitReason === "Required"} optional={policy.exitReason === "Optional"} error={error.reason}>
              <div role="radiogroup" aria-label="Exit reason" className="flex flex-wrap gap-1.5">
                {REASON_CHIPS.map((c) => {
                  const on = reason === c.value;
                  return (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setReason(on && policy.exitReason === "Optional" ? "" : c.value)}
                      className={cn("inline-flex h-8 items-center rounded-input border px-3 text-[12.5px] font-semibold transition-colors duration-150", on ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2")}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Linked task" optional>
              <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} options={[{ value: "", label: tasks.length ? "No linked task" : "No task is assigned to this day" }, ...tasks.map((t) => ({ value: t.id, label: `${t.code} · ${t.title}` }))]} />
            </Field>
            <Field label="Exit note" optional>
              <Textarea value={note} rows={2} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={reason === "Business task" ? "Where you are going, e.g. Palayamkottai" : "Anything the record should say"} />
            </Field>
            {(reason === FINAL_REASON || lastAllowed) && (
              <Callout kind="lock" lead="This closes the day" />
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------ create a policy ------------------------------ */
export function PolicyModal({ open, onClose, day }: { open: boolean; onClose: () => void; day: SessionDay }) {
  const { toast } = useApp();
  const { customPolicies, addPolicy, assignPolicy, setPracticePolicy } = useSessions();
  const { person, isPractice, punches, policies } = day;
  const canAssign = !isPractice || punches === 0;

  const [name, setName] = useState("");
  const [mode, setMode] = useState<string>(CHECK_IN_MODES[0]);
  const [allowed, setAllowed] = useState<number | null>(3);
  const [exit, setExit] = useState<SessionPolicy["exitReason"]>("Required");
  const [assign, setAssign] = useState(true);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setMode(CHECK_IN_MODES[0]); setAllowed(3); setExit("Required"); setAssign(true); setTried(false); }
  }, [open]);

  const taken = policies.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());
  const errors = {
    name: !tried ? "" : name.trim().length < 3 ? "Give the policy a name of at least 3 characters." : taken ? "A policy with this name already exists." : "",
    allowed: !tried ? "" : !allowed || allowed < 1 ? "Allow at least one session." : "",
  };

  const submit = () => {
    setTried(true);
    if (name.trim().length < 3 || taken || !allowed) return;
    const policy: SessionPolicy = { id: `custom-${customPolicies.length + 1}-${Date.now()}`, name: name.trim(), checkInMode: mode, allowed, exitReason: exit };
    addPolicy(policy);
    if (assign && canAssign) {
      if (isPractice) setPracticePolicy(policy.id);
      else assignPolicy(person.emp.id, policy.id);
    }
    toast("success", assign && canAssign ? `${policy.name} created and assigned to ${person.emp.name}.` : `${policy.name} created.`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title="Create a policy"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={<button className="btn btn-primary" onClick={submit}>Create policy</button>}
    >
      <div className="space-y-3">
        <Field label="Policy name" required error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site engineers" maxLength={40} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Check-in mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value)} options={CHECK_IN_MODES.map((m) => ({ value: m, label: m }))} />
          </Field>
          <Field label="Sessions allowed per day" required error={errors.allowed}>
            <NumberInput value={allowed} onChange={setAllowed} min={1} max={8} />
          </Field>
        </div>
        <Field label="Exit reason">
          <Select value={exit} onChange={(e) => setExit(e.target.value as SessionPolicy["exitReason"])} options={[{ value: "Required", label: "Required on every check-out" }, { value: "Optional", label: "Optional" }]} />
        </Field>
        <div className="rounded-input border border-line bg-surface-2 p-3">
          <div className="eyebrow mb-1.5">Fixed for every policy</div>
          <dl className="space-y-1.5 text-body">
            <div className="flex justify-between gap-3"><dt className="text-muted">Business credit</dt><dd className="font-semibold text-ink">{BUSINESS_CREDIT}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Return after final exit</dt><dd className="inline-flex items-center gap-1 font-semibold text-ink"><Lock className="h-3.5 w-3.5 text-ink-2" aria-hidden />Blocked</dd></div>
          </dl>
        </div>
        {canAssign && <CheckboxCard checked={assign} onChange={setAssign} title={`Assign to ${person.emp.name}`} />}
      </div>
    </Modal>
  );
}

/* ------------------------------ link a task ------------------------------ */
export function LinkTaskModal({ session, onClose, day }: { session: Session | null; onClose: () => void; day: SessionDay }) {
  const { toast } = useApp();
  const { person, tasks, commit } = day;
  const [taskId, setTaskId] = useState("");
  useEffect(() => { if (session) setTaskId(session.pair.taskId); }, [session]);

  return (
    <Modal
      open={!!session}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title="Link gap to task"
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
      primary={
        <button
          className="btn btn-primary"
          onClick={() => {
            if (!session) return;
            commit({ ...person.rec, pairs: person.rec.pairs.map((p) => (p.id === session.pair.id ? { ...p, taskId } : p)) });
            toast("success", taskId ? "Task linked to the session." : "Task unlinked from the session.");
            onClose();
          }}
        >
          Save link
        </button>
      }
    >
      <div className="space-y-3">
        {session?.away && (
          <section aria-label="Gap" className="rounded-input border border-line bg-surface-2 p-3">
            <div className="eyebrow mb-1.5">The gap</div>
            <div className="tnum flex flex-wrap items-center gap-x-2 text-h2 text-ink">
              <span>Out {fmtClock(session.away.from)}</span>
              <ArrowRight className="h-4 w-4 text-faint" aria-hidden />
              <span>{session.away.to === null ? "no return yet" : `Return ${fmtClock(session.away.to)}`}</span>
            </div>
            <p className="tnum mt-1 text-body text-muted">
              {fmtDuration(session.away.total)} away{session.away.breakMin > 0 ? ` · ${fmtDuration(session.away.breakMin)} of it is the shift break` : ""} · exit: {session.pair.reason || "no reason"}
            </p>
          </section>
        )}
        <Field label="Task">
          <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} options={[{ value: "", label: "No linked task" }, ...tasks.map((t) => ({ value: t.id, label: `${t.code} · ${t.title}` }))]} />
        </Field>
        {tasks.length === 0 && <Callout kind="info" lead="No tasks are assigned to this day" />}
      </div>
    </Modal>
  );
}

/* ------------------------------ review time away ------------------------------ */
export function ReviewModal({ session, onClose, day, onCorrect, onLink }: { session: Session | null; onClose: () => void; day: SessionDay; onCorrect: () => void; onLink: (s: Session) => void }) {
  const a = session?.away;
  const rows = useMemo(
    () =>
      a
        ? [
            ["Time away", fmtDuration(a.total)],
            ["Shift break", fmtDuration(a.breakMin)],
            ["Business duty credit", fmtDuration(a.duty)],
            ["Permission credit", fmtDuration(a.permission)],
            ["Pending, no credit yet", fmtDuration(a.pending)],
            ["Uncovered", fmtDuration(a.gap)],
          ]
        : [],
    [a]
  );

  const lead = !a ? "" : a.awaiting ? "The return check-in is not recorded." : a.gap > 0 ? "Nothing approved covers part of this time." : a.pending > 0 ? "A pending request covers this time, but pending requests earn no credit." : "This time is accounted for.";
  const body = !a ? "" : a.awaiting
    ? `Record the return when ${day.person.emp.name} is back. Until then the time stays unresolved.`
    : a.gap > 0
      ? "Ask for a permission request and have HR approve it, or correct the punches if they were entered wrongly."
      : a.pending > 0
        ? "Credit starts when HR approves the request in the Permission desk."
        : "No action is needed.";

  return (
    <Modal
      open={!!session && !!a}
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={session ? `Review session ${String(session.n).padStart(2, "0")} away time` : "Review away time"}
      secondary={<button className="btn" onClick={() => { onClose(); onCorrect(); }}>Correct punches</button>}
      primary={
        <button className="btn btn-primary" onClick={() => { onClose(); navigate("/permissions"); }}>
          Open Permission desk <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      }
    >
      <div className="space-y-3">
        <Callout kind={a && (a.gap > 0 || a.awaiting) ? "warning" : "info"} lead={lead}>{body}</Callout>
        <dl className="divide-y divide-line rounded-input border border-line">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-3 py-1.5 text-body">
              <dt className="text-muted">{k}</dt>
              <dd className="tnum font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        {session && session.pair.reason === "Business task" && !session.pair.taskId && (
          <button className="btn w-full" onClick={() => { onClose(); onLink(session); }}>Link a task to this session</button>
        )}
      </div>
    </Modal>
  );
}
