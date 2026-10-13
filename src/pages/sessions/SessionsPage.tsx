import { useEffect, useRef, useState } from "react";
import { Briefcase, CalendarClock, CircleDashed, Clock3, FileDown, FileSpreadsheet, FlaskConical, Hourglass, Layers, Lock, LogIn, LogOut, ShieldCheck, TriangleAlert, UserRoundX } from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { openPdfPreview } from "@/pages/pdf/open";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar } from "@/components/layout/FilterBar";
import { ActionButton } from "@/components/kit/ActionButton";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { FocusedTimeline } from "@/components/kit/ShiftTimeline";
import { MovementStrip } from "@/components/kit/MovementStrip";
import { Pill, type Def } from "@/components/kit/Status";
import { Vitals } from "@/components/kit/Vitals";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/primitives";
import { ShiftChip } from "@/pages/timeline/parts";
import { PRACTICE_ID } from "./data";
import { DEFAULT_EMPLOYEE, useSessionDay } from "./model";
import { sessionsCsv, type DayState, type Session } from "./model-core";
import { useSessions } from "./store";
import { Ledger } from "./Ledger";
import { LinkTaskModal, PunchModal, ReviewModal } from "./Modals";
import { PracticeLab } from "./PracticeLab";
import { NextAction, PolicyCard, TasksCard } from "./SidePanel";

const STATE_PILL: Record<DayState, Def> = {
  "not-in": { label: "Not checked in", tone: "neutral", icon: CircleDashed },
  in: { label: "Checked in", tone: "work", icon: LogIn },
  away: { label: "Away · awaiting return", tone: "duty", icon: Hourglass },
  closed: { label: "Day closed", tone: "neutral", icon: Lock },
};

