import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { CalendarSearch, Layers, Pencil } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { FlagList } from "@/components/kit/Status";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { ShiftChip } from "@/pages/timeline/parts";
import { buildDay, dayStatus, reviewFlags, TONE_TEXT, toAccount } from "@/pages/reports/model";
import { buildEvents, Flow } from "./flow";

/** One person's day in the order it happened: the time account, every event, and the note. */
export default function DayDetailPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const empId = q.get("emp") ?? "";
  const date = q.get("date") ?? "";
  const permissions = useApp((s) => s.permissions);
  const attendance = useApp((s) => s.attendance);
  const assignments = useApp((s) => s.assignments);
  const emp = EMPLOYEES.find((e) => e.id === empId);
  const day = useMemo(() => (emp && date ? buildDay(emp, date, permissions, attendance, assignments) : null), [emp, date, permissions, attendance, assignments]);
  const events = useMemo(() => (day ? buildEvents(day) : []), [day]);
  const back = { to: "/individual", label: "Individual report" };

  if (!day || !emp || !day.shift) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={CalendarSearch} title="No shift on this day" action={<a className="btn btn-sm" href="#/individual">Back to Individual report</a>} /></Panel></PageBody>
      </>
    );
  }

  const { shift, res, rec } = day;
  const status = dayStatus(day);
  const flags = reviewFlags(day);
  const edit = () => navigate("/attendance-record", { emp: emp.id, date: day.date, from: "individual" });
  const sessions = () => { useApp.getState().setFilters({ employee: emp.id, date: day.date }); navigate("/sessions"); };

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={format(parseISO(day.date), "EEEE, dd MMM yyyy")}
        meta={<><b className="font-semibold text-ink">{emp.name}</b><ShiftChip shift={shift} withTime /><span className={cn("font-semibold", TONE_TEXT[status.tone])}>{status.label}</span></>}
        actions={
          <>
            <button className="btn" onClick={sessions}><Layers aria-hidden />All sessions</button>
            <button className="btn btn-primary" onClick={edit}><Pencil aria-hidden />Edit this day</button>
          </>
        }
      />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel title="What happened, in order" count={events.length}>
            <Flow events={events} />
          </Panel>
          <div className="space-y-3">
            <Panel title="Time account">
              <TimeAccountBar account={toAccount({ required: res.required, work: res.work, permission: res.permission, duty: res.duty, gap: res.gap, unresolved: res.unresolved })} />
              {flags.length > 0 && <FlagList className="mt-3" flags={flags} max={4} />}
              <p className="tnum mt-3 text-small text-muted">{empCode(emp.id)} · {emp.dept} · {fmtClock(shift.start)} – {fmtClock(shift.end)}</p>
            </Panel>
            <Panel title="Attendance note">
              <p className={cn("text-body", rec.note ? "text-ink-2" : "text-muted")}>{rec.note || "No note"}</p>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
