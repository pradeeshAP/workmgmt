import { useEffect, useMemo, useState } from "react";
import { fmtMin } from "@/lib/engine";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, TODAY } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, Panel } from "@/components/kit/Blocks";
import { DatePicker, Field, Input, NumberInput, Select, Textarea, TimeInput } from "@/components/kit/forms";
import { useTasks } from "@/pages/tasks/store";
import { PARTS, estTotal, toMin, validTime, type Estimate } from "./model";
import { useOutings } from "./store";
import { EstimateBar, Variance } from "./parts";

const ZERO: Estimate = { outbound: 30, onsite: 60, ret: 30, buffer: 10 };

const BACK: Record<string, { to: string; label: string }> = {
  outings: { to: "/outings", label: "Outing control" },
  tasks: { to: "/tasks", label: "Tasks & outings" },
  kanban: { to: "/kanban", label: "Employee Kanban" },
};

/** Plan an outing: the employee's request, with the manual estimate HR will review. A screen of its own, in two columns. */
export default function OutingPlanPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const taskCode = q.get("task") ?? undefined;
  const back = BACK[q.get("from") ?? "outings"] ?? BACK.outings;
  const tasks = useTasks((s) => s.tasks);
  const add = useOutings((s) => s.add);
  const { toast, filters } = useApp();

  const t0 = tasks.find((x) => x.code === taskCode);
  const [emp, setEmp] = useState(() => t0?.assignees[0]?.empId ?? (filters.employee || "e2"));
  const [code, setCode] = useState(t0?.code ?? "");
  const [date, setDate] = useState(t0 ? t0.start.slice(0, 10) : TODAY);
  const [dest, setDest] = useState(t0?.destination ?? "");
  const [km, setKm] = useState<number | null>(10);
  const [out, setOut] = useState("10:00");
  const [back_, setBack] = useState("12:00");
  const [est, setEst] = useState<Estimate>(ZERO);
  const [purpose, setPurpose] = useState("");
  const [tried, setTried] = useState(false);

  const options = useMemo(
    () => tasks.filter((t) => t.lifecycle === "live" && t.assignees.some((a) => a.empId === emp && (t.code === taskCode || (a.outcome !== "on-time" && a.outcome !== "late-done")))),
    [tasks, emp, taskCode]
  );

  // keep the chosen task valid for the chosen person
  useEffect(() => {
    if (!options.some((t) => t.code === code)) {
      const first = options[0];
      setCode(first?.code ?? "");
      if (first) setDest(first.destination);
    }
  }, [options]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = estTotal(est);
  const timesOk = validTime(out) && validTime(back_) && toMin(back_) > toMin(out);
  const requested = timesOk ? toMin(back_) - toMin(out) : 0;
  const over = timesOk ? total - requested : 0;
  const err = {
    task: !code ? "This person has no open task. Create one on Tasks & outings first." : "",
    dest: tried && !dest.trim() ? "Say where the outing goes." : "",
    km: tried && !km ? "Enter the distance in kilometres." : "",
    time: tried && !timesOk ? "Enter both times as HH:MM, with the return after the departure." : "",
    est: tried && total === 0 ? "Add at least one part of the estimate." : "",
    purpose: tried && purpose.trim().length < 5 ? "Say what the outing is for, in at least 5 characters." : "",
  };

  const submit = () => {
    setTried(true);
    if (!code || !dest.trim() || !km || !timesOk || total === 0 || purpose.trim().length < 5) return;
    const made = add({ employeeId: emp, taskCode: code, date, destination: dest.trim(), km, reqOut: out, reqReturn: back_, est, purpose: purpose.trim() }, EMPLOYEES.find((e) => e.id === emp)?.name ?? "Employee");
    toast("success", `${made.id} requested. It is waiting for plan review.`);
    navigate("/outing-review", { id: made.id, from: q.get("from") ?? "outings" });
  };

  return (
    <>
      <PageHead
        route={route}
        back={back}
        actions={
          <>
            <button className="btn" onClick={() => navigate(back.to)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>Request outing</button>
          </>
        }
      />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Panel title="The outing">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Employee" required>
                  <Select value={emp} onChange={(e) => setEmp(e.target.value)} options={EMPLOYEES.map((e) => ({ value: e.id, label: e.name }))} />
                </Field>
                <Field label="Task" required error={err.task}>
                  <Select value={code} onChange={(e) => { setCode(e.target.value); const t = tasks.find((x) => x.code === e.target.value); if (t) setDest(t.destination); }} options={options.length ? options.map((t) => ({ value: t.code, label: `${t.code} · ${t.title}` })) : [{ value: "", label: "No open task" }]} />
                </Field>
                <Field label="Destination" required error={err.dest}><Input value={dest} maxLength={80} onChange={(e) => setDest(e.target.value)} placeholder="Where the outing goes" /></Field>
                <Field label="Distance" required error={err.km}><NumberInput value={km} onChange={setKm} unit="km" max={999} /></Field>
                <Field label="Date" required><DatePicker value={date} onChange={setDate} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Out" required error={err.time}><TimeInput value={out} onChange={setOut} /></Field>
                  <Field label="Return" required><TimeInput value={back_} onChange={setBack} /></Field>
                </div>
              </div>
              <Field label="Purpose" required error={err.purpose}>
                <Textarea value={purpose} rows={2} maxLength={160} onChange={(e) => setPurpose(e.target.value)} placeholder="What will be done there, and why it needs a trip" />
              </Field>
            </div>
          </Panel>

          <div className="space-y-3">
            <Panel title="Manual estimate, in minutes">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PARTS.map((p) => (
                  <Field key={p.key} label={p.label}>
                    <NumberInput value={est[p.key]} onChange={(v) => setEst({ ...est, [p.key]: v ?? 0 })} max={600} step={5} />
                  </Field>
                ))}
              </div>
              <div className="mt-3"><EstimateBar est={est} labels /></div>
              {err.est && <p role="alert" className="mt-2 text-small font-medium text-gap-ink">{err.est}</p>}
            </Panel>

            <Panel title="Estimated need vs requested">
              <section aria-label="Estimated need against requested" aria-live="polite">
                <div className="tnum flex flex-wrap items-baseline gap-x-6 gap-y-1">
                  <span className="text-body text-muted">Estimate <b className="text-h2 text-ink">{fmtMin(total)}</b></span>
                  <span className="text-body text-muted">Window <b className="text-h2 text-ink">{timesOk ? fmtMin(requested) : "—"}</b></span>
                  <Variance label="Estimate vs window" value={timesOk ? over : null} />
                </div>
                {timesOk && over > 0 && <Callout kind="warning" lead={`The estimate is ${fmtMin(over)} longer than the window.`} className="mt-3" />}
              </section>
            </Panel>
          </div>
        </div>
      </PageBody>
    </>
  );
}
