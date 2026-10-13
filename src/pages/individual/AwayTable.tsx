import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Briefcase, Clock, LogIn, LogOut, MapPin, Plus, Route, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn, fmtClock, fmtDuration as d } from "@/lib/utils";
import { permMinutes } from "@/lib/engine";
import { type PermType } from "@/pages/permissions/model";
import { TASK_META } from "@/pages/sessions/data";
import { HistoryTimeline, Panel, type HistoryItem } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Pill, StatusPill } from "@/components/kit/Status";
import type { AwayRow } from "./model";

const TYPE_ICON: Record<PermType, LucideIcon> = { "Late arrival": LogIn, "In-shift permission": Clock, "Early departure": LogOut, "Business outing": Briefcase };
type Seg = "all" | "business" | "early";

const prmId = (id: string) => `PRM-${String(Number(id.replace(/\D/g, ""))).padStart(4, "0")}`;

/** Every request for time away as a row, set beside what the punches show. */
export function AwayTable({
  rows, selectedId, onSelect, onDetails, onAdd,
}: {
  rows: AwayRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDetails: (id: string) => void;
  onAdd: () => void;
}) {
  const [seg, setSeg] = useState<Seg>("all");
  const business = rows.filter((r) => r.type === "Business outing");
  const early = rows.filter((r) => r.type === "Early departure");
  const shown = seg === "business" ? business : seg === "early" ? early : rows;

  const cols: Column<AwayRow>[] = [
    {
      key: "date", header: "Date / type", w: "158px", primary: true, sortValue: (r) => r.req.date,
      cell: ({ req, type }) => {
        const Icon = TYPE_ICON[type];
        return (
          <>
            <div className="tnum font-semibold text-ink">{format(parseISO(req.date), "dd MMM · EEE")}</div>
            <div className="flex items-center gap-1 text-[11.5px] text-muted"><Icon className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{type}</span><span className="tnum">· {prmId(req.id)}</span></div>
          </>
        );
      },
    },
    {
      key: "win", header: "Requested window", w: "152px",
      cell: (r) => { const w = permMinutes(r.req); return <><div className="tnum font-semibold text-ink">{fmtClock(w.start)} – {fmtClock(w.end)}</div><div className="tnum truncate text-[11.5px] text-muted">{d(r.windowMin)} window · {d(r.working)} work</div></>; },
    },
    {
      key: "ev", header: "Punch evidence", w: "19%", hide: "lg",
      cell: ({ evidence: ev }) => (
        <>
          <div className={cn("truncate", ev.kind === "away" ? "tnum font-semibold text-ink" : "text-muted")}>{ev.label}</div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
            {ev.kind === "away" && <span className="tnum">{d(ev.away)} away</span>}
            {ev.beyond > 0 && <Pill def={{ label: `${ev.beyond}m beyond`, tone: "duty", icon: TriangleAlert }} />}
          </div>
        </>
      ),
    },
    {
      key: "task", header: "Task / purpose",
      cell: ({ req }) => (
        <>
          <div className="truncate font-semibold text-ink">{req.purpose ?? req.reason}</div>
          <div className="truncate text-[11.5px] text-muted">{req.ref && <span className="tnum font-semibold text-ink-2">{req.ref} · </span>}{req.reason}</div>
        </>
      ),
    },
    {
      key: "dest", header: "Destination", w: "132px", hide: "xl",
      cell: ({ req }) => (req.destination ? <span className="inline-flex items-center gap-1.5 text-ink-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden /><span className="truncate">{req.destination}</span></span> : <span className="text-muted">—</span>),
    },
    {
      key: "dec", header: "Decision / credit", w: "150px", sortValue: (r) => r.req.status,
      cell: ({ req, credit }) => (
        <>
          <StatusPill permission={req.status} />
          <div className={cn("tnum truncate text-[11.5px]", credit.credited > 0 ? "font-semibold text-work-ink" : "text-muted")}>
            {req.status === "approved" ? `${d(credit.credited)} credited` : req.status === "pending" ? `${d(credit.eligible)} on approval` : "No credit"}
          </div>
        </>
      ),
    },
    {
      key: "go", header: "Details", w: "86px", align: "right",
      cell: ({ req, type }) => <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); onDetails(req.id); }} aria-label={`Details for ${format(parseISO(req.date), "dd MMM")} ${type}`}>Details</button>,
    },
  ];

  return (
    <Panel
      id="time-away"
      title="Requests"
      count={shown.length}
      flush
      actions={
        <SegmentedControl
          label="Show time away"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "all", label: "All", count: rows.length },
            { value: "business", label: "Business outings", count: business.length },
            { value: "early", label: "Early departures", count: early.length },
          ]}
        />
      }
    >
      <DataGrid
        columns={cols}
        rows={shown}
        rowKey={(r) => r.req.id}
        caption="Time away with reasons"
        noun="requests"
        density="tall"
        selectedKey={selectedId}
        onSelect={onSelect}
        empty={{
          title: rows.length === 0 ? "No time away in this period" : seg === "business" ? "No business outings" : "No early departures",
          action: rows.length === 0 ? <button className="btn btn-sm" onClick={onAdd}><Plus aria-hidden />Add time away</button> : <button className="btn btn-sm" onClick={() => setSeg("all")}>Show all</button>,
        }}
      />
    </Panel>
  );
}

