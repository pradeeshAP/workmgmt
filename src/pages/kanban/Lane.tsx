import { useDroppable } from "@dnd-kit/core";
import { Ban, CheckCheck, Inbox, LogOut, MoveDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonCell } from "@/components/kit/PersonCell";
import { DraggableCard, type CardActions } from "./Card";
import { QUEUE, type KCard, type KLane, type Verdict } from "./model";

/** What the lane under the pointer says about the card being carried. */
export type Hint = { kind: "assign" | "unassign" } | { kind: "blocked"; reason: string };

export function hintFor(laneId: string, verdict: Verdict): Hint {
  if (!verdict.ok) return { kind: "blocked", reason: verdict.reason };
  return { kind: laneId === QUEUE ? "unassign" : "assign" };
}

function DropHint({ hint }: { hint: Hint }) {
  const blocked = hint.kind === "blocked";
  return (
    // zero-height wrapper: the hint floats over the top of the lane without pushing cards around
    <div aria-hidden className="pointer-events-none relative z-20 h-0">
      <div
        className={cn(
          "mx-2 mt-1 flex items-start gap-2 rounded-input border-2 border-dashed px-2.5 py-2 text-body font-semibold shadow-pop",
          blocked ? "border-gap bg-gap-soft text-ink" : hint.kind === "unassign" ? "border-duty bg-duty-soft text-ink" : "border-brand bg-brand-soft text-ink"
        )}
      >
        {blocked ? <Ban className="mt-0.5 h-4 w-4 shrink-0 text-gap" /> : hint.kind === "unassign" ? <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-duty" /> : <MoveDown className="mt-0.5 h-4 w-4 shrink-0 text-brand" />}
        <span className="min-w-0">
          {blocked ? "Can’t move here" : hint.kind === "unassign" ? "Drop to unassign" : "Drop to assign"}
          {blocked && <span className="mt-0.5 block text-small font-normal text-ink-2">{hint.reason}</span>}
        </span>
      </div>
    </div>
  );
}

export function Lane({ lane, assessAt, actions, landedKey, hint, carrying }: {
  lane: KLane;
  assessAt: string;
  actions: CardActions;
  landedKey: string | null;
  /** set while a card is carried and this is not the lane it came from */
  hint: Hint | null;
  carrying: boolean;
}) {
  const queue = lane.id === QUEUE;
  const { setNodeRef, isOver } = useDroppable({ id: lane.id });
  const over = isOver && !!hint;
  const open = lane.cards.filter((c: KCard) => !c.a || !["on-time", "late-done"].includes(c.a.outcome)).length;
  const title = queue ? "Unassigned" : lane.emp!.name;

  return (
    <section
      id={`lane-${lane.id}`}
      ref={setNodeRef}
      aria-label={`${title}, ${lane.cards.length} ${lane.cards.length === 1 ? "task" : "tasks"}`}
      className={cn(
        "relative flex min-w-0 flex-col rounded-card border bg-surface-2 transition-[box-shadow,background-color,border-color] duration-150",
        queue ? "border-duty/50 border-t-[3px] border-t-duty" : "border-line",
        over && (hint!.kind === "blocked" ? "border-gap bg-gap-soft/40 ring-2 ring-gap/60 shadow-[0_0_28px_color-mix(in_srgb,var(--gap)_35%,transparent)]" : queue || hint!.kind === "unassign" ? "border-duty bg-duty-soft/50 ring-2 ring-duty/60 shadow-[0_0_28px_color-mix(in_srgb,var(--duty)_38%,transparent)]" : "border-brand bg-brand-soft/60 ring-2 ring-brand/60 shadow-[0_0_28px_color-mix(in_srgb,var(--brand)_38%,transparent)]"),
        carrying && !over && "border-dashed"
      )}
    >
      <header className={cn("flex items-center gap-2 rounded-t-card border-b px-2.5 py-2", queue ? "border-duty/40 bg-duty-soft" : "border-line bg-surface")}>
        {queue && <Inbox aria-hidden className="h-4 w-4 shrink-0 text-duty" />}
        <div className="min-w-0 flex-1">
          {queue ? <h2 className="truncate text-h3 text-ink">Unassigned</h2> : <PersonCell name={lane.emp!.name} id={lane.emp!.id} sub={lane.emp!.role} />}
        </div>
        {lane.away && (
          <span title={`Out on ${lane.away.id}`} className="chip chip-permission"><LogOut aria-hidden />Out</span>
        )}
        <span className="tnum chip" title={`${open} open of ${lane.cards.length}`}>{lane.cards.length}</span>
      </header>

      {over && <DropHint hint={hint!} />}

      <ul className="flex flex-1 flex-col gap-2 p-2">
        {lane.cards.map((c) => (
          <li key={c.key}><DraggableCard card={c} assessAt={assessAt} actions={actions} landed={landedKey === c.key} /></li>
        ))}
        {lane.cards.length === 0 && (
          <li className="flex flex-1 flex-col items-center justify-center gap-1 rounded-input border border-dashed border-line-strong px-3 py-6 text-center">
            {queue ? <CheckCheck aria-hidden className="h-4 w-4 text-work" /> : <Inbox aria-hidden className="h-4 w-4 text-faint" />}
            <p className="text-small font-semibold text-ink-2">{queue ? "The queue is clear" : "Nothing assigned"}</p>
          </li>
        )}
      </ul>
    </section>
  );
}
