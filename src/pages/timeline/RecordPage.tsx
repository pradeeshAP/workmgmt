import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Plus, RotateCcw, Save, Trash2, UserRoundSearch } from "lucide-react";
import { cn, fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { empCode } from "@/store/data";
import { POLICY_MAX_PAIRS, dtToMin, permMinutes, toTimelineRow, type AttStatus } from "@/lib/engine";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { Avatar, Tip } from "@/components/ui/primitives";
import { Callout, EmptyState, Panel } from "@/components/kit/Blocks";
import { CoverageRing } from "@/components/kit/Coverage";
import { EmployeeCombobox } from "@/components/kit/EmployeeCombobox";
import { CheckboxCard, DateTimePicker, Field, Input, Select, Textarea } from "@/components/kit/forms";
import { initialsOf } from "@/components/kit/PersonCell";
import { SegmentedControl } from "@/components/kit/Segmented";
import { FlagList, StatusPill } from "@/components/kit/Status";
import { TimeAccountBar } from "@/components/kit/TimeAccountBar";
import { AddPermission } from "./AddPermission";
import { REASONS, TASK_OPTIONS, useAttendanceDraft } from "./draft";
import { Ruler, Track, windowFor } from "./DayTrack";
import { ShiftChip } from "./parts";
import { useDayModel } from "./model";

const STATUS: { value: AttStatus; label: string }[] = [
  { value: "working", label: "Working" },
  { value: "leave", label: "Leave" },
  { value: "absent", label: "Absent" },
  { value: "unmarked", label: "Unmarked" },
];

const BACK: Record<string, { to: string; label: string }> = {
  people: { to: "/people-attendance", label: "People" },
  shift: { to: "/shift-timeline", label: "Shift timeline" },
  overview: { to: "/timeline", label: "Overview" },
  sessions: { to: "/sessions", label: "Sessions" },
  individual: { to: "/individual", label: "Individual report" },
};

/**
 * One person on one day: how it adds up as you edit, the punches, permissions and notes.
 * It is a screen of its own, so nothing here has to scroll inside a drawer.
 */
export default function RecordPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const { filters, setFilters, permissions } = useApp();
  const { all } = useDayModel();
  const [addPerm, setAddPerm] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  const emp = q.get("emp") ?? "";
  const date = q.get("date");
  const from = q.get("from") ?? "people";
  // a link may carry its own day; the rest of the app follows it
  useEffect(() => { if (date && date !== filters.date) setFilters({ date }); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  const person = all.find((p) => p.emp.id === emp) ?? null;
  const { draft, live, errs, errCount, dirty, atLimit, set, setPair, addPair, removePair, save, reset } = useAttendanceDraft(person);

  const scheduled = all.filter((p) => p.shift);
  const idx = scheduled.findIndex((p) => p.emp.id === emp);
  const step = (n: number) => { const t = scheduled[(idx + n + scheduled.length) % scheduled.length]; if (t) navigate("/attendance-record", { emp: t.emp.id, from }); };
  const back = BACK[from] ?? BACK.people;

  const switcher = {
    active: false,
    onReset: () => undefined,
    node: <EmployeeCombobox value={emp} onChange={(id) => navigate("/attendance-record", { emp: id, from })} className="w-[220px]" label="Person" />,
  };

  if (!person || !draft || !live) {
    return (
      <>
        <PageHead route={route} back={back} />
        <FilterBar fields={route.filters} extra={switcher} />
        <PageBody>
          <Panel flush><EmptyState icon={UserRoundSearch} title="Choose a person" text="Pick someone above to see and edit their day." /></Panel>
        </PageBody>
      </>
    );
  }

  const { shift } = person;
  const myPerms = permissions.filter((p) => p.employeeId === person.emp.id && p.date === person.date);
  const covered = live.work + live.permission + live.duty;
  // the day as it will read once saved: the track follows every edit
  const row = shift ? toTimelineRow(person.emp.id, person.emp.name, "", shift, live, draft) : null;
  const win = row ? windowFor([row]) : null;

  return (
    <>
      <PageHead
        route={route}
        back={back}
        meta={<><b className="font-semibold text-ink">{person.emp.name}</b><span className="tnum">· {format(parseISO(person.date), "EEE, dd MMM yyyy")}</span></>}
        actions={
          <>
            {scheduled.length > 1 && (
              <div className="inline-flex" role="group" aria-label="Move between people">
                <Tip label="Previous person"><button className="btn btn-icon border border-line-strong" onClick={() => step(-1)} aria-label="Previous person"><ChevronLeft className="h-4 w-4" aria-hidden /></button></Tip>
                <Tip label="Next person"><button className="btn btn-icon ml-1 border border-line-strong" onClick={() => step(1)} aria-label="Next person"><ChevronRight className="h-4 w-4" aria-hidden /></button></Tip>
              </div>
            )}
            {shift && dirty && <button className="btn" onClick={reset}><RotateCcw aria-hidden />Discard</button>}
            {shift && <button className="btn btn-primary" disabled={errCount > 0 || !dirty} onClick={save}><Save aria-hidden />Save attendance</button>}
          </>
        }
      />
      <FilterBar fields={route.filters} extra={switcher} />

      <PageBody>
        <section aria-label="The day, accounted for" className="panel">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 p-3">
            <div className="flex min-w-[260px] items-center gap-3">
              <Avatar initials={initialsOf(person.emp.name)} size={42} />
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-semibold tracking-tight text-ink">{person.emp.name}</h2>
                <p className="truncate text-small text-muted"><span className="tnum font-semibold text-ink-2">{empCode(person.emp.id)}</span> · {person.emp.dept} · {person.emp.role}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ShiftChip shift={shift} withTime />
                  {shift && <FlagList flags={person.res.flags} max={2} />}
                </div>
              </div>
            </div>

            {shift && (
              <>
                <div className="flex items-center gap-3">
                  <CoverageRing pct={live.coverage} size={62} stroke={7} />
                  <div>
                    <div className="eyebrow">Required</div>
                    <div className="text-kpi tnum text-ink">{fmtDuration(live.required)}</div>
                    <div className="text-small text-muted"><b className="tnum text-ink-2">{fmtDuration(covered)}</b> covered{dirty && <span className="ml-1 font-semibold text-brand-ink">· unsaved</span>}</div>
                  </div>
                </div>
                <div className="min-w-[280px] flex-1">
                  <TimeAccountBar account={{ required: live.required, work: live.work, permission: live.permission, duty: live.duty, gap: live.gap, unresolved: live.unresolved }} />
                </div>
                <div className="flex items-center gap-2.5 border-l border-line pl-4">
                  <span aria-hidden className="h-7 w-[3px] rounded-full bg-extra" />
                  <div>
                    <div className="eyebrow">Extra time</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-kpi tnum text-ink">{fmtDuration(live.extra)}</span>
                      {live.extra > 0 && <span className="text-small text-muted">{draft.approveExtra ? "approved" : "awaiting approval"}</span>}
                    </div>
                  </div>
                </div>
                <SegmentedControl label="Attendance status" value={draft.status} onChange={(v) => set({ status: v })} options={STATUS} />
              </>
            )}
          </div>
          {row && win && (
            <div className="border-t border-line px-3 pb-3 pt-1.5">
              <Ruler win={win} hover={hover} />
              <Track row={row} win={win} hover={hover} onHover={setHover} />
            </div>
          )}
        </section>

        {!shift ? (
          <Callout kind="info" lead="No shift is assigned on this date" action={<a className="btn btn-sm" href="#/shift-timeline">Open shift timeline</a>} />
        ) : (
          <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Panel
              title="Punch pairs"
              count={`${draft.pairs.length} / ${POLICY_MAX_PAIRS}`}
              flush
              actions={
                atLimit ? (
                  <Tip label={`Policy allows ${POLICY_MAX_PAIRS} sessions per shift. Remove a pair to add another.`}>
                    <span tabIndex={0} className="inline-flex"><button className="btn btn-sm" disabled><Plus aria-hidden />Add pair</button></span>
                  </Tip>
                ) : (
                  <button className="btn btn-sm" onClick={addPair} disabled={draft.status !== "working"}><Plus aria-hidden />Add pair</button>
                )
              }
            >
              {draft.status !== "working" ? (
                <div className="p-3.5"><Callout kind="info" lead={draft.status === "leave" ? "Approved leave credits the whole shift" : draft.status === "absent" ? "Absent leaves the whole shift uncovered" : "Unmarked shows the whole shift as unresolved"} /></div>
              ) : draft.pairs.length === 0 ? (
                <p className="px-3.5 py-6 text-center text-body text-muted">No punches yet. Add a pair to record the first check-in.</p>
              ) : (
                <ol className="divide-y divide-line">
                  {draft.pairs.map((p, i) => {
                    const e = errs[p.id] ?? {};
                    const a = dtToMin(p.in, person.date);
                    const b = p.out ? dtToMin(p.out, person.date) : null;
                    return (
                      <li key={p.id} className={cn("px-3.5 py-2.5", (e.in || e.out) && "bg-gap-soft/40")}>
                        <div className="grid items-start gap-x-3 gap-y-2 md:grid-cols-[26px_minmax(0,1fr)_minmax(0,1fr)_72px_28px]">
                          <span aria-hidden className="mt-1 flex h-6 w-6 items-center justify-center rounded-md bg-work-soft text-[11px] font-bold text-work-ink">{i + 1}</span>
                          <Field label="Check-in" error={e.in}><DateTimePicker value={p.in} baseDate={person.date} onChange={(v) => setPair(p.id, { in: v })} /></Field>
                          <Field label="Check-out" error={e.out}><DateTimePicker value={p.out} baseDate={person.date} onChange={(v) => setPair(p.id, { out: v })} /></Field>
                          <div className="pt-[18px] text-right text-small text-muted">
                            {a !== null && b !== null && b > a ? <b className="tnum text-body font-semibold text-ink">{fmtDuration(b - a)}</b> : p.out ? "" : <span className="chip chip-duty">open</span>}
                            <div className="tnum">{a !== null ? fmtClock(a) : "--:--"} → {b !== null ? fmtClock(b) : "…"}</div>
                          </div>
                          <button className="btn-icon mt-[18px] h-7 w-7" aria-label={`Remove pair ${i + 1}`} onClick={() => removePair(p, i + 1)}><Trash2 className="h-3.5 w-3.5" aria-hidden /></button>
                        </div>
                        <div className="mt-2 grid gap-2 md:ml-[38px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)]">
                          <Field label="Exit reason"><Select value={p.reason} onChange={(ev) => setPair(p.id, { reason: ev.target.value })} options={[{ value: "", label: "Select reason" }, ...REASONS]} /></Field>
                          <Field label="Linked task"><Select value={p.taskId} onChange={(ev) => setPair(p.id, { taskId: ev.target.value })} options={TASK_OPTIONS} /></Field>
                          <Field label="Exit note" optional><Input value={p.note} onChange={(ev) => setPair(p.id, { note: ev.target.value })} placeholder="Optional" /></Field>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
              {errCount > 0 && <p role="alert" className="border-t border-line px-3.5 py-2 text-small font-medium text-gap-ink">Fix {errCount} {errCount === 1 ? "error" : "errors"} above to save.</p>}
            </Panel>

            <div className="space-y-3">
              <Panel
                title="Permissions"
                count={myPerms.length || undefined}
                flush
                actions={<button className="btn btn-sm" onClick={() => setAddPerm(true)}><Plus aria-hidden />Add</button>}
              >
                {myPerms.length === 0 ? (
                  <p className="flex items-center gap-2 px-3.5 py-3 text-body text-muted"><CalendarClock className="h-4 w-4 shrink-0 text-faint" aria-hidden />None on this shift</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {myPerms.map((p) => {
                      const iv = permMinutes(p);
                      return (
                        <li key={p.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                          <div className="min-w-0">
                            <div className="tnum text-body font-semibold text-ink">{fmtClock(iv.start)} – {fmtClock(iv.end)}</div>
                            <div className="truncate text-small text-muted">{p.kind} · {p.reason}</div>
                          </div>
                          <StatusPill permission={p.status} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel title="Notes">
                <div className="space-y-2.5">
                  <Field label="Note" optional>
                    <Textarea rows={2} value={draft.note} maxLength={240} onChange={(e) => set({ note: e.target.value })} placeholder="Add context for the record" />
                  </Field>
                  <CheckboxCard checked={draft.approveExtra} onChange={(v) => set({ approveExtra: v })} title="Approve recorded extra time outside the shift" />
                </div>
              </Panel>
            </div>
          </div>
        )}
      </PageBody>

      <AddPermission person={person} open={addPerm} onClose={() => setAddPerm(false)} />
    </>
  );
}
