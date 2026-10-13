import { useMemo, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Building2, CalendarClock, Footprints, MapPin, Pencil, RotateCcw, SearchX, Trash2, Undo2, UserPlus, Users } from "lucide-react";
import { fmtMin, permMinutes } from "@/lib/engine";
import { fmtUtc } from "@/lib/utc";
import { cn, fmtClock } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, EmptyState, Panel } from "@/components/kit/Blocks";
import { PersonCell } from "@/components/kit/PersonCell";
import { Pill, StatusPill, TASK_STATUS } from "@/components/kit/Status";
import { StatePill } from "@/pages/outings/parts";
import { creditOf, figures } from "@/pages/outings/model";
import { useOutings } from "@/pages/outings/store";
import { DEFAULT_ASSESS, PRIORITY_DEF, SEG_DEF, fmtStamp, isDoneOutcome, modeLabel, outcomeOf, segmentOf } from "./model";
import { useTasks } from "./store";
import { useTeams } from "./teams";
import { useTaskSub } from "./TaskSub";

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="eyebrow">{label}</dt>
    <dd className="tnum mt-0.5 break-words text-body font-semibold text-ink">{children}</dd>
  </div>
);

const BACK: Record<string, { to: string; label: string }> = {
  tasks: { to: "/tasks", label: "Tasks & outings" },
  kanban: { to: "/kanban", label: "Employee Kanban" },
};

