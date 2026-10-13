import { useState } from "react";
import { CalendarClock, CheckCircle2, FileSpreadsheet, Footprints, Hourglass, ListTodo, MoreHorizontal, Pencil, Plus, Replace, ScanSearch, Timer, Trash2, Undo2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMin } from "@/lib/engine";
import { downloadCsv } from "@/lib/export";
import { useApp } from "@/store/useApp";
import { EMPLOYEES } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { ActionButton } from "@/components/kit/ActionButton";
import { Panel } from "@/components/kit/Blocks";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { DateTimePicker, Field } from "@/components/kit/forms";
import { AvatarStack } from "@/components/kit/PersonCell";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Pill, TASK_STATUS } from "@/components/kit/Status";
import { Vitals } from "@/components/kit/Vitals";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Popover, PopoverContent, PopoverTrigger } from "@/components/ui/primitives";
import { NEEDS_REVIEW, useOutingRows } from "@/pages/outings/model";
import { DEFAULT_ASSESS, PRIORITY_DEF, SEGMENTS, SEG_DEF, fmtStamp, modeLabel, outcomeOf, tasksCsv, totalsOf, useTaskRows, type Segment, type TaskRow } from "./model";
import type { TaskItem } from "./store";
import { useTaskSub } from "./TaskSub";

