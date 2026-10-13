import { useMemo, useState } from "react";
import { Check, SearchX } from "lucide-react";
import { cn, fmtClock } from "@/lib/utils";
import { fmtMin } from "@/lib/engine";
import { useApp } from "@/store/useApp";
import { useTemplates } from "@/store/templates";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { EmptyState, Panel } from "@/components/kit/Blocks";
import { SHIFT_TONES } from "@/components/kit/buckets";
import { Field, Input, NumberInput, TimeInput } from "@/components/kit/forms";
import { AXIS, TONES, blankForm, formOf, resolve, type Form } from "./model";

/** The 32-hour preview: midnight to 08:00 the next day, so overnight shifts show in full. */
function PreviewBar({ r, tone }: { r: ReturnType<typeof resolve>; tone: Form["tone"] }) {
  const t = SHIFT_TONES[tone];
  const pct = (m: number) => `${(m / AXIS) * 100}%`;
  const ready = r.start !== undefined && r.end !== undefined;
  return (
    <div>
      <div role="img" aria-label={ready ? `Shift from ${fmtClock(r.start!)} to ${fmtClock(r.end!)}` : "No valid window yet"} className="relative h-7 overflow-hidden rounded-input bg-surface-3">
        {ready && <span style={{ left: pct(r.start!), width: pct(r.end! - r.start!) }} className={cn("absolute inset-y-0", t.dot)} />}
        {ready && r.breakStart !== undefined && r.breakEnd !== undefined && r.breakEnd > r.breakStart && (
          <span style={{ left: pct(r.breakStart), width: pct(r.breakEnd - r.breakStart) }} className="hatch absolute inset-y-0 bg-surface-3" />
        )}
        <span aria-hidden style={{ left: pct(1440) }} className="absolute inset-y-0 w-px bg-ink/50" />
      </div>
      <div aria-hidden className="relative mt-1 h-7 text-[10px] font-medium tnum text-faint">
        {Array.from({ length: 9 }, (_, i) => i * 240).map((m) => (
          <span key={m} style={{ left: pct(m) }} className={cn("absolute top-0", m === 0 ? "" : m === AXIS ? "-translate-x-full" : "-translate-x-1/2")}>
            {String(Math.floor((m % 1440) / 60)).padStart(2, "0")}{m >= 1440 && <span className="block text-[9px] text-extra">+1</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Create or edit a shift template. Saving an edit makes the next version; roster records keep working. */
export default function TemplateEditPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const id = q.get("id");
  const { templates, create, update } = useTemplates();
  const toast = useApp((s) => s.toast);
  const editing = templates.find((t) => t.id === id) ?? null;
  const [form, setForm] = useState<Form>(() => (editing ? formOf(editing) : blankForm(templates.filter((t) => !t.archived).map((t) => t.tone))));
  const [tried, setTried] = useState(false);
  const back = { to: "/shift-templates", label: "Shift templates" };

  const r = useMemo(() => resolve(form, templates.filter((t) => t.id !== editing?.id)), [form, templates, editing]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  // an empty name is only an error once the person has tried to save
  const err = (k: keyof typeof r.errors) => (k === "name" && !form.name.trim() && !tried ? "" : r.errors[k] ?? "");
  const dirty = editing ? JSON.stringify(formOf(editing)) !== JSON.stringify({ ...form, name: form.name.trim() }) : true;

  if (id && !editing) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={SearchX} title="That template is not here" action={<a className="btn btn-sm" href="#/shift-templates">Back to templates</a>} /></Panel></PageBody>
      </>
    );
  }

  const submit = () => {
    setTried(true);
    if (!r.draft) return;
    if (editing) {
      update(editing.id, r.draft);
      toast("success", `${r.draft.name} saved as Version ${editing.version + 1}. Existing assignments use it from now on.`);
    } else {
      const made = create(r.draft);
      toast("success", `${made.name} created as Template ${made.code}. It is ready to assign in the planner.`);
    }
    navigate(back.to);
  };

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={editing ? `Edit ${editing.name}` : "New template"}
        actions={
          <>
            <button className="btn" onClick={() => navigate(back.to)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!!editing && !dirty}>{editing ? "Save next version" : "Create shift"}</button>
          </>
        }
      />
      <PageBody>
        <form className="grid items-start gap-3 lg:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Panel title="The shift">
            <div className="space-y-3">
              <Field label="Shift name" required error={err("name")}>
                <Input value={form.name} maxLength={40} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Weekend support" suffix={`${form.name.length}/40`} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start" error={err("start")}><TimeInput value={form.start} onChange={(v) => set("start", v)} /></Field>
                <Field label="End" error={err("end")}><TimeInput value={form.end} onChange={(v) => set("end", v)} /></Field>
                <Field label="Unpaid break start" error={err("breakStart")}><TimeInput value={form.breakStart} onChange={(v) => set("breakStart", v)} /></Field>
                <Field label="Unpaid break end" error={err("breakEnd")}><TimeInput value={form.breakEnd} onChange={(v) => set("breakEnd", v)} /></Field>
                <Field label="Late flag after" error={err("lateAfter")}><NumberInput value={form.lateAfter} onChange={(v) => set("lateAfter", v)} unit="min" max={999} /></Field>
                <Field label="Early flag after" error={err("earlyAfter")}><NumberInput value={form.earlyAfter} onChange={(v) => set("earlyAfter", v)} unit="min" max={999} /></Field>
              </div>
            </div>
          </Panel>

          <div className="space-y-3">
            <Panel title="Preview">
              <section aria-label="Live preview">
                <PreviewBar r={r} tone={form.tone} />
                <p className="tnum text-h3 text-ink" aria-live="polite">
                  {r.net !== undefined ? <>{fmtMin(r.net)} <span className="font-medium text-muted">required</span></> : <span className="font-medium text-muted">Enter valid times</span>}
                </p>
              </section>
            </Panel>
            <Panel title="Colour">
              <div role="radiogroup" aria-label="Shift colour" className="flex gap-2.5">
                {TONES.map((t) => {
                  const on = form.tone === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={t.label}
                      title={t.label}
                      onClick={() => set("tone", t.value)}
                      className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-white transition-shadow", SHIFT_TONES[t.value].dot, on ? "border-surface ring-2 ring-ink" : "border-surface hover:ring-2 hover:ring-line-strong")}
                    >
                      {on && <Check className="h-4 w-4" strokeWidth={3} aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>
          <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
        </form>
      </PageBody>
    </>
  );
}
