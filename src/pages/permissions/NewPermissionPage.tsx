import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { fmtClock } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, SHIFTS, TODAY, type PermissionRequest } from "@/store/data";
import { dtToMin, minToDt, permMinutes } from "@/lib/engine";
import { shiftIdFor } from "@/pages/timeline/model";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Panel } from "@/components/kit/Blocks";
import { Callout } from "@/components/kit/Blocks";
import { Combobox, DatePicker, DateTimePicker, Field, Input, Select, Textarea } from "@/components/kit/forms";
import { SegmentedControl } from "@/components/kit/Segmented";
import { Switch } from "@/components/kit/Switch";
import { useTasks } from "@/pages/tasks/store";
import { applyDecision, rememberedReviewer } from "./model";

type WindowType = "Late arrival" | "In-shift permission" | "Early departure";
type Purpose = "Personal" | "Business duty";
const TYPES: WindowType[] = ["Late arrival", "In-shift permission", "Early departure"];
const stamp = (m: number) => fmtClock(m).replace(" +", "+");

/** Record time away on behalf of someone: a screen of its own, in two columns, so the form never scrolls inside a dialog. */
export default function NewPermissionPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const back = q.get("from") === "time-away" ? { to: "/time-away", label: "Time away" } : { to: "/permissions", label: "Permission desk" };
  const onClose = () => navigate(back.to);
  const { permissions, setPermissions, assignments, toast } = useApp();
  const [who, setWho] = useState(() => q.get("emp") || useApp.getState().filters.employee || EMPLOYEES[0].id);
  const [date, setDate] = useState(TODAY);
  const [type, setType] = useState<WindowType>("In-shift permission");
  const [kind, setKind] = useState<Purpose>("Personal");
  const [taskCode, setTaskCode] = useState("");
  const tasks = useTasks((t) => t.tasks);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [purpose, setPurpose] = useState("");
  const [destination, setDestination] = useState("");
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");
  const [approve, setApprove] = useState(false);
  const [reviewer, setReviewer] = useState("");
  const [tried, setTried] = useState(false);

  const sid = shiftIdFor(who, date, assignments);
  const shift = SHIFTS.find((s) => s.id === sid) ?? null;

  useEffect(() => { setReviewer(rememberedReviewer()); }, []);

  // sensible starting times for the chosen type, which can then be edited
  useEffect(() => {
    if (!shift) return;
    const s = shift.start, e = shift.end;
    const [a, b] = type === "Late arrival" ? [s, s + 30] : type === "Early departure" ? [e - 30, e] : [shift.breakEnd, shift.breakEnd + 60];
    setFrom(minToDt(a, date)); setTo(minToDt(b, date));
  }, [who, date, type, shift?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // minutes from the shift start date's midnight, so a window after midnight reads +1
  const a = shift ? (type === "Late arrival" ? shift.start : dtToMin(from, date)) : null;
  const b = shift ? (type === "Early departure" ? shift.end : dtToMin(to, date)) : null;

  // tasks this person is working on, newest deadline first; picking one fills in the context below
  const mine = useMemo(
    () => tasks.filter((t) => t.lifecycle === "live" && t.assignees.some((x) => x.empId === who)).sort((x, y) => y.due.localeCompare(x.due)),
    [tasks, who]
  );
  useEffect(() => { if (taskCode && !mine.some((t) => t.code === taskCode)) setTaskCode(""); }, [mine, taskCode]);
  const linkTask = (code: string) => {
    setTaskCode(code);
    const t = tasks.find((x) => x.code === code);
    if (!t) return;
    setKind("Business duty");
    setPurpose(t.title);
    setDestination(t.destination);
    setRef(t.code);
  };

  const clash = (() => {
    if (a === null || b === null) return null;
    return permissions.find((p) => {
      if (p.employeeId !== who || p.date !== date || (p.status !== "pending" && p.status !== "approved")) return false;
      const w = permMinutes(p);
      return a < w.end && b > w.start;
    });
  })();

  const errors = {
    shift: !shift ? "This employee has no shift on this date." : "",
    time: !tried || !shift ? "" : a === null || b === null ? "Enter both times." : a < shift.start || b > shift.end ? `Keep it inside the shift, ${fmtClock(shift.start)} to ${fmtClock(shift.end)}.` : b <= a ? "The end must be after the start." : clash ? `Overlaps an existing request, ${clash.from} to ${clash.to}.` : "",
    purpose: tried && purpose.trim().length < 3 ? "Add the task or purpose." : "",
    destination: tried && kind === "Business duty" && destination.trim().length < 2 ? "A business outing needs a destination." : "",
    reason: tried && reason.trim().length < 3 ? "Add a short reason." : "",
    reviewer: tried && approve && reviewer.trim().length < 2 ? "Enter the reviewer's name." : "",
  };

  const submit = () => {
    setTried(true);
    if (!shift || a === null || b === null || a < shift.start || b > shift.end || b <= a || clash) return;
    if (purpose.trim().length < 3 || reason.trim().length < 3 || (approve && reviewer.trim().length < 2)) return;
    if (kind === "Business duty" && destination.trim().length < 2) return;
    const req: PermissionRequest = {
      id: `p${Date.now()}`, employeeId: who, date, from: stamp(a), to: stamp(b),
      kind,
      reason: reason.trim(), purpose: purpose.trim(),
      destination: destination.trim() || undefined, ref: ref.trim() || undefined,
      status: "pending", requestedAt: new Date().toISOString(),
    };
    setPermissions(approve ? applyDecision([...permissions, req], [req.id], "approved", reviewer) : [...permissions, req]);
    const { from: f, to: t } = useApp.getState().filters;
    toast("success", `${approve ? "Permission approved." : "Request added. Pending requests earn no credit."}${date < f || date > t ? " It is outside the current date range." : ""}`);
    onClose();
  };

  const fixedStart = type === "Late arrival";
  const fixedEnd = type === "Early departure";
  return (
    <>
      <PageHead
        route={route}
        back={back}
        actions={
          <>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>{approve ? "Add and approve" : "Add request"}</button>
          </>
        }
      />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Panel title="Who and when">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Employee" required>
                    <Combobox value={who} onChange={setWho} options={EMPLOYEES.map((e) => ({ value: e.id, label: e.name, hint: e.dept }))} />
                  </Field>
                  <Field label="Shift date" required>
                    <DatePicker value={date} onChange={setDate} />
                  </Field>
                </div>
                {errors.shift ? (
                  <Callout kind="warning" lead={errors.shift} />
                ) : shift && (
                  <Callout kind="info" lead={`${shift.name} shift, ${fmtClock(shift.start)} to ${fmtClock(shift.end)}.`} />
                )}
              </div>
            </Panel>

            {shift && (
              <Panel title="Time away window">
                <div className="space-y-3">
                  <Field label="Kind of window">
                    <Select value={type} onChange={(e) => setType(e.target.value as WindowType)} options={TYPES.map((t) => ({ value: t, label: t }))} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Requested start" required={!fixedStart} error={fixedEnd ? "" : errors.time}>
                      {fixedStart ? <Input value={`${format(parseISO(date), "dd MMM")} · ${fmtClock(shift.start)}`} readOnly tabIndex={-1} /> : <DateTimePicker value={from} baseDate={date} onChange={setFrom} />}
                    </Field>
                    <Field label="Requested end" required={!fixedEnd} error={fixedEnd ? errors.time : ""}>
                      {fixedEnd ? <Input value={`${format(parseISO(date), "dd MMM")} · ${fmtClock(shift.end)}`} readOnly tabIndex={-1} /> : <DateTimePicker value={to} baseDate={date} onChange={setTo} />}
                    </Field>
                  </div>
                  {fixedStart && errors.time && <p role="alert" className="text-small font-medium text-gap-ink">{errors.time}</p>}
                  <Field label="Reason" required error={errors.reason}>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why the time is needed" />
                  </Field>
                </div>
              </Panel>
            )}
          </div>

          <div className="space-y-3">
            <Panel title="Purpose & task context">
              <div className="space-y-3">
                <SegmentedControl<Purpose>
                  label="Purpose"
                  value={kind}
                  onChange={(v) => { setKind(v); if (v === "Personal") { setTaskCode(""); setRef(""); } }}
                  options={[{ value: "Personal", label: "Personal permission" }, { value: "Business duty", label: "Business outing" }]}
                />
                <Field label="Linked task" optional>
                  <Select
                    value={taskCode}
                    onChange={(e) => linkTask(e.target.value)}
                    options={[{ value: "", label: mine.length ? "No linked task" : "No open task for this person" }, ...mine.map((t) => ({ value: t.code, label: `${t.code} · ${t.title}` }))]}
                  />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Task or purpose" required error={errors.purpose}>
                    <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={kind === "Business duty" ? "e.g. Client site visit" : "e.g. Bank errand"} maxLength={60} />
                  </Field>
                  <Field label="Task reference" optional><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. TSK-2041" maxLength={30} /></Field>
                  <Field label="Destination" required={kind === "Business duty"} optional={kind !== "Business duty"} error={errors.destination} className="sm:col-span-2">
                    <Input value={destination} onChange={(e) => setDestination(e.target.value)} maxLength={60} placeholder={kind === "Business duty" ? "Where the work happens" : "Optional"} />
                  </Field>
                </div>
              </div>
            </Panel>

            <Panel title="Decision">
              <div className="space-y-3">
                <Switch checked={approve} onChange={setApprove} title="Approve now" />
                {approve && (
                  <Field label="Reviewer" required error={errors.reviewer}>
                    <Input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Your name" maxLength={60} />
                  </Field>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