/** One person, one day: the punches as sessions, how they add up, the policy that governs them and the tasks they serve. */
export default function SessionsPage({ route }: { route: Route }) {
  const { filters, setFilters, toast } = useApp();
  const day = useSessionDay();
  const { person, sessions, events, isPractice, date, policy, state, canRecord, future, used, punches } = day;
  const { shift, res } = person;

  const [punch, setPunch] = useState(false);
  const [linking, setLinking] = useState<Session | null>(null);
  const [reviewing, setReviewing] = useState<Session | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusTimer = useRef<number>();

  // this page works on one employee at a time
  useEffect(() => {
    if (!filters.employee) setFilters({ employee: DEFAULT_EMPLOYEE });
  }, [filters.employee, setFilters]);
  useEffect(() => () => window.clearTimeout(focusTimer.current), []);

  const closed = sessions.filter((s) => s.outMin !== null).length;
  const open = sessions.length - closed;

  const label = state === "closed" ? "Day closed" : state === "in" ? "Record check-out" : state === "away" ? "Record return" : "Record first check-in";
  const RecordIcon = state === "closed" ? Lock : state === "in" ? LogOut : LogIn;
  const why = state === "closed" ? "Return after the final exit is blocked." : !shift ? "No shift is assigned on this date." : future ? "This date has not happened yet." : undefined;

  const goPractice = (mode: "example" | "try") => {
    setFilters({ employee: PRACTICE_ID });
    const lab = useSessions.getState();
    if (mode === "example") lab.completePractice();
    else lab.restartPractice();
    toast("info", mode === "example" ? "Showing the four-session practice day." : "Practice day cleared. Record the first check-in or use Next step.");
  };

  const focusTask = (id: string) => {
    setFocusId(id);
    document.getElementById(`task-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.clearTimeout(focusTimer.current);
    focusTimer.current = window.setTimeout(() => setFocusId(null), 2000);
  };

  // correcting punches happens on the attendance record screen
  const correct = () => {
    if (isPractice) { toast("info", "Practice punches are not corrected. Restart the lab to begin again."); return; }
    navigate("/attendance-record", { emp: person.emp.id, date, from: "sessions" });
  };

  const csv = () => {
    if (sessions.length === 0) { toast("warning", "There are no sessions on this day to export."); return false; }
    const body = sessionsCsv({ name: person.emp.name, code: empCode(person.emp.id), date, policy: policy.name, sessions });
    const url = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-${person.emp.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast("success", `Session CSV downloaded: ${sessions.length} ${sessions.length === 1 ? "row" : "rows"}.`);
  };

  return (
    <>
      <PageHead
        route={route}
        meta={
          <>
            <b className="font-semibold text-ink">{person.emp.name}</b>
            {isPractice && <span className="chip chip-brand">Practice employee</span>}
            <ShiftChip shift={shift} withTime />
            <Pill def={STATE_PILL[state]} />
            <span className="tnum max-xl:hidden">{policy.name} · {used} of {policy.allowed} sessions · {punches} {punches === 1 ? "punch" : "punches"}</span>
          </>
        }
        actions={
          <>
            <Menu>
              <MenuTrigger asChild><button className="btn"><FlaskConical aria-hidden />Practice</button></MenuTrigger>
              <MenuContent>
                <MenuItem icon={Layers} onSelect={() => goPractice("example")}>4-session example</MenuItem>
                <MenuItem icon={LogIn} onSelect={() => goPractice("try")}>Try check-in / out</MenuItem>
              </MenuContent>
            </Menu>
            <ActionButton icon={FileSpreadsheet} busyLabel="Building CSV…" doneLabel="CSV saved" onAction={csv}>CSV</ActionButton>
            <button className="btn" onClick={() => openPdfPreview("daily", { date })}><FileDown aria-hidden />Day PDF</button>
            <button className="btn btn-primary" disabled={!canRecord} onClick={() => setPunch(true)} title={why}><RecordIcon aria-hidden />{label}</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "brand", icon: CalendarClock, label: "Required", value: fmtDuration(res.required), sub: shift ? `${fmtClock(shift.start)}–${fmtClock(shift.end)}` : undefined },
              { tone: "work", icon: Clock3, label: "Work", value: fmtDuration(res.work), sub: `${res.coverage}% accounted` },
              { tone: "duty", icon: Briefcase, label: "Duty", value: fmtDuration(res.duty) },
              { tone: "permission", icon: ShieldCheck, label: "Permission", value: fmtDuration(res.permission) },
              { tone: "gap", icon: TriangleAlert, label: "Uncovered", value: fmtDuration(res.gap), sub: `${fmtDuration(res.unresolved)} unresolved` },
              { tone: "extra", icon: Layers, label: "Sessions", value: sessions.length, sub: `${closed} closed · ${open} open` },
            ]}
          />
        }
      />
      <FilterBar fields={route.filters} singleEmployee />

      <PageBody>
        <NextAction day={day} />
        {isPractice && <PracticeLab day={day} />}

        <Panel title="Day timeline" flush>
          <div className="p-3.5">
            {shift ? (
              <div className="space-y-2.5">
                <FocusedTimeline
                  shift={{ ...shift, label: shift.name }}
                  sessions={sessions.map((s) => ({ start: s.inMin, end: s.outMin ?? Math.max(shift.end, s.inMin + 30), label: `S${s.n}`, open: s.outMin === null }))}
                  away={res.segments
                    .filter((g): g is typeof g & { kind: "permission" | "duty" | "gap" } => g.kind === "permission" || g.kind === "duty" || g.kind === "gap")
                    .map((g) => ({ start: g.start, end: g.end, kind: g.kind, label: g.label ?? `Gap ${fmtDuration(g.end - g.start)}` }))}
                />
                <div className="border-t border-line pt-2.5">
                  {events.length ? <MovementStrip events={events} /> : <p className="text-body text-muted">No punches yet</p>}
                </div>
              </div>
            ) : (
              <EmptyState icon={UserRoundX} title="No shift on this date" action={<a className="btn btn-sm" href="#/shift-timeline">Open shift timeline</a>} />
            )}
          </div>
        </Panel>

        <Ledger day={day} onReview={setReviewing} onLink={setLinking} onTask={focusTask} onCorrect={correct} />

        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <PolicyCard day={day} />
          <TasksCard day={day} focusId={focusId} />
        </div>
      </PageBody>

      <PunchModal open={punch} onClose={() => setPunch(false)} day={day} />
      <LinkTaskModal session={linking} onClose={() => setLinking(null)} day={day} />
      <ReviewModal session={reviewing} onClose={() => setReviewing(null)} day={day} onCorrect={correct} onLink={setLinking} />
    </>
  );
}
