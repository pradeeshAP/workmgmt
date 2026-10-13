import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowRight, MapPin, Route as RouteIcon, SearchX } from "lucide-react";
import { cn, safeSet } from "@/lib/utils";
import { fmtUtc } from "@/lib/utc";
import { fmtMin } from "@/lib/engine";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, EmptyState, Panel } from "@/components/kit/Blocks";
import { Field, Input, Textarea, TimeInput } from "@/components/kit/forms";
import { PersonCell } from "@/components/kit/PersonCell";
import { Vitals } from "@/components/kit/Vitals";
import { rememberedReviewer } from "@/pages/permissions/model";
import { useTasks } from "@/pages/tasks/store";
import { creditText, figures, levelOf, signed, toMin, validTime, type OutingState } from "./model";
import { useOutings, type OutingChange } from "./store";
import { EstimateBar, ProcessStepper, StatePill, Variance } from "./parts";
import { LinkPunches } from "./LinkPunches";

type Act = "approve" | "clarify" | "decline" | "reply" | "depart" | "return" | "accept" | "correct" | "edit" | "revoke";

const ACTS: Record<Act, { label: string; hint: string; button: string; note: "required" | "optional"; danger?: boolean }> = {
  approve: { label: "Approve the plan", hint: "The estimate is reasonable. The employee may depart.", button: "Approve plan", note: "optional" },
  clarify: { label: "Ask for clarification", hint: "Send a question back before deciding.", button: "Ask for clarification", note: "required" },
  decline: { label: "Decline the plan", hint: "The outing does not go ahead. A note is required.", button: "Decline plan", note: "required", danger: true },
  reply: { label: "Record the employee's reply", hint: "Puts the plan back in the review queue.", button: "Record reply", note: "required" },
  depart: { label: "Record the departure", hint: "Use when the check-out punch is missing.", button: "Record departure", note: "optional" },
  return: { label: "Record the return", hint: "Use when the check-in punch is missing.", button: "Record return", note: "optional" },
  accept: { label: "Accept the actual time", hint: "Credits the elapsed time as approved business duty.", button: "Accept actual time", note: "optional" },
  correct: { label: "Correct the punches", hint: "Fix a wrong time before accepting. A note is required.", button: "Save corrected punches", note: "required" },
  edit: { label: "Edit the accepted punches", hint: "Credit is held until the edit is reviewed again.", button: "Save and send for re-review", note: "required" },
  revoke: { label: "Revoke the outing", hint: "Cancels it. Nothing is credited.", button: "Revoke outing", note: "required", danger: true },
};
const OPTIONS: Record<OutingState, Act[]> = {
  "plan-review": ["approve", "clarify", "decline", "revoke"],
  clarification: ["reply", "decline", "revoke"],
  "plan-approved": ["depart", "revoke"],
  away: ["return", "revoke"],
  "actual-review": ["accept", "correct", "revoke"],
  "re-review": ["accept", "correct", "revoke"],
  "actual-accepted": ["edit"],
  "plan-declined": [],
  revoked: [],
};

const BACK: Record<string, { to: string; label: string }> = {
  outings: { to: "/outings", label: "Outing control" },
  tasks: { to: "/tasks", label: "Tasks & outings" },
  kanban: { to: "/kanban", label: "Employee Kanban" },
};

