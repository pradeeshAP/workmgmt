import { useRef, useState } from "react";
import { Lock, Repeat, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, EmptyState, Panel } from "@/components/kit/Blocks";
import { Switch } from "@/components/kit/Switch";
import { Field, Input, Textarea } from "@/components/kit/forms";
import { rememberedReviewer } from "@/pages/permissions/model";
import { MAX_SESSIONS, sessionsLabel, usePolicies, type Policy, type PolicyDraft, type PolicyVersion } from "./store";

const NAME_MAX = 60;
const DESC_MAX = 240;

const blank = (): PolicyDraft => ({ name: "", sessions: 3, requireReason: true, creditDuty: true, description: "" });
export const draftOf = (p: Policy | PolicyVersion): PolicyDraft => ({ name: p.name, sessions: p.sessions, requireReason: p.requireReason, creditDuty: p.creditDuty, description: p.description });

/** Plain-language list of what differs between two versions. */
export function changes(prev: PolicyDraft | null, cur: PolicyDraft): string[] {
  if (!prev) return [];
  const out: string[] = [];
  if (prev.name !== cur.name) out.push(`Renamed to “${cur.name}”`);
  if (prev.sessions !== cur.sessions) out.push(`Sessions ${prev.sessions} → ${cur.sessions}`);
  if (prev.requireReason !== cur.requireReason) out.push(`Check-out reason ${cur.requireReason ? "now required" : "now optional"}`);
  if (prev.creditDuty !== cur.creditDuty) out.push(`Business duty ${cur.creditDuty ? "now credited" : "now visible only"}`);
  if (prev.description !== cur.description) out.push("Description updated");
  return out;
}

function SessionStepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.KeyboardEvent, n: number) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = Math.min(MAX_SESSIONS, Math.max(1, n + d));
    onChange(next);
    ref.current?.querySelectorAll<HTMLElement>("[role=radio]")[next - 1]?.focus();
  };
  const Icon = value === 1 ? Lock : Repeat;
  return (
    <div>
      <div ref={ref} role="radiogroup" aria-label="Sessions per shift" className="grid grid-cols-8 gap-1.5">
        {Array.from({ length: MAX_SESSIONS }, (_, i) => i + 1).map((n) => {
          const on = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} ${n === 1 ? "session" : "sessions"}`}
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(n)}
              onKeyDown={(e) => move(e, n)}
              className={cn(
                "tnum flex h-10 flex-col items-center justify-end rounded-input border pb-0.5 text-small font-bold transition-colors duration-150",
                on ? "border-brand bg-brand text-white [[data-theme=dark]_&]:text-[#080d1c]" : n < value ? "border-brand/50 bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-muted hover:bg-surface-2"
              )}
            >
              <span aria-hidden className={cn("mb-auto mt-1 w-3 rounded-full", on ? "bg-current opacity-80" : n < value ? "bg-brand/60" : "bg-line-strong")} style={{ height: 2 + n * 2 }} />
              {n}
            </button>
          );
        })}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-body font-semibold text-ink" aria-live="polite">
        <Icon className="h-4 w-4 text-muted" aria-hidden />
        {sessionsLabel(value)}
      </p>
    </div>
  );
}

/** Create or edit a policy. Saving an edit makes the next version, and the old ones stay in its history. */
export default function PolicyEditPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const id = q.get("id");
  const { policies, create, update } = usePolicies();
  const toast = useApp((s) => s.toast);
  const editing = policies.find((p) => p.id === id) ?? null;
  const [form, setForm] = useState<PolicyDraft>(() => (editing ? draftOf(editing) : blank()));
  const [tried, setTried] = useState(false);
  const back = { to: "/policies", label: "Attendance policies" };

  const set = <K extends keyof PolicyDraft>(k: K, v: PolicyDraft[K]) => setForm({ ...form, [k]: v });
  const norm = (f: PolicyDraft): PolicyDraft => ({ ...f, name: f.name.trim(), description: f.description.trim() });
  const dirty = editing ? JSON.stringify(draftOf(editing)) !== JSON.stringify(norm(form)) : true;
  const taken = policies.some((p) => p.id !== id && p.name.trim().toLowerCase() === form.name.trim().toLowerCase() && !!form.name.trim());
  const nameError = taken ? `A policy named “${form.name.trim()}” already exists.` : tried && !form.name.trim() ? "Give the policy a name." : "";

  if (id && !editing) {
    return (
      <>
        <PageHead route={route} back={back} />
        <PageBody><Panel flush><EmptyState icon={SearchX} title="That policy is not here" action={<a className="btn btn-sm" href="#/policies">Back to policies</a>} /></Panel></PageBody>
      </>
    );
  }

  const submit = () => {
    setTried(true);
    const d = norm(form);
    if (!d.name || taken) return;
    const by = rememberedReviewer() || "HR administrator";
    if (editing) {
      const note = changes(draftOf(editing), d).join(". ");
      update(editing.id, d, by, note ? `${note}.` : "Saved without changes to the rules.");
      toast("success", `${d.name} saved as version ${editing.version + 1}. New check-ins use it from now on.`);
    } else {
      const made = create(d, by);
      toast("success", `${made.name} created as ${made.code}. Assign it to people on Policy assignments.`);
    }
    navigate(back.to);
  };

  return (
    <>
      <PageHead
        route={route}
        back={back}
        title={editing ? `Edit ${editing.name}` : "New policy"}
        actions={
          <>
            <button className="btn" onClick={() => navigate(back.to)}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!!editing && !dirty}>{editing ? "Save next version" : "Create policy"}</button>
          </>
        }
      />
      <PageBody>
        <form className="grid items-start gap-3 lg:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <Panel title="The policy">
            <div className="space-y-3">
              <Field label="Policy name" required error={nameError}>
                <Input value={form.name} maxLength={NAME_MAX} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Site engineers" suffix={`${form.name.length}/${NAME_MAX}`} />
              </Field>
              <div>
                <div className="mb-1 flex items-baseline justify-between"><span className="text-[12px] font-semibold text-ink-2" id="sessions-label">Sessions per shift</span><span className="text-[11px] text-faint">1 to {MAX_SESSIONS}</span></div>
                <SessionStepper value={form.sessions} onChange={(n) => set("sessions", n)} />
              </div>
              <Field label="Description" optional>
                <Textarea value={form.description} maxLength={DESC_MAX} rows={3} onChange={(e) => set("description", e.target.value)} placeholder="Who this policy is for" />
              </Field>
            </div>
          </Panel>
          <div className="space-y-3">
            <Panel title="Rules">
              <div className="space-y-2.5">
                <Switch checked={form.requireReason} onChange={(v) => set("requireReason", v)} title="Require a reason for each check-out" />
                <Switch checked={form.creditDuty} onChange={(v) => set("creditDuty", v)} title="Credit approved business duty within the shift" />
              </div>
            </Panel>
            {editing && <Callout kind="lock" lead={`Saving creates version ${editing.version + 1}`} />}
          </div>
          <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
        </form>
      </PageBody>
    </>
  );
}
