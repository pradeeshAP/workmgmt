import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, CircleCheck, MapPin, Route as RouteIcon, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMin } from "@/lib/engine";
import { empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { PersonCell } from "@/components/kit/PersonCell";
import { NEEDS_REVIEW, useOutingRows, type OutingRow } from "@/pages/outings/model";
import { EstimateBar, StatePill, Variance } from "@/pages/outings/parts";
import { useTasks } from "./store";

const worst = (r: OutingRow) => Math.max(r.f.reqVsEst, r.f.actVsEst ?? -9999);

/** "Does this outing add up?": the outing that most needs a second look, one at a time, most doubtful first. */
export default function OutingCheckPage({ route }: { route: Route }) {
  const rows = useOutingRows(false);
  const tasks = useTasks((s) => s.tasks);
  const queue = useMemo(() => rows.filter((r) => NEEDS_REVIEW.includes(r.o.state)).sort((a, b) => worst(b) - worst(a)), [rows]);
  const [i, setI] = useState(0);
  const at = Math.min(i, Math.max(queue.length - 1, 0));
  useEffect(() => { if (i > queue.length - 1) setI(0); }, [queue.length, i]);
  const r = queue[at];

  return (
    <>
      <PageHead
        route={route}
        back={{ to: "/tasks", label: "Tasks & outings" }}
        meta={<span className="tnum">{queue.length} to check</span>}
        actions={
          queue.length > 1 ? (
            <div className="flex items-center gap-1">
              <button className="btn btn-icon border border-line-strong" aria-label="Previous outing" onClick={() => setI((at - 1 + queue.length) % queue.length)}><ChevronLeft className="h-4 w-4" aria-hidden /></button>
              <span className="tnum min-w-[56px] text-center text-body font-semibold text-ink-2" aria-live="polite">{at + 1} of {queue.length}</span>
              <button className="btn btn-icon border border-line-strong" aria-label="Next outing" onClick={() => setI((at + 1) % queue.length)}><ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          ) : undefined
        }
      />
      <PageBody>
        {!r ? (
          <Panel flush><EmptyState icon={CircleCheck} title="Nothing to check" text="No outing is waiting for review." /></Panel>
        ) : (
          <Spot r={r} title={tasks.find((t) => t.code === r.o.taskCode)?.title} />
        )}
      </PageBody>
    </>
  );
}

function Spot({ r, title }: { r: OutingRow; title?: string }) {
  const { o, emp, f } = r;
  const over = f.reqVsEst > 0;
  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <Panel title="The outing" actions={<StatePill state={o.state} />}>
        <div className="space-y-3">
          <PersonCell name={emp.name} id={emp.id} sub={`${empCode(emp.id)} · ${emp.dept}`} size={34} />
          <div>
            <p className="tnum text-h3 text-ink">{o.taskCode}{title ? ` · ${title}` : ""}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-body text-ink-2">
              <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted" aria-hidden />{o.destination}</span>
              <span className="tnum flex items-center gap-1.5"><RouteIcon className="h-4 w-4 text-muted" aria-hidden />{o.km} km</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-input bg-surface-2 px-3 py-2">
              <div className="eyebrow">Requested</div>
              <div className="tnum mt-0.5 text-kpi text-ink">{fmtMin(f.requested)}</div>
              <div className="tnum text-small text-muted">{o.reqOut} → {o.reqReturn}</div>
            </div>
            <div className={cn("rounded-input px-3 py-2", over ? "bg-duty-soft" : "bg-surface-2")}>
              <div className="eyebrow">Estimated</div>
              <div className="tnum mt-0.5 text-kpi text-ink">{fmtMin(f.estimated)}</div>
              <div className="tnum text-small text-muted">{o.km} km</div>
            </div>
          </div>
          <EstimateBar est={o.est} labels />
        </div>
      </Panel>

      <div className="space-y-3">
        {over ? (
          <div role="alert" className="flex items-center gap-2.5 rounded-input border border-duty/50 bg-duty-soft px-3 py-2.5">
            <TriangleAlert className="h-4 w-4 shrink-0 text-duty" aria-hidden />
            <p className="text-body font-semibold text-ink">{fmtMin(f.reqVsEst)} over the window</p>
          </div>
        ) : (
          <div role="note" className="flex items-center gap-2.5 rounded-input border border-work/50 bg-work-soft px-3 py-2.5">
            <CircleCheck className="h-4 w-4 shrink-0 text-work" aria-hidden />
            <p className="text-body font-semibold text-ink">{f.reqVsEst < 0 ? `Fits, ${fmtMin(-f.reqVsEst)} spare` : "Fits the window exactly"}</p>
          </div>
        )}
        <Panel title="Actual">
          {o.actualOut ? (
            <>
              <p className="tnum flex items-center gap-2 text-kpi text-ink">{o.actualOut}<ArrowRight className="h-3.5 w-3.5 text-faint" aria-hidden />{o.actualReturn ?? <span className="text-body font-normal text-muted">still away</span>}</p>
              <p className="tnum text-small text-muted">{f.actual !== null ? `${fmtMin(f.actual)} elapsed` : `Away since ${o.actualOut}`}</p>
              <div className="mt-1.5"><Variance label="Actual vs estimate" value={f.actVsEst} /></div>
            </>
          ) : (
            <p className="text-body text-muted">No punches yet</p>
          )}
        </Panel>
        <button className="btn btn-primary w-full" onClick={() => navigate("/outing-review", { id: o.id, from: "tasks" })}>Open outing &amp; review</button>
      </div>
    </div>
  );
}