/** One outing in full: the plan, the evidence, the decision form and the history, each in view without scrolling inside a panel. */
export default function OutingReviewPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const id = q.get("id");
  const back = BACK[q.get("from") ?? "outings"] ?? BACK.outings;
  const outings = useOutings((s) => s.outings);
  const apply = useOutings((s) => s.apply);
  const tasks = useTasks((s) => s.tasks);
  const toast = useApp((s) => s.toast);

  const [act, setAct] = useState<Act | null>(null);
  const [reviewer, setReviewer] = useState("");
  const [note, setNote] = useState("");
  const [tOut, setTOut] = useState("");
  const [tRet, setTRet] = useState("");
  const [tried, setTried] = useState(false);

  const o = outings.find((x) => x.id === id) ?? null;
  const key = o ? `${o.id}|${o.state}` : "";

  // each change of outing or state starts a clean decision
  useEffect(() => {
    if (!o) return;
    setAct(OPTIONS[o.state][0] ?? null);
    setReviewer(rememberedReviewer());
    setNote("");
    setTried(false);
    setTOut(o.actualOut ?? o.reqOut);
    setTRet(o.actualReturn ?? o.reqReturn);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!o) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={SearchX} title="That outing is not here" action={<a className="btn btn-sm" href="#/outings">Back to Outing control</a>} /></Panel></PageBody>
      </>
    );
  }

  const state = o.state;
  const emp = EMPLOYEES.find((e) => e.id === o.employeeId)!;
  const task = tasks.find((t) => t.code === o.taskCode);
  const f = figures(o);
  const options = OPTIONS[state];
  const a = act ? ACTS[act] : null;
  const needsTimes = act === "correct" || act === "edit" || act === "depart" || act === "return";
  const showOut = act === "correct" || act === "edit" || act === "depart";
  const showRet = act === "correct" || act === "edit" || act === "return";

  const timeError =
    !needsTimes ? "" :
    (showOut && !validTime(tOut)) || (showRet && !validTime(tRet)) ? "Enter both times as HH:MM." :
    act === "return" && o.actualOut && toMin(tRet) <= toMin(o.actualOut) ? `The return must be after the departure at ${o.actualOut}.` :
    (act === "correct" || act === "edit") && validTime(tOut) && validTime(tRet) && toMin(tRet) <= toMin(tOut) ? "The return must be after the departure." : "";
  const err = {
    reviewer: tried && reviewer.trim().length < 2 ? "Enter the reviewer's name." : "",
    note: tried && a?.note === "required" && note.trim().length < 5 ? "Add a note for the record (at least 5 characters)." : "",
    time: tried ? timeError : "",
  };

  const submit = () => {
    if (!act || !a) return;
    setTried(true);
    if (reviewer.trim().length < 2 || (a.note === "required" && note.trim().length < 5) || timeError) return;
    const who = reviewer.trim();
    safeSet("ascending.reviewer", who);
    const n = note.trim() || undefined;
    const change: Record<Act, OutingChange> = {
      approve: { state: "plan-approved", action: "Approved the plan", actor: who, note: n, patch: { planReviewer: who } },
      clarify: { state: "clarification", action: "Asked for clarification", actor: who, note: n, patch: { planReviewer: who } },
      decline: { state: "plan-declined", action: "Declined the plan", actor: who, note: n, patch: { planReviewer: who } },
      reply: { state: "plan-review", action: "Recorded the employee's reply", actor: who, note: n },
      depart: { state: "away", action: `Recorded the departure at ${tOut}`, actor: who, note: n, patch: { actualOut: tOut } },
      return: { state: "actual-review", action: `Recorded the return at ${tRet}`, actor: who, note: n, patch: { actualReturn: tRet } },
      accept: { state: "actual-accepted", action: "Accepted the actual time", actor: who, note: n, patch: { actualReviewer: who } },
      correct: { state: state, action: `Corrected the punches to ${tOut} → ${tRet}`, actor: who, note: n, patch: { actualOut: tOut, actualReturn: tRet } },
      edit: { state: "re-review", action: `Edited the punches to ${tOut} → ${tRet}`, actor: who, note: n, patch: { actualOut: tOut, actualReturn: tRet } },
      revoke: { state: "revoked", action: "Revoked the outing", actor: who, note: n },
    };
    apply(o.id, change[act]);
    const msg: Record<Act, string> = {
      approve: `Plan approved. ${emp.name} can depart.`,
      clarify: `Question sent to ${emp.name}.`,
      decline: `Plan declined for ${emp.name}.`,
      reply: "Reply recorded. The plan is back in the review queue.",
      depart: "Departure recorded.",
      return: "Return recorded. The actual time is ready for review.",
      accept: `Accepted. ${fmtMin(f.actual ?? 0)} credited to ${emp.name}.`,
      correct: "Punches corrected.",
      edit: "Punches edited. The outing is back for re-review and credit is on hold.",
      revoke: `${o.id} revoked.`,
    };
    toast(act === "revoke" || act === "decline" ? "info" : "success", msg[act]);
    if (act !== "correct") navigate(back.to);
  };

  const lastHr = [...o.history].reverse().find((h) => h.state === state && h.note);

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={`Outing ${o.id}`}
        meta={<><b className="font-semibold text-ink">{emp.name}</b><StatePill state={state} /></>}
        vitals={
          <Vitals
            items={[
              { tone: "brand", label: "Requested", value: `${o.reqOut} → ${o.reqReturn}`, sub: fmtMin(f.requested) },
              { tone: "work", label: "Estimate", value: fmtMin(f.estimated), sub: `${o.km} km` },
              { tone: "extra", label: "Elapsed", value: f.actual !== null ? fmtMin(f.actual) : "—", sub: o.actualOut ? `${o.actualOut} → ${o.actualReturn ?? "away"}` : "no punches" },
              { tone: f.actVsEst === null ? "neutral" : levelOf(f.actVsEst) === "ok" ? "work" : levelOf(f.actVsEst) === "amber" ? "duty" : "gap", label: "Against estimate", value: f.actVsEst === null ? "—" : signed(f.actVsEst), sub: creditText(o) },
            ]}
          />
        }
      />

      <PageBody>
        <Panel
          flush
          bodyClassName="px-3.5 py-3"
          title={
            <span className="flex flex-wrap items-center gap-x-4 gap-y-1 font-normal text-ink-2">
              <PersonCell name={emp.name} id={emp.id} sub={`${empCode(emp.id)} · ${emp.dept} · ${emp.role}`} />
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted" aria-hidden /><b className="font-semibold text-ink">{o.destination}</b></span>
              <span className="flex items-center gap-1.5"><RouteIcon className="h-3.5 w-3.5 text-muted" aria-hidden /><span className="tnum">{o.km} km</span></span>
              <span className="tnum"><b className="font-semibold text-ink">{o.taskCode}</b>{task ? ` · ${task.title}` : ""}</span>
              <span className="tnum">{format(parseISO(o.date), "EEE dd MMM")}</span>
            </span>
          }
        >
          <ProcessStepper state={state} compact />
        </Panel>

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Panel title="Plan">
              <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <div>
                  <div className="eyebrow">Requested window</div>
                  <div className="tnum mt-0.5 flex items-center gap-2 text-kpi text-ink">{o.reqOut}<ArrowRight className="h-4 w-4 text-faint" aria-hidden />{o.reqReturn}</div>
                  <p className="tnum text-small text-muted">{fmtMin(f.requested)} asked for</p>
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <div><div className="eyebrow">Manual estimate</div><div className="tnum mt-0.5 text-kpi text-ink">{fmtMin(f.estimated)}</div></div>
                    <Variance label="vs request" value={f.reqVsEst} />
                  </div>
                </div>
              </div>
              <div className="mt-3"><EstimateBar est={o.est} labels /></div>
              <div className="mt-3 border-t border-line pt-2.5">
                <div className="eyebrow mb-1">Reason</div>
                <p className="text-body text-ink-2">{o.purpose || "No reason given"}</p>
              </div>
            </Panel>

            <Panel title="Actual evidence" flush>
              <dl className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x max-sm:divide-y">
                {[
                  { label: "Check-out", value: o.actualOut ?? "—", sub: o.actualOut ? `Requested ${o.reqOut}` : state === "plan-approved" ? "Not departed yet" : "No punch" },
                  { label: "Return", value: o.actualReturn ?? (o.actualOut ? "Away" : "—"), sub: o.actualReturn ? `Requested ${o.reqReturn}` : o.actualOut ? "Return pending" : "No punch" },
                  { label: "Elapsed", value: f.actual !== null ? fmtMin(f.actual) : "—", sub: f.actual !== null ? `${fmtMin(f.requested)} requested` : o.actualOut ? `Away since ${o.actualOut}` : "Nothing started" },
                  { label: "Against estimate", value: f.actVsEst === null ? "—" : signed(f.actVsEst), sub: creditText(o) },
                ].map((t) => (
                  <div key={t.label} className="px-3.5 py-2.5">
                    <dt className="eyebrow">{t.label}</dt>
                    <dd className="tnum mt-0.5 text-kpi text-ink">{t.value}</dd>
                    <dd className="truncate text-small text-muted">{t.sub}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>

          <div className="space-y-3">
            <LinkPunches o={o} reviewer={reviewer} onApply={(c: OutingChange) => { apply(o.id, c); toast("success", "Punches updated. The outing now shows the times from the attendance record."); return true; }} />

            {f.reqVsEst > 0 || (f.actVsEst ?? 0) > 0 ? (
              <Callout kind="warning" lead="This outing does not quite add up" />
            ) : (
              <Callout kind="success" lead="This outing adds up" />
            )}

            {lastHr && (state === "clarification" || state === "plan-declined" || state === "revoked") && (
              <Callout kind={state === "clarification" ? "info" : "lock"} lead={`${lastHr.actor} wrote:`}>{lastHr.note}</Callout>
            )}

            {options.length > 0 && (
              <Panel title="Decision">
                <div role="radiogroup" aria-label="Decision" className={cn("grid gap-2", options.length > 3 ? "sm:grid-cols-2" : options.length === 3 ? "sm:grid-cols-3" : options.length === 2 ? "sm:grid-cols-2" : "")}>
                  {options.map((x) => (
                    <button
                      key={x}
                      type="button"
                      role="radio"
                      aria-checked={act === x}
                      onClick={() => { setAct(x); setTried(false); }}
                      title={ACTS[x].hint}
                      className={cn("rounded-input border px-3 py-2 text-left transition-colors duration-150", act === x ? (ACTS[x].danger ? "border-gap bg-gap-soft" : "border-brand bg-brand-soft") : "border-line bg-surface hover:bg-surface-2")}
                    >
                      <span className="block text-h3 text-ink">{ACTS[x].label}</span>
                      <span className="block text-[11.5px] text-muted">{ACTS[x].hint}</span>
                    </button>
                  ))}
                </div>
                {a && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {needsTimes && (
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                        {showOut && <Field label="Departure (check-out)" error={showRet ? "" : err.time}><TimeInput value={tOut} onChange={setTOut} /></Field>}
                        {showRet && <Field label="Return (check-in)" error={err.time}><TimeInput value={tRet} onChange={setTRet} /></Field>}
                      </div>
                    )}
                    <Field label="Reviewer" required error={err.reviewer}>
                      <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" maxLength={60} />
                    </Field>
                    <Field label="Note" required={a.note === "required"} optional={a.note === "optional"} error={err.note}>
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Added to the history" />
                    </Field>
                  </div>
                )}
                {a && (
                  <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3">
                    <a className="btn" href={`#${back.to}`}>Close</a>
                    <button className={cn("btn", a.danger ? "btn-danger" : "btn-primary")} onClick={submit}>{a.button}</button>
                  </div>
                )}
              </Panel>
            )}
          </div>
        </div>

        <Panel title="History" count={o.history.length}>
          <ol className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {o.history.map((h, i) => (
              <li key={i} className="relative flex gap-2.5">
                <span aria-hidden className="relative z-10 mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full border-2 border-brand bg-surface" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-body font-semibold text-ink">{h.action}</span>
                    <span className="text-small text-muted">{h.actor}</span>
                    <time dateTime={h.at} className="tnum text-small text-muted">{fmtUtc(h.at)}</time>
                  </div>
                  {h.note && <p className="mt-0.5 text-body text-ink-2">{h.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </PageBody>
    </>
  );
}