/* ------------------------------ explanatory panels ------------------------------ */
export function ContextCards({ row }: { row: AwayRow | null }) {
  const req = row?.req;
  const task = req?.ref ? TASK_META.find((t) => t.code === req.ref) : undefined;

  const trail: HistoryItem[] = row && req
    ? [
        ...(req.requestedAt ? [{ status: "pending" as const, actor: row.emp.name, at: req.requestedAt, note: `Requested: ${req.purpose ?? req.reason}.` }] : []),
        ...(req.history ?? []),
      ]
    : [];

  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <Panel title="Task context">
        {!row || !req ? (
          <p className="text-body text-muted">Select a request</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Route aria-hidden className="mt-1 h-4 w-4 shrink-0 text-duty" />
              <div className="min-w-0">
                <div className="eyebrow">{task ? `${task.code} · ${task.category}` : req.ref ?? "No task linked"}</div>
                <h3 className="mt-0.5 text-h2 text-ink">{task?.title ?? req.purpose ?? req.reason}</h3>
                <p className="mt-0.5 text-body text-ink-2">{req.reason}</p>
              </div>
            </div>
            {task && (
              <div className="rounded-input border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-3">
                  <StatusPill task={task.status} />
                  <span className="tnum text-small text-muted">Due {task.due}{task.completed ? ` · done ${task.completed}` : ""}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuenow={task.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Task progress">
                  <div className="h-full rounded-full bg-work" style={{ width: `${task.progress}%` }} />
                </div>
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body">
              <div><dt className="eyebrow">Destination</dt><dd className="mt-0.5 text-ink">{req.destination ?? "Not given"}</dd></div>
              <div><dt className="eyebrow">Window</dt><dd className="tnum mt-0.5 text-ink">{fmtClock(permMinutes(req).start)} – {fmtClock(permMinutes(req).end)}</dd></div>
            </dl>
          </div>
        )}
      </Panel>

      <Panel title="Approval trail">
        {!row || !req ? (
          <p className="text-body text-muted">Select a request</p>
        ) : (
          <div className="space-y-3">
            <HistoryTimeline items={trail} />
            <div className="tnum flex items-center justify-between rounded-input border border-line bg-surface-2 px-3 py-2 text-body">
              <span className="text-ink-2">Credit</span>
              <span><b className={cn(row.credit.credited > 0 ? "text-work-ink" : "text-ink")}>{d(row.credit.credited)}</b> <span className="text-muted">of {d(row.credit.requested)} requested</span></span>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
