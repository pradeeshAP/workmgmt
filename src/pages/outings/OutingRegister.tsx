import { format, parseISO } from "date-fns";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMin } from "@/lib/engine";
import { empCode } from "@/store/data";
import { useApp } from "@/store/useApp";
import { navigate } from "@/lib/useHashRoute";
import { PersonCell } from "@/components/kit/PersonCell";
import { DataGrid, type Column } from "@/components/kit/DataGrid";
import { useTasks } from "@/pages/tasks/store";
import { PARTS, creditText, type OutingRow } from "./model";
import { EstimateBar, StatePill, Variance } from "./parts";

const Range = ({ a, b, open }: { a?: string; b?: string; open?: string }) => (
  <span className="tnum inline-flex items-center gap-1 whitespace-nowrap font-semibold text-ink">
    {a ?? "—"}
    <ArrowRight className="h-3 w-3 text-faint" aria-hidden />
    {b ?? <span className="font-normal text-muted">{open ?? "—"}</span>}
  </span>
);

/** The outing register on Outing control: every outing as a row, from request to review. */
export function OutingRegister({ rows, onOpen, onClear, onDepart }: { rows: OutingRow[]; onOpen: (id: string) => void; onClear?: () => void; /** shows Record departure on approved outings */ onDepart?: (id: string) => void }) {
  const tasks = useTasks((s) => s.tasks);
  const goTask = (code: string) => {
    useApp.getState().setFilters({ search: code });
    navigate("/tasks");
  };

  const cols: Column<OutingRow>[] = [
    { key: "emp", header: "Employee", w: "19%", primary: true, sortValue: (r) => r.emp.name, cell: ({ emp, o }) => <span className={cn(o.state === "revoked" || o.state === "plan-declined" ? "opacity-60" : undefined)}><PersonCell name={emp.name} id={emp.id} sub={`${empCode(emp.id)} · ${emp.dept}`} /></span> },
    {
      key: "task", header: "Task", w: "17%", hide: "lg",
      cell: ({ o }) => {
        const task = tasks.find((t) => t.code === o.taskCode);
        return (
          <>
            <button className="block max-w-full truncate text-left font-semibold text-brand-ink hover:underline" onClick={(e) => { e.stopPropagation(); goTask(o.taskCode); }} aria-label={`Open task ${o.taskCode}`}>{o.taskCode}{task ? ` · ${task.title}` : ""}</button>
            <div className="tnum truncate text-[11.5px] text-muted">{o.id} · {format(parseISO(o.date), "dd MMM")}</div>
          </>
        );
      },
    },
    { key: "req", header: "Requested", w: "112px", sortValue: (r) => r.o.date + r.o.reqOut, cell: ({ o, f }) => <><Range a={o.reqOut} b={o.reqReturn} /><div className="tnum text-[11.5px] text-muted">{fmtMin(f.requested)}</div></> },
    {
      key: "est", header: "Manual estimate", w: "150px", hide: "xl",
      cell: ({ o, f }) => (
        <>
          <div className="tnum font-semibold text-ink">{fmtMin(f.estimated)} <span className="font-normal text-muted">· {o.km} km</span></div>
          <div className="my-0.5"><EstimateBar est={o.est} height="h-1.5" /></div>
          <div className="tnum text-[11px] text-muted">{PARTS.map((p) => o.est[p.key]).join(" · ")} min</div>
          <div className="sr-only">{PARTS.map((p) => `${p.label} ${o.est[p.key]} minutes`).join(", ")}</div>
        </>
      ),
    },
    {
      key: "act", header: "Actual punches", w: "140px", hide: "xl",
      cell: ({ o, f }) => (
        <>
          {o.actualOut ? (
            <>
              <Range a={o.actualOut} b={o.actualReturn} open="still away" />
              <div className="tnum text-[11.5px] text-muted">{f.actual !== null ? `${fmtMin(f.actual)} elapsed` : `Away since ${o.actualOut}`}</div>
            </>
          ) : (
            <div className="text-[11.5px] text-muted">{o.state === "plan-approved" ? "Not departed yet" : "No punches"}</div>
          )}
          <div className={cn("truncate text-[11.5px]", o.state === "actual-accepted" ? "font-semibold text-work-ink" : "text-muted")}>{creditText(o)}</div>
        </>
      ),
    },
    {
      key: "var", header: "Variance", w: "172px", hide: "2xl",
      cell: ({ f }) => <div className="space-y-0.5"><Variance label="Request vs est." value={f.reqVsEst} /><Variance label="Actual vs est." value={f.actVsEst} /></div>,
    },
    {
      key: "state", header: "Validation / HR", w: "176px", sortValue: (r) => r.o.state,
      cell: ({ o }) => (
        <>
          <StatePill state={o.state} />
          <div className="mt-0.5 truncate text-[11.5px] text-muted">Plan: <span className="text-ink-2">{o.planReviewer ?? (o.state === "revoked" || o.state === "plan-declined" ? "—" : "Awaiting")}</span> · Actual: <span className="text-ink-2">{o.actualReviewer ?? (o.state === "actual-review" || o.state === "re-review" ? "Awaiting" : "—")}</span></div>
        </>
      ),
    },
    {
      key: "go", header: "Action", w: "148px", align: "right",
      cell: ({ o, emp }) => {
        const needs = ["plan-review", "clarification", "actual-review", "re-review"].includes(o.state);
        return (
          <span className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {onDepart && o.state === "plan-approved" && <button className="btn btn-sm" onClick={() => onDepart(o.id)} aria-label={`Record departure for ${emp.name}`}>Depart</button>}
            <button className={cn("btn btn-sm", needs && "btn-primary")} onClick={() => onOpen(o.id)} aria-label={`${needs ? "Review" : "View"} ${o.id} for ${emp.name}`}>{needs ? "Review" : "View"}</button>
          </span>
        );
      },
    },
  ];

  return (
    <DataGrid
      columns={cols}
      rows={rows}
      rowKey={(r) => r.o.id}
      caption="Outing register"
      noun="outings"
      density="tall"
      onSelect={onOpen}
      empty={{ title: "No outings match these filters", action: onClear && <button className="btn btn-sm" onClick={onClear}>Clear filters</button> }}
    />
  );
}
