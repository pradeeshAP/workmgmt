import { useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { CircleDashed, Hourglass, Loader2, Lock, LogIn, LogOut, Check } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, TODAY, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Callout, Panel } from "@/components/kit/Blocks";
import { Select, Textarea } from "@/components/kit/forms";
import { Pill, type Def } from "@/components/kit/Status";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { Avatar } from "@/components/ui/primitives";
import { initialsOf } from "@/components/kit/PersonCell";
import { ShiftChip } from "@/pages/timeline/parts";
import { toAccount } from "@/pages/reports/model";
import { FINAL_REASON, REASON_CHIPS } from "@/pages/sessions/data";
import { DEFAULT_EMPLOYEE, useSessionDay } from "@/pages/sessions/model";
import { applyPunch, type DayState } from "@/pages/sessions/model-core";

const STATE: Record<DayState, { pill: Def; line: (since: string | null) => string }> = {
  "not-in": { pill: { label: "Not checked in", tone: "neutral", icon: CircleDashed }, line: () => "You have not started yet." },
  in: { pill: { label: "Checked in", tone: "work", icon: LogIn }, line: (s) => `Working since ${s}.` },
  away: { pill: { label: "Away", tone: "duty", icon: Hourglass }, line: (s) => `Out since ${s}. Check in when you are back.` },
  closed: { pill: { label: "Day closed", tone: "neutral", icon: Lock }, line: () => "Your final check-out is recorded. A return is blocked." },
};

const pad = (n: number) => String(n).padStart(2, "0");
const clockOf = (seconds: number) => {
  const day = Math.floor(seconds / 86400);
  const r = ((seconds % 86400) + 86400) % 86400;
  return { text: `${pad(Math.floor(r / 3600))}:${pad(Math.floor((r % 3600) / 60))}`, secs: pad(r % 60), day };
};

