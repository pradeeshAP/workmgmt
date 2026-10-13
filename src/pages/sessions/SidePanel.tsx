import { ClipboardList, Lock, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { Callout, EmptyState, Panel } from "@/components/kit/Blocks";
import { Select } from "@/components/kit/forms";
import { StatusPill } from "@/components/kit/Status";
import { BUSINESS_CREDIT, type TaskMeta } from "./data";
import type { SessionDay } from "./model";
import { useSessions } from "./store";

/* ------------------------------ assigned policy ------------------------------ */
export function PolicyCard({ day }: { day: SessionDay }) {
  const { policy, policies, used, person, isPractice } = day;
  const { assignPolicy } = useSessions();
  const toast = useApp((s) => s.toast);

  const rows: [string, ReactNode][] = [
    ["Check-in mode", policy.checkInMode],
    [
      "Session allowance",
      <span key="a" className="inline-flex items-center gap-2">
        <span className="tnum">{used} / {policy.allowed}</span>
        <span aria-hidden className="flex gap-0.5">
          {Array.from({ length: policy.allowed }, (_, i) => <span key={i} className={cn("h-1.5 w-3 rounded-full", i < used ? "bg-work" : "bg-surface-3")} />)}
        </span>
      </span>,
    ],
    ["Exit reason", policy.exitReason === "Required" ? "Required on every check-out" : "Optional"],
    ["Business credit", BUSINESS_CREDIT],
    ["Return after final exit", <span key="r" className="inline-flex items-center gap-1"><Lock className="h-3 w-3 text-ink-2" aria-hidden />Blocked</span>],
  ];

  return (
    <Panel
      title={policy.name}
      icon={ShieldCheck}
      actions={
        !isPractice && (
          <Select
            aria-label="Policy for this employee"
            className="h-7 w-[200px] py-0 text-[12px]"
            value={policy.id}
            onChange={(e) => {
              assignPolicy(person.emp.id, e.target.value);
              toast("info", `${policies.find((p) => p.id === e.target.value)?.name} now applies to ${person.emp.name}.`);
            }}
            options={policies.map((p) => ({ value: p.id, label: `${p.name} · ${p.allowed} ${p.allowed === 1 ? "session" : "sessions"}` }))}
          />
        )
      }
    >
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 border-b border-line pb-1.5 text-body last:border-0 last:pb-0">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/* ------------------------------ next action ------------------------------ */
/** Only says something when the day cannot take a punch, so the button's own label does the rest. */
export function NextAction({ day }: { day: SessionDay }) {
  const { state, person, future } = day;
  if (person.rec.status === "leave") return <Callout kind="lock" lead="On approved leave" />;
  if (!person.shift) return <Callout kind="info" lead="No shift is assigned on this date" action={<a className="btn btn-sm" href="#/shift-timeline">Open shift timeline</a>} />;
  if (future) return <Callout kind="info" lead="This date has not happened yet" />;
  if (state === "closed") return <Callout kind="lock" lead="The day is closed" />;
  return null;
}

/* ------------------------------ tasks of the day ------------------------------ */
const BAR: Record<TaskMeta["status"], string> = {
  assigned: "bg-faint",
  "in-progress": "bg-brand",
  blocked: "bg-gap",
  "on-time": "bg-work",
  "late-done": "bg-duty",
  overdue: "bg-gap",
  revoked: "bg-faint",
  deleted: "bg-faint",
};

export function TasksCard({ day, focusId }: { day: SessionDay; focusId: string | null }) {
  const { tasks, sessions } = day;
  return (
    <Panel title="Tasks linked to this day" icon={ClipboardList} count={tasks.length} flush>
      {tasks.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No tasks on this day" className="py-6" />
      ) : (
        <ul className="divide-y divide-line">
          {tasks.map((t) => {
            const linked = sessions.filter((s) => s.pair.taskId === t.id).map((s) => String(s.n).padStart(2, "0"));
            return (
              <li key={t.id} id={`task-${t.id}`} className={cn("grid scroll-mt-32 gap-x-3 gap-y-1 px-3.5 py-2 transition-colors duration-300 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center", focusId === t.id && "bg-brand-soft")}>
                <div className="min-w-0">
                  <div className="truncate text-h3 text-ink">{t.title}</div>
                  <div className="truncate text-small text-muted"><span className="tnum font-semibold text-ink-2">{t.code}</span> · {t.category} · <span className="tnum">{t.completed ? `done ${t.completed}` : `due ${t.due}`}</span> · {linked.length ? `Session ${linked.join(", ")}` : "not linked"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <div role="progressbar" aria-label={`${t.title} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.progress} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                    <div className={cn("h-full rounded-full transition-[width] duration-300", BAR[t.status])} style={{ width: `${t.progress}%` }} />
                  </div>
                  <span className="tnum w-8 text-right text-small font-semibold text-ink">{t.progress}%</span>
                </div>
                <StatusPill task={t.status} />
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