/** Tasks & outings: every task as a row, who has it, when it is due and how far along it is. */
export default function TasksPage({ route }: { route: Route }) {
  const { toast, resetFilters } = useApp();

  const [assessAt, setAssessAt] = useState(DEFAULT_ASSESS);
  const [seg, setSeg] = useState<Segment>("active");
  const rows = useTaskRows(assessAt);
  const outings = useOutingRows(false);
  const sub = useTaskSub(assessAt);

  const totals = totalsOf(rows, assessAt);
  const count = (s: Segment) => rows.filter((r) => r.seg === s).length;
  const shown = rows.filter((r) => r.seg === seg);
  const toReview = outings.filter((r) => NEEDS_REVIEW.includes(r.o.state)).length;
  const manage = (id: string) => navigate("/task-manage", { id });

  const csv = () => {
    downloadCsv(`tasks-${assessAt.slice(0, 10)}.csv`, tasksCsv(rows, assessAt));
    toast("success", `Task CSV downloaded with ${rows.length} ${rows.length === 1 ? "task" : "tasks"}.`);
  };

  const cols: Column<TaskRow>[] = [
    {
      key: "task", header: "Task", w: "25%", primary: true, sortValue: (r) => r.t.title,
      cell: (r) => (
        <>
          <div className={cn("truncate text-h3", r.t.lifecycle !== "live" ? "text-ink-2" : "text-ink", r.t.lifecycle === "deleted" && "line-through")}>{r.t.title}</div>
          <div className="tnum truncate text-[11.5px] text-muted">{r.t.code} · {r.t.category} · {r.t.destination}</div>
        </>
      ),
    },
    {
      key: "who", header: "Assigned to", w: "20%",
      cell: (r) => {
        const people = r.t.assignees.map((a) => EMPLOYEES.find((x) => x.id === a.empId)).filter(Boolean) as typeof EMPLOYEES;
        const first = r.t.assignees[0];
        return (
          <div className="flex items-center gap-2">
            {people.length > 0 && <AvatarStack people={people} max={3} />}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-small font-semibold text-ink">{people.length ? people.map((p) => p.name.split(" ")[0]).join(", ") : <span className="text-duty-ink">Unassigned</span>}</span>
              <span className="block truncate text-[11px] text-muted">{people.length === 0 ? "Waiting for an owner · " : ""}{modeLabel(r.t)}{first ? ` · ${TASK_STATUS[outcomeOf(first, r.t, assessAt)].label}` : ""}</span>
            </span>
          </div>
        );
      },
    },
    {
      key: "due", header: "Deadline", w: "124px", sortValue: (r) => r.t.due,
      cell: (r) => <><div className="tnum font-semibold text-ink">{fmtStamp(r.t.due)}</div><div className="tnum text-[11.5px] text-muted">from {fmtStamp(r.t.start)}</div></>,
    },
    {
      key: "state", header: "Priority · status", w: "170px", hide: "lg",
      cell: (r) => <span className="flex flex-wrap items-center gap-1"><Pill def={PRIORITY_DEF[r.t.priority]} /><Pill def={SEG_DEF[r.seg]} /></span>,
    },
    {
      key: "delivery", header: "Delivery", w: "168px", hide: "xl", sortValue: (r) => r.avg,
      cell: (r) => (
        <>
          <div className="flex items-center gap-2" role="img" aria-label={`Average progress ${r.avg}%`}>
            <span className="tnum font-semibold text-ink">{r.done}/{r.total}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-work" style={{ width: `${r.avg}%` }} /></span>
            <span className="tnum w-8 text-right text-small font-semibold text-ink-2">{r.avg}%</span>
          </div>
          <div className="tnum truncate text-[11.5px] text-muted">{r.outings.length} {r.outings.length === 1 ? "outing" : "outings"} · {fmtMin(r.credit)} credit</div>
        </>
      ),
    },
    {
      key: "act", header: "Actions", w: "116px", align: "right",
      cell: (r) => {
        const t: TaskItem = r.t;
        const dead = t.lifecycle !== "live";
        return (
          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button className="btn btn-sm" onClick={() => manage(t.id)} aria-label={`Manage ${t.code}`}>Manage</button>
            <Menu>
              <MenuTrigger asChild><button className="btn-icon h-7 w-7" aria-label={`More actions for ${t.code}`}><MoreHorizontal className="h-4 w-4" aria-hidden /></button></MenuTrigger>
              <MenuContent className="min-w-[180px]">
                {t.lifecycle !== "deleted" && !dead && <MenuItem icon={Pencil} onSelect={() => sub.actions.edit(t.id)}>Edit</MenuItem>}
                {t.lifecycle === "live" && <MenuItem icon={Undo2} onSelect={() => sub.actions.life(t.id, "revoke")}>Revoke</MenuItem>}
                {dead && <MenuItem icon={Replace} onSelect={() => sub.actions.life(t.id, "restore")}>Restore</MenuItem>}
                {t.lifecycle !== "deleted" && (<><MenuSeparator /><MenuItem icon={Trash2} danger onSelect={() => sub.actions.life(t.id, "delete")}>Delete</MenuItem></>)}
              </MenuContent>
            </Menu>
          </span>
        );
      },
    },
  ];

  return (
    <>
      <PageHead
        route={route}
        actions={
          <>
            <button className="btn" onClick={() => navigate("/outing-check")}><ScanSearch aria-hidden />Outing check{toReview > 0 && <span className="chip chip-duty tnum">{toReview}</span>}</button>
            <a className="btn" href="#/outings"><Footprints aria-hidden />Outing control</a>
            <button className="btn" onClick={sub.actions.teams}><Users aria-hidden />Teams</button>
            <button className="btn" onClick={() => navigate("/outing-plan", { from: "tasks" })}><Footprints aria-hidden />Plan outing</button>
            <ActionButton icon={FileSpreadsheet} busyLabel="Building CSV…" doneLabel="CSV saved" onAction={csv}>CSV</ActionButton>
            <button className="btn btn-primary" onClick={() => navigate("/task-edit", { from: "tasks" })}><Plus aria-hidden />Create task</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", icon: ListTodo, label: "Active", value: totals.active, sub: `${totals.viaTeams} via teams` },
              { tone: "extra", icon: Users, label: "Assignments", value: totals.assignments },
              { tone: "work", icon: CheckCircle2, label: "On time", value: totals.onTime },
              { tone: "duty", icon: Timer, label: "Late", value: totals.late },
              { tone: "gap", icon: Hourglass, label: "Open / overdue", value: `${totals.open} / ${totals.overdue}` },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} />

      <PageBody>
        <Panel
          id="task-table"
          title="Tasks"
          count={shown.length}
          flush
          actions={
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="btn btn-sm"><CalendarClock aria-hidden />Assess at {fmtStamp(assessAt)}</button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[320px]">
                  <Field label="Assess open deadlines at"><DateTimePicker value={assessAt} onChange={setAssessAt} /></Field>
                </PopoverContent>
              </Popover>
              <SegmentedControl label="Task lifecycle" value={seg} onChange={setSeg} options={SEGMENTS.map((s) => ({ ...s, count: count(s.value) }))} />
            </>
          }
        >
          <DataGrid
            columns={cols}
            rows={shown}
            rowKey={(r) => r.t.id}
            caption="Tasks"
            noun="tasks"
            density="tall"
            onSelect={manage}
            empty={{
              title: rows.length === 0 ? "No tasks match these filters" : `No ${SEG_DEF[seg].label.toLowerCase()} tasks`,
              action: <button className="btn btn-sm" onClick={() => (rows.length === 0 ? resetFilters() : setSeg("active"))}>{rows.length === 0 ? "Clear filters" : "Show active tasks"}</button>,
            }}
          />
        </Panel>
      </PageBody>

      {sub.node}
    </>
  );
}