/** One task in full: overview, people, outings, the attendance records tied to it, and its history, all on one screen. */
export default function TaskManagePage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const id = q.get("id");
  const from = q.get("from") ?? "tasks";
  const back = BACK[from] ?? BACK.tasks;
  const assessAt = DEFAULT_ASSESS;
  const tasks = useTasks((s) => s.tasks);
  const allOutings = useOutings((s) => s.outings);
  const permissions = useApp((s) => s.permissions);
  const teams = useTeams((s) => s.teams);
  const sub = useTaskSub(assessAt);

  const t = tasks.find((x) => x.id === id) ?? null;
  const outings = useMemo(() => (t ? allOutings.filter((o) => o.taskCode === t.code) : []), [allOutings, t]);
  const linked = useMemo(() => (t ? permissions.filter((p) => p.ref === t.code) : []), [permissions, t]);

  if (!t) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={SearchX} title="That task is not here" action={<a className="btn btn-sm" href="#/tasks">Back to Tasks &amp; outings</a>} /></Panel></PageBody>
      </>
    );
  }

  const seg = segmentOf(t, assessAt);
  const locked = t.lifecycle !== "live";
  const done = t.assignees.filter((a) => isDoneOutcome(a.outcome)).length;
  const avg = t.assignees.length ? Math.round(t.assignees.reduce((n, a) => n + (isDoneOutcome(a.outcome) ? 100 : a.progress), 0) / t.assignees.length) : 0;
  const teamNames = (t.teamIds ?? []).map((x) => teams.find((y) => y.id === x)?.name).filter(Boolean) as string[];
  const punches = outings.filter((o) => o.actualOut);
  const planOuting = () => navigate("/outing-plan", { task: t.code, from: "tasks" });

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={t.title}
        meta={<><span className="tnum font-semibold text-ink-2">{t.code}</span><Pill def={SEG_DEF[seg]} /><Pill def={PRIORITY_DEF[t.priority]} /></>}
        actions={
          <>
            {!locked && <button className="btn" onClick={() => sub.actions.edit(t.id)}><Pencil aria-hidden />Edit</button>}
            {!locked && <button className="btn" onClick={() => sub.actions.assign(t.id)}><UserPlus aria-hidden />Assign</button>}
            {t.lifecycle === "live" && <button className="btn" onClick={() => sub.actions.life(t.id, "revoke")}><Undo2 aria-hidden />Revoke</button>}
            {locked && <button className="btn" onClick={() => sub.actions.life(t.id, "restore")}><RotateCcw aria-hidden />Restore</button>}
            {t.lifecycle !== "deleted" && <button className="btn text-gap-ink" onClick={() => sub.actions.life(t.id, "delete")}><Trash2 aria-hidden />Delete</button>}
            {!locked && t.assignees.length > 0 && <button className="btn btn-primary" onClick={planOuting}><Footprints aria-hidden />Plan an outing</button>}
          </>
        }
      />

      <PageBody>
        {locked && <Callout kind="lock" lead={`This task is ${t.lifecycle}.`} />}

        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Panel title="Overview">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Fact label="Assignment">{modeLabel(t)}</Fact>
              <Fact label="Starts">{fmtStamp(t.start)}</Fact>
              <Fact label="Deadline">{fmtStamp(t.due)}</Fact>
              <Fact label="Judged at">{fmtStamp(assessAt)}</Fact>
              <Fact label="Location"><span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-muted" aria-hidden />{t.location === "on-site" ? "On site" : "Off site"} · {t.destination}</span></Fact>
              <Fact label="Company"><span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-muted" aria-hidden />{t.company ?? "—"}</span></Fact>
              <Fact label="Department">{t.department ?? "Any"}</Fact>
              <Fact label="Teams">{teamNames.length ? <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted" aria-hidden />{teamNames.join(", ")}</span> : "—"}</Fact>
            </dl>
            <div className="mt-3 border-t border-line pt-2.5">
              <div className="flex items-center justify-between gap-3"><h3 className="eyebrow">Delivery</h3><span className="tnum text-small text-muted">{done} of {t.assignees.length} finished</span></div>
              <div className="mt-1.5 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${avg}% complete on average`}><span className="block h-full rounded-full bg-work transition-[width] duration-300 ease-out" style={{ width: `${avg}%` }} /></div>
                <span className="tnum w-10 text-right text-h3 text-ink">{avg}%</span>
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-2.5">
              <h3 className="eyebrow mb-1">Instructions</h3>
              <p className="whitespace-pre-wrap text-body text-ink-2">{t.instructions || "No instructions were added."}</p>
            </div>
          </Panel>

          <Panel title="People" count={t.assignees.length} flush>
            {t.assignees.length === 0 ? (
              <EmptyState icon={Users} title="Nobody owns this task yet" action={!locked ? <button className="btn btn-sm btn-primary" onClick={() => sub.actions.assign(t.id)}><UserPlus aria-hidden />Assign</button> : undefined} />
            ) : (
              <ul className="divide-y divide-line">
                {t.assignees.map((a) => {
                  const e = EMPLOYEES.find((x) => x.id === a.empId)!;
                  const shown = outcomeOf(a, t, assessAt);
                  const pct = isDoneOutcome(a.outcome) ? 100 : a.progress;
                  return (
                    <li key={a.empId} className="px-3.5 py-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <PersonCell name={e.name} id={e.id} sub={`${empCode(e.id)} · from ${a.origin}`} />
                        <span className="flex items-center gap-2">
                          <Pill def={TASK_STATUS[shown]} />
                          {!locked && <button className="btn btn-sm" onClick={() => sub.actions.progress(t.id, a.empId)}>Update progress</button>}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2" aria-label={`${pct}% complete`}>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-work transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} /></div>
                        <span className="tnum w-9 text-right text-small font-semibold text-ink-2">{pct}%</span>
                      </div>
                      {(a.startedAt || a.completedAt || a.evidence) && (
                        <p className="tnum mt-1 text-small text-muted">
                          {a.startedAt && <>Started {fmtStamp(a.startedAt)}. </>}
                          {a.completedAt && <>Completed {fmtStamp(a.completedAt)}. </>}
                          {a.evidence && <span className="text-ink-2">{a.evidence}</span>}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Outings" count={outings.length} flush actions={!locked && t.assignees.length > 0 ? <button className="btn btn-sm" onClick={planOuting}>Plan an outing</button> : undefined}>
            {outings.length === 0 ? (
              <EmptyState icon={Footprints} title="No outings planned" />
            ) : (
              <ul className="divide-y divide-line">
                {outings.map((o) => {
                  const f = figures(o);
                  const e = EMPLOYEES.find((x) => x.id === o.employeeId);
                  return (
                    <li key={o.id}>
                      <button className="flex w-full flex-wrap items-center justify-between gap-2 px-3.5 py-2 text-left transition-colors duration-150 hover:bg-surface-2" onClick={() => navigate("/outing-review", { id: o.id, from: "tasks" })}>
                        <span className="min-w-0">
                          <span className="tnum block text-h3 text-ink">{o.id} · {e?.name}</span>
                          <span className="tnum block text-small text-muted">{o.reqOut} → {o.reqReturn} · estimate {fmtMin(f.estimated)}{creditOf(o) > 0 ? ` · ${fmtMin(creditOf(o))} credited` : ""}</span>
                        </span>
                        <StatePill state={o.state} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Attendance links" count={linked.length + punches.length} flush>
            {linked.length === 0 && punches.length === 0 ? (
              <EmptyState icon={CalendarClock} title="Nothing in attendance is tied to this task" />
            ) : (
              <div className="divide-y divide-line">
                <section aria-label="Time-away requests">
                  <h3 className="eyebrow px-3.5 pb-1 pt-2.5">Time-away requests ({linked.length})</h3>
                  {linked.length === 0 ? <p className="px-3.5 pb-2.5 text-body text-muted">No request quotes {t.code}.</p> : (
                    <ul className="divide-y divide-line">
                      {linked.map((p) => {
                        const e = EMPLOYEES.find((x) => x.id === p.employeeId);
                        const w = permMinutes(p);
                        return (
                          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
                            <span className="min-w-0">
                              <span className="block text-h3 text-ink">{e?.name} · {format(parseISO(p.date), "dd MMM")}</span>
                              <span className="tnum block text-small text-muted">{fmtClock(w.start)} – {fmtClock(w.end)} · {p.purpose ?? p.reason}</span>
                            </span>
                            <StatusPill permission={p.status} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
                <section aria-label="Outing punches">
                  <h3 className="eyebrow px-3.5 pb-1 pt-2.5">Outing punches ({punches.length})</h3>
                  {punches.length === 0 ? <p className="px-3.5 pb-2.5 text-body text-muted">No outing has punches yet.</p> : (
                    <ul className="divide-y divide-line">
                      {punches.map((o) => {
                        const e = EMPLOYEES.find((x) => x.id === o.employeeId);
                        return (
                          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
                            <span className="min-w-0">
                              <span className="block text-h3 text-ink">{e?.name} · {format(parseISO(o.date), "dd MMM")}</span>
                              <span className="tnum block text-small text-muted">Out {o.actualOut} → {o.actualReturn ?? "still away"} · {o.id}</span>
                            </span>
                            <StatePill state={o.state} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            )}
          </Panel>
        </div>

        <Panel title="Activity" count={t.history.length}>
          <ol className="grid gap-x-8 gap-y-3 md:grid-cols-2">
            {[...t.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className={cn("mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full border-2 bg-surface", i === 0 ? "border-brand" : "border-line-strong")} />
                <div className="min-w-0">
                  <p className="text-body text-ink">{h.text}</p>
                  <p className="tnum text-small text-muted">{h.actor} · <time dateTime={h.at}>{fmtUtc(h.at)}</time></p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </PageBody>

      {sub.node}
    </>
  );
}
