import { useMemo, useState } from "react";
import { eachDayOfInterval, differenceInCalendarDays, format, parseISO } from "date-fns";
import { Lock } from "lucide-react";
import { fmtClock } from "@/lib/utils";
import { isWeekend } from "@/lib/engine";
import { useApp } from "@/store/useApp";
import { EMPLOYEES } from "@/store/data";
import { activeTemplates, useTemplates } from "@/store/templates";
import { shiftIdFor } from "@/pages/timeline/model";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { DatePicker, EmployeePicker, Field, Select } from "@/components/kit/forms";
import { Callout, Panel } from "@/components/kit/Blocks";
import { Switch } from "@/components/kit/Switch";
import { lockReason } from "./model";

const MAX_SPAN = 62;
const PEOPLE = EMPLOYEES.map((e) => ({ id: e.id, name: e.name, sub: `${e.dept} · ${e.role}` }));

/** Assign employees to a shift for a range of days. A screen of its own: the form on the left, the employees on the right. */
export default function AssignPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const spec = useMemo(() => ({ empIds: (q.get("emp") ?? "").split(",").filter(Boolean), from: q.get("from") ?? useApp.getState().filters.week, to: q.get("to") ?? useApp.getState().filters.week }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { assignments, attendance, permissions, assignShifts, toast } = useApp();
  const templates = useTemplates((s) => s.templates);
  const active = activeTemplates(templates);
  const close = () => navigate("/planner");

  const first = EMPLOYEES.find((e) => e.id === spec.empIds[0]);
  const [empIds, setEmpIds] = useState(spec.empIds);
  const [from, setFrom] = useState(spec.from);
  const [to, setTo] = useState(spec.to);
  const [weekends, setWeekends] = useState(() => eachDayOfInterval({ start: parseISO(spec.from), end: parseISO(spec.to) }).some((d) => isWeekend(format(d, "yyyy-MM-dd"))));
  const [replace, setReplace] = useState(true);
  const [shiftId, setShiftId] = useState(() => (active.some((s) => s.id === first?.shiftId) ? first!.shiftId : active[0]?.id ?? ""));

  const span = differenceInCalendarDays(parseISO(to), parseISO(from)) + 1;
  const rangeError = span < 1 ? "The end date must be on or after the start date." : span > MAX_SPAN ? `Choose a range of ${MAX_SPAN} days or fewer.` : "";

  const plan = useMemo(() => {
    if (rangeError) return { changes: {} as Record<string, string>, locked: 0, same: 0, overlap: 0 };
    const dates = eachDayOfInterval({ start: parseISO(from), end: parseISO(to) }).map((d) => format(d, "yyyy-MM-dd")).filter((d) => weekends || !isWeekend(d));
    const changes: Record<string, string> = {};
    let locked = 0, same = 0, overlap = 0;
    for (const id of empIds) {
      for (const date of dates) {
        const cur = shiftIdFor(id, date, assignments);
        if (lockReason(id, date, cur, attendance, permissions)) { locked++; continue; }
        if ((cur ?? "") === shiftId) { same++; continue; }
        // a different shift already sits on the day: only replaced when the toggle says so
        if (cur && !replace) { overlap++; continue; }
        changes[`${id}|${date}`] = shiftId;
      }
    }
    return { changes, locked, same, overlap };
  }, [empIds, from, to, weekends, replace, shiftId, rangeError, assignments, attendance, permissions]);

  const n = Object.keys(plan.changes).length;
  const shiftName = active.find((s) => s.id === shiftId)?.name;
  const clearing = shiftId === "";
  const problem = empIds.length === 0 ? "Choose at least one employee." : rangeError || (n === 0 ? "Nothing to change for this choice." : "");

  const submit = () => {
    if (problem) return;
    assignShifts(plan.changes);
    toast(
      "success",
      `${n} ${n === 1 ? "assignment" : "assignments"} ${clearing ? "cleared" : `set to ${shiftName}`}.${plan.locked ? ` ${plan.locked} protected ${plan.locked === 1 ? "day was" : "days were"} left as recorded.` : ""}${plan.overlap ? ` ${plan.overlap} existing ${plan.overlap === 1 ? "assignment was" : "assignments were"} kept.` : ""}`
    );
    close();
  };

  return (
    <>
      <PageHead
        route={route}
        title="Assign employees to a shift"
        back={{ to: "/planner", label: "Shift planner" }}
        actions={
          <>
            <button className="btn" onClick={close}>Cancel</button>
            <button className="btn btn-primary" disabled={!!problem} onClick={submit}>{clearing ? "Clear shifts" : "Assign shift"}{n > 0 ? ` · ${n}` : ""}</button>
          </>
        }
      />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Panel title="Shift template">
              <Field label="Template">
                <Select
                  value={shiftId}
                  onChange={(e) => setShiftId(e.target.value)}
                  options={[
                    ...active.map((s) => ({ value: s.id, label: `${s.name} · ${fmtClock(s.start)} – ${fmtClock(s.end)} · v${s.version}` })),
                    { value: "", label: "No shift (clear the day)" },
                  ]}
                />
              </Field>
            </Panel>
            <Panel title="Dates">
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="From" error={rangeError}><DatePicker value={from} onChange={setFrom} /></Field>
                  <Field label="Through"><DatePicker value={to} onChange={setTo} /></Field>
                </div>
                <Switch checked={weekends} onChange={setWeekends} title="Include weekends" />
                <Switch checked={replace} onChange={setReplace} title="Replace existing unmarked assignments" />
              </div>
            </Panel>
            <p role="status" aria-live="polite" className="panel flex flex-wrap items-center gap-x-2 gap-y-1 px-3.5 py-2.5 text-body text-ink-2">
              <span><b className="tnum text-ink">{n}</b> {n === 1 ? "assignment" : "assignments"} will be {clearing ? "cleared" : "created"}</span>
              <span aria-hidden className="text-faint">·</span>
              <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-muted" aria-hidden /><b className="tnum text-ink">{plan.locked}</b> protected</span>
              <span aria-hidden className="text-faint">·</span>
              <span><b className="tnum text-ink">{plan.overlap}</b> {plan.overlap === 1 ? "overlap" : "overlaps"}</span>
              {plan.same > 0 && <span className="text-muted">· <span className="tnum">{plan.same}</span> already match</span>}
            </p>
            <Callout kind="lock" lead="Recorded days are locked" />
          </div>

          <Panel title="Who gets this shift" count={empIds.length}>
            <Field label="Employees" required error={empIds.length === 0 ? "Choose at least one employee." : ""}>
              <EmployeePicker people={PEOPLE} selected={empIds} onChange={setEmpIds} />
            </Field>
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
