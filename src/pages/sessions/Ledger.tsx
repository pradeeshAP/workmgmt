import { addDays, format, parseISO } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Coffee, Hourglass, Layers, Lock, PencilLine } from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/utils";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { Pill, type Def } from "@/components/kit/Status";
import { taskMeta } from "./data";
import type { Session } from "./model-core";
import type { SessionDay } from "./model";

const dayLabel = (date: string, m: number) => format(addDays(parseISO(date), Math.floor(m / 1440)), "dd MMM");

function awayPill(s: Session): Def | null {
  const a = s.away;
  if (!a) return null;
  if (a.awaiting) return { label: "Awaiting return", tone: "duty", icon: Hourglass };
  if (a.status === "covered") return { label: "Covered", tone: "work", icon: CheckCircle2 };
  if (a.status === "break") return { label: "Break", tone: "neutral", icon: Coffee };
  if (a.status === "pending") return { label: "Pending approval", tone: "pending", icon: Hourglass };
  if (a.status === "uncovered") return { label: `Uncovered ${fmtDuration(a.gap + a.pending)}`, tone: "gap", icon: AlertTriangle };
  return null;
}

const creditText = (s: Session) => {
  const a = s.away!;
  const parts = [
    a.duty > 0 && `${fmtDuration(a.duty)} business duty`,
    a.permission > 0 && `${fmtDuration(a.permission)} permission`,
    a.breakMin > 0 && `${fmtDuration(a.breakMin)} break`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "No credit";
};

const none = <span className="text-faint">—</span>;

export function Ledger({
  day, onReview, onLink, onTask, onCorrect,
}: {
  day: SessionDay;
  onReview: (s: Session) => void;
  onLink: (s: Session) => void;
  onTask: (taskId: string) => void;
  onCorrect: () => void;
}) {
  const { sessions, state, date, person } = day;
  const net = sessions.reduce((n, s) => n + (s.net ?? 0), 0);
  const away = sessions.reduce((n, s) => n + (s.away && !s.away.awaiting && !s.away.early ? s.away.total : 0), 0);

  const cols: Column<Session>[] = [
    { key: "n", header: "Session", w: "88px", primary: true, cell: (s) => <span className={`tnum text-[17px] font-semibold ${s.outMin === null ? "text-work" : "text-ink-2"}`}>{String(s.n).padStart(2, "0")}</span> },
    { key: "in", header: "Check-in", w: "100px", cell: (s) => <><div className="tnum font-semibold text-ink">{fmtClock(s.inMin)}</div><div className="text-[11.5px] text-muted">{dayLabel(date, s.inMin)}</div></> },
    {
      key: "out", header: "Check-out", w: "17%",
      cell: (s) => s.outMin === null ? (
        <span className="inline-flex items-center gap-2 font-semibold text-ink">
          <span aria-hidden className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-work opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-work" /></span>
          Still open
        </span>
      ) : (
        <><div className="tnum font-semibold text-ink">{fmtClock(s.outMin)}</div><div className="truncate text-[11.5px] text-muted">{s.pair.reason || <span className="text-gap-ink">No reason recorded</span>}</div></>
      ),
    },
    { key: "net", header: "Net work", w: "96px", align: "right", cell: (s) => (s.net === null ? none : <b className="tnum font-semibold text-ink">{fmtDuration(s.net)}</b>) },
    {
      key: "task", header: "Exit / task", w: "19%", hide: "lg",
      cell: (s) => {
        const task = taskMeta(s.pair.taskId);
        const canLink = s.outMin !== null && s.pair.reason === "Business task" && !task;
        if (task) return <><button className="block max-w-full truncate text-left font-semibold text-brand-ink hover:underline" onClick={(e) => { e.stopPropagation(); onTask(task.id); }}>{task.title}</button><div className="truncate text-[11.5px] text-muted"><span className="tnum">{task.code}</span>{s.pair.note && ` · ${s.pair.note}`}</div></>;
        if (s.outMin === null) return none;
        return <><div className="text-muted">{canLink ? "No task linked" : s.pair.reason === "Break" || s.pair.reason === "End of shift" ? "—" : "No task"}</div>{s.pair.note && <div className="truncate text-[11.5px] text-muted">{s.pair.note}</div>}</>;
      },
    },
    {
      key: "next", header: "Next return", w: "128px", hide: "xl",
      cell: (s) => {
        const last = s === sessions[sessions.length - 1];
        if (s.nextIn !== null) return <><div className="tnum font-semibold text-ink">{fmtClock(s.nextIn)}</div><div className="tnum text-[11.5px] text-muted">+{fmtDuration(s.nextIn - (s.outMin ?? s.nextIn))} later</div></>;
        if (s.outMin === null) return none;
        if (last && state === "closed") return <><div className="inline-flex items-center gap-1 font-semibold text-ink-2"><Lock className="h-3 w-3" aria-hidden />Blocked</div><div className="truncate text-[11.5px] text-muted">Final exit</div></>;
        return <><div className="inline-flex items-center gap-1 font-semibold text-ink"><Clock className="h-3 w-3 text-duty" aria-hidden />Awaiting</div><div className="tnum text-[11.5px] text-muted">since {fmtClock(s.outMin)}</div></>;
      },
    },
    {
      key: "away", header: "Away / credit", wrap: true,
      cell: (s) => {
        const a = s.away;
        const pill = awayPill(s);
        if (!a || !pill) return none;
        return (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 leading-tight">
            <span className="tnum font-semibold text-ink">{a.awaiting ? "Away" : a.early ? `Left ${fmtDuration(a.total)} early` : `${fmtDuration(a.total)} away`}</span>
            <Pill def={pill} />
            {!a.awaiting && <span className="w-full text-[11.5px] text-muted">{creditText(s)}</span>}
          </div>
        );
      },
    },
    {
      key: "act", header: "Action", w: "104px", align: "right",
      cell: (s) => {
        const a = s.away;
        const task = taskMeta(s.pair.taskId);
        const needsReview = !!a && (a.awaiting || a.status === "uncovered" || a.status === "pending");
        const canLink = s.outMin !== null && s.pair.reason === "Business task" && !task;
        if (needsReview) return <button className="btn btn-sm" onClick={() => onReview(s)} aria-label={`Review session ${s.n}`}>Review</button>;
        if (canLink) return <button className="btn btn-sm" onClick={() => onLink(s)} aria-label={`Link a task to session ${s.n}`}>Link task</button>;
        if (task) return <button className="btn btn-sm" onClick={() => onTask(task.id)} aria-label={`Show task ${task.code}`}>Task</button>;
        return none;
      },
    },
  ];

  return (
    <Panel
      id="session-ledger"
      title="Session ledger"
      icon={Layers}
      count={sessions.length}
      flush
      actions={<button className="btn btn-sm" onClick={onCorrect}><PencilLine aria-hidden />Correct punches</button>}
    >
      <DataGrid
        columns={cols}
        rows={sessions}
        rowKey={(s) => s.pair.id}
        caption={`Session ledger for ${person.emp.name}`}
        noun="sessions"
        density="tall"
        empty={{ title: person.rec.status === "leave" ? "On approved leave" : "No sessions yet" }}
        footnote={<span className="tnum hidden sm:inline"><b className="text-ink-2">{fmtDuration(net)}</b> net work · <b className="text-ink-2">{fmtDuration(away)}</b> away between sessions</span>}
      />
    </Panel>
  );
}
