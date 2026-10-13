import { Check, Lock, LogIn, LogOut, RotateCcw, StepForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { toMin } from "@/lib/engine";
import { Callout, Panel } from "@/components/kit/Blocks";
import { Select } from "@/components/kit/forms";
import { PRACTICE_STEPS } from "./data";
import { applyPunch } from "./model-core";
import type { SessionDay } from "./model";
import { useSessions } from "./store";

export function PracticeLab({ day }: { day: SessionDay }) {
  const toast = useApp((s) => s.toast);
  const { setPracticePolicy, restartPractice } = useSessions();
  const { punches, policy, policies, state, nextStep, person, date, commit } = day;

  const total = PRACTICE_STEPS.length;
  const complete = punches >= total;
  const blocked = !complete && state === "closed";
  const locked = punches > 0;

  const next = () => {
    if (!nextStep || blocked) return;
    commit(applyPunch(person.rec, person.key, date, { type: nextStep.type, at: toMin(nextStep.at), reason: nextStep.reason, note: nextStep.note }));
    toast("success", `${nextStep.at} ${nextStep.label} recorded.`);
  };

  return (
    <Panel
      id="practice-lab"
      title="Guided practice lab"
      actions={
        <>
          <Select aria-label="Practice policy" className="h-7 w-[210px] py-0 text-[12px]" value={policy.id} disabled={locked} onChange={(e) => setPracticePolicy(e.target.value)} options={policies.map((p) => ({ value: p.id, label: `${p.name} · ${p.allowed} ${p.allowed === 1 ? "session" : "sessions"}` }))} />
          <button className="btn btn-sm" onClick={() => { restartPractice(); toast("info", "Practice restarted. Pick a policy and begin again."); }} disabled={punches === 0}><RotateCcw aria-hidden />Restart</button>
          <button className="btn btn-sm btn-primary" onClick={next} disabled={complete || blocked}><StepForward aria-hidden />Next step</button>
        </>
      }
    >
      <ol className="grid gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(104px,1fr))]" aria-label="Practice steps">
        {PRACTICE_STEPS.map((s, i) => {
          const status = i < punches ? "done" : i === punches && !complete ? "next" : "upcoming";
          const Icon = s.type === "in" ? LogIn : LogOut;
          return (
            <li key={i} aria-current={status === "next" ? "step" : undefined} className="relative flex flex-col items-center px-1 text-center">
              {i < total - 1 && <span aria-hidden className={cn("absolute left-1/2 top-3.5 h-0.5 w-full", i + 1 < punches ? "bg-work" : i < punches ? "bg-brand/50" : "bg-line-strong")} />}
              <span
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 text-small font-bold tnum",
                  status === "done" && "border-work bg-work text-white",
                  status === "next" && (blocked ? "border-line-strong bg-surface-3 text-muted" : "border-brand bg-brand-soft text-brand-ink shadow-[0_0_0_3px_var(--brand-soft)]"),
                  status === "upcoming" && "border-line-strong bg-surface text-muted"
                )}
              >
                {status === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : blocked && status === "next" ? <Lock className="h-3 w-3" aria-hidden /> : i + 1}
              </span>
              <span className={cn("mt-1.5 tnum text-h3", status === "upcoming" ? "text-muted" : "text-ink")}>{s.at}</span>
              <span className={cn("mt-0.5 inline-flex items-start gap-1 text-left text-[11.5px]", status === "upcoming" ? "text-muted" : "text-ink-2")}>
                <Icon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden /><span>{s.label}</span>
              </span>
              <span className="sr-only">{status === "done" ? "Done" : status === "next" ? "Next step" : "Upcoming"}</span>
            </li>
          );
        })}
      </ol>
      {blocked && <Callout kind="lock" lead="The policy closed the day" className="mt-3" />}
      {complete && <Callout kind="success" lead="Practice complete" className="mt-3" />}
    </Panel>
  );
}