/** The employee screen: one big clock, one big button, and the day's movements beside it. */
export default function MyDayPage({ route }: { route: Route }) {
  const filters = useApp((s) => s.filters);
  const setFilters = useApp((s) => s.setFilters);
  const toast = useApp((s) => s.toast);

  // this screen always shows the sample day, for the person it is opened as
  useEffect(() => { if (filters.date !== TODAY) setFilters({ date: TODAY }); }, [filters.date, setFilters]);
  const day = useSessionDay();
  const { person, sessions, policy, state, used, tasks, commit, date, canRecord } = day;
  const shift = person.shift;
  const last = sessions.reduce((n, s) => Math.max(n, s.outMin ?? s.inMin), -1);
  const open = sessions.find((s) => s.outMin === null);

  // a sample clock: it starts a few minutes after the last punch and ticks in real seconds, so a punch is never earlier than the one before it
  const start = useRef<number | null>(null);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!shift) return;
    start.current = ((last >= 0 ? last + 5 : shift.start - 5) * 60) - Math.floor(performance.now() / 1000);
    setSecs(start.current + Math.floor(performance.now() / 1000));
  }, [shift?.id, person.emp.id, sessions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = window.setInterval(() => { if (start.current !== null) setSecs(start.current + Math.floor(performance.now() / 1000)); }, 1000);
    return () => window.clearInterval(id);
  }, []);
  const now = clockOf(secs);
  const nowMin = Math.floor(secs / 60);

  const [leaving, setLeaving] = useState(false);
  const [reason, setReason] = useState("");
  const [taskId, setTaskId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setLeaving(false); setReason(""); setTaskId(""); setNote(""); }, [person.emp.id, state]);

  const need = policy.exitReason === "Required";
  const lastAllowed = used >= policy.allowed;
  const stateInfo = STATE[state];
  const since = state === "in" && open ? fmtClock(open.inMin) : state === "away" ? fmtClock(last) : null;
  const final = reason === FINAL_REASON || lastAllowed;

  const punch = (type: "in" | "out") => {
    if (!shift) return;
    setBusy(true);
    window.setTimeout(() => {
      commit(applyPunch(person.rec, person.key, date, { type, at: nowMin, reason: type === "out" ? reason : "", taskId: type === "out" ? taskId : "", note: type === "out" ? note.trim() : "" }));
      setBusy(false);
      setLeaving(false);
      toast("success", type === "in" ? `Checked in at ${fmtClock(nowMin)}.` : final ? `Final check-out at ${fmtClock(nowMin)}. Have a good evening.` : `Checked out at ${fmtClock(nowMin)}. Check in when you are back.`);
    }, 350);
  };

  const main = () => {
    if (state === "in") { setLeaving(true); return; }
    punch("in");
  };

  const people = useMemo(() => EMPLOYEES.map((e) => ({ value: e.id, label: `${e.name} · ${empCode(e.id)}` })), []);
  const label = state === "closed" ? "Day closed" : state === "in" ? "Check out" : state === "away" ? "Check in again" : "Check in";
  const needReason = need && !reason;

  return (
    <>
      <PageHead
        route={route}
        filters
        meta={<><b className="font-semibold text-ink">{person.emp.name}</b><Pill def={stateInfo.pill} /></>}
      />
      <FilterBar
        fields={[]}
        extra={{
          active: false,
          onReset: () => undefined,
          node: <label className="flex h-8 items-center gap-1.5 text-small text-muted"><span className="font-medium">Viewing as</span><Select aria-label="Viewing as" className="h-8 w-[240px]" value={person.emp.id || DEFAULT_EMPLOYEE} onChange={(e) => setFilters({ employee: e.target.value })} options={people} /></label>,
        }}
      />

      <PageBody className="mx-auto w-full max-w-[1120px]">
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <section aria-label="The time" className="panel px-5 py-5 text-center">
              <div className="tnum flex items-baseline justify-center gap-1.5 text-ink" role="timer" aria-live="off" aria-label={`${now.text}`}>
                <span className="text-[68px] font-bold leading-none tracking-tighter">{now.text}</span>
                <span className="text-[24px] font-semibold text-muted">{now.secs}</span>
                {now.day > 0 && <span className="chip chip-extra ml-1">+{now.day}</span>}
              </div>
              <p className="mt-1.5 text-body font-medium text-muted">{format(parseISO(date), "EEEE · dd MMM yyyy")}</p>
            </section>

            <section aria-label="Check in or out" className="space-y-2.5">
              <p className="text-center text-body text-ink-2" aria-live="polite">{shift ? stateInfo.line(since) : "Nothing to record."}</p>

              {leaving && (
                <div className="panel space-y-3 p-3.5" role="group" aria-label="Why are you leaving?">
                  <div>
                    <div className="eyebrow mb-1.5">Why are you leaving?{need ? "" : " (optional)"}</div>
                    <div role="radiogroup" aria-label="Exit reason" className="flex flex-wrap gap-1.5">
                      {REASON_CHIPS.map((c) => {
                        const on = reason === c.value;
                        return (
                          <button
                            key={c.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setReason(on && !need ? "" : c.value)}
                            className={cn("inline-flex h-10 items-center rounded-input border px-3.5 text-body font-semibold transition-colors duration-150", on ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-ink-2 active:bg-surface-2")}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="eyebrow">Task</span>
                      <Select aria-label="Task" className="mt-1" value={taskId} onChange={(e) => setTaskId(e.target.value)} options={[{ value: "", label: tasks.length ? "No linked task" : "No task today" }, ...tasks.map((t) => ({ value: t.id, label: `${t.code} · ${t.title}` }))]} />
                    </label>
                    <label className="block">
                      <span className="eyebrow">Note</span>
                      <Textarea aria-label="Exit note" className="mt-1" rows={1} maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Where you are going" />
                    </label>
                  </div>
                  {final && <Callout kind="lock" lead="This closes your day" />}
                  {needReason && <p role="alert" className="text-small font-medium text-gap-ink">Choose why you are leaving.</p>}
                  <div className="grid grid-cols-2 gap-2">
                    <button className="btn !h-11" onClick={() => setLeaving(false)}>Cancel</button>
                    <button className="btn btn-primary !h-11" disabled={needReason || busy} onClick={() => punch("out")}>
                      {busy ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}Confirm check-out
                    </button>
                  </div>
                </div>
              )}

              {!leaving && (
                <button
                  className={cn("btn btn-primary flex !h-[68px] w-full !rounded-[14px] !text-[19px] !font-bold [&_svg]:!h-6 [&_svg]:!w-6", state === "in" && "!bg-gap !bg-none")}
                  style={state === "in" ? { background: "var(--gap)" } : undefined}
                  disabled={!canRecord || busy}
                  onClick={main}
                >
                  {busy ? <Loader2 className="animate-spin" aria-hidden /> : state === "closed" ? <Check aria-hidden /> : state === "in" ? <LogOut aria-hidden /> : <LogIn aria-hidden />}
                  {label}
                </button>
              )}
            </section>
          </div>

          <div className="space-y-3">
            <section aria-label="Your shift" className="panel p-3.5">
              <div className="flex items-center gap-3">
                <Avatar initials={initialsOf(person.emp.name)} size={38} tone="brand" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-h3 text-ink">{person.emp.name}</div>
                  <div className="truncate text-small text-muted">{empCode(person.emp.id)} · {person.emp.role}</div>
                </div>
                <Pill def={stateInfo.pill} />
              </div>
              {shift ? (
                <>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ShiftChip shift={shift} />
                    <span className="tnum text-body font-semibold text-ink">{fmtClock(shift.start)} – {fmtClock(shift.end)}</span>
                    <span className="tnum text-small text-muted">break {fmtClock(shift.breakStart)} – {fmtClock(shift.breakEnd)}</span>
                  </div>
                  <div className="mt-2.5">
                    <TimeAccountBar variant="mini" account={toAccount({ required: person.res.required, work: person.res.work, permission: person.res.permission, duty: person.res.duty, gap: person.res.gap, unresolved: person.res.unresolved })} />
                    <p className="tnum mt-1.5 text-small text-muted">{fmtDuration(person.res.work)} worked of {fmtDuration(person.res.required)} · {policy.name}, session {Math.min(used + (state === "in" || state === "closed" ? 0 : 1), policy.allowed)} of {policy.allowed}</p>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-body text-muted">No shift on this date</p>
              )}
            </section>

            <Panel title="Today’s movement" count={sessions.length * 2 - (open ? 1 : 0) || undefined} flush>
              {sessions.length === 0 ? (
                <p className="px-4 py-6 text-center text-body text-muted">No punches yet</p>
              ) : (
                <ol className="divide-y divide-line">
                  {sessions.flatMap((s, i) => {
                    const code = tasks.find((t) => t.id === s.pair.taskId)?.code;
                    return [
                      <li key={`in-${s.n}`} className="flex min-h-[44px] items-center gap-3 px-3.5 py-2">
                        <LogIn aria-hidden className="h-4 w-4 shrink-0 text-work" />
                        <div className="min-w-0 flex-1"><div className="text-body font-semibold text-ink">{i === 0 ? "First check-in" : "Back in"}</div></div>
                        <span className="tnum text-h3 text-ink">{fmtClock(s.inMin)}</span>
                      </li>,
                      ...(s.outMin !== null
                        ? [
                            <li key={`out-${s.n}`} className="flex min-h-[44px] items-center gap-3 px-3.5 py-2">
                              <LogOut aria-hidden className="h-4 w-4 shrink-0 text-duty" />
                              <div className="min-w-0 flex-1">
                                <div className="text-body font-semibold text-ink">{s.pair.reason === FINAL_REASON ? "Final check-out" : "Check-out"}{s.pair.reason && s.pair.reason !== FINAL_REASON ? ` · ${s.pair.reason}` : ""}</div>
                                {(code || s.pair.note) && <div className="truncate text-small text-muted">{[code, s.pair.note].filter(Boolean).join(" · ")}</div>}
                              </div>
                              <span className="tnum text-h3 text-ink">{fmtClock(s.outMin)}</span>
                            </li>,
                          ]
                        : []),
                    ];
                  })}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
