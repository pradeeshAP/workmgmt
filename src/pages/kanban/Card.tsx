import type { ComponentPropsWithoutRef, Ref } from "react";
import { useDraggable } from "@dnd-kit/core";
import { ArrowRightLeft, Clock, Eye, Gauge, GripVertical, Inbox, MapPin, MoreHorizontal, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill, TASK_STATUS, type Def } from "@/components/kit/Status";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/primitives";
import { PRIORITY_DEF, fmtStamp, isDoneOutcome, outcomeOf } from "@/pages/tasks/model";
import { cardDone, type KCard } from "./model";

const WAITING: Def = { label: "Unassigned", tone: "duty", icon: Inbox };

export interface CardActions {
  onOpen: (c: KCard) => void;
  onMove: (c: KCard) => void;
  onProgress: (c: KCard) => void;
  onUnassign: (c: KCard) => void;
}

/** The card as drawn. Dragging is wired in `DraggableCard`; the lifted copy under the pointer uses this directly. */
function CardFace({ card, assessAt, actions, lifted, ghost, landed, rootRef, rootProps, width }: {
  card: KCard;
  assessAt: string;
  actions: CardActions;
  /** the copy that follows the pointer */
  lifted?: boolean;
  /** the card left behind in its lane while it is carried */
  ghost?: boolean;
  landed?: boolean;
  rootRef?: Ref<HTMLElement>;
  rootProps?: ComponentPropsWithoutRef<"article">;
  width?: number;
}) {
  const { task: t, a } = card;
  const done = cardDone(card);
  const status = a ? outcomeOf(a, t, assessAt) : null;
  const pct = a ? (isDoneOutcome(a.outcome) ? 100 : a.progress) : 0;
  const late = !done && t.due < assessAt;
  const bar = done ? "bg-work" : status === "blocked" || status === "overdue" ? "bg-gap" : "bg-brand";

  return (
    <article
      ref={rootRef}
      {...rootProps}
      aria-label={`${t.code} ${t.title}`}
      style={width ? { width } : undefined}
      className={cn(
        "group relative rounded-input border border-line bg-surface p-2.5 transition-[transform,box-shadow,border-color] duration-150 ease-out",
        !lifted && !ghost && "cursor-grab hover:-translate-y-px hover:border-line-strong hover:shadow-pop",
        lifted && "cursor-grabbing rotate-1 scale-[1.03] border-brand shadow-[0_20px_44px_rgba(8,14,32,.30)]",
        ghost && "border-dashed bg-surface-2 opacity-45",
        landed && "card-landed"
      )}
    >
      <div className="flex items-center gap-1.5">
        <GripVertical aria-hidden className="-ml-1 h-3.5 w-3.5 shrink-0 text-faint transition-colors group-hover:text-muted" />
        <span className="eyebrow tnum whitespace-nowrap !tracking-[0.6px]">{t.code}</span>
        <Pill def={{ ...PRIORITY_DEF[t.priority], label: PRIORITY_DEF[t.priority].label.replace(" priority", "") }} className="ml-auto" />
        <Menu>
          <MenuTrigger asChild>
            <button className="btn-icon -mr-1 h-6 w-6" aria-label={`More actions for ${t.code}`}><MoreHorizontal className="h-4 w-4" aria-hidden /></button>
          </MenuTrigger>
          <MenuContent className="min-w-[200px]">
            <MenuItem icon={Eye} onSelect={() => actions.onOpen(card)}>Open task</MenuItem>
            <MenuItem icon={ArrowRightLeft} onSelect={() => actions.onMove(card)}>{a ? "Move to…" : "Assign to…"}</MenuItem>
            {a && <MenuItem icon={Gauge} onSelect={() => actions.onProgress(card)}>Update progress</MenuItem>}
            {a && !done && (<><MenuSeparator /><MenuItem icon={Undo2} onSelect={() => actions.onUnassign(card)}>Return to Unassigned</MenuItem></>)}
          </MenuContent>
        </Menu>
      </div>

      <h3 className="mt-1 line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink">
        <button className="rounded text-left hover:text-brand-ink hover:underline" onClick={() => actions.onOpen(card)}>{t.title}</button>
      </h3>
      <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted"><MapPin aria-hidden className="h-3 w-3 shrink-0" /><span className="truncate">{t.destination}</span></p>

      <div className="mt-2 flex items-center gap-2">
        <Pill def={status ? TASK_STATUS[status] : WAITING} />
        <span className="tnum ml-auto text-[11.5px] font-semibold text-ink-2">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3" role="img" aria-label={`${pct}% complete`}>
        <span className={cn("block h-full rounded-full transition-[width] duration-300", bar)} style={{ width: `${pct}%` }} />
      </div>

      <p className={cn("tnum mt-1.5 flex items-center gap-1.5 text-[11.5px]", late ? "font-semibold text-gap-ink" : "text-muted")}>
        <Clock aria-hidden className="h-3 w-3 shrink-0" />Due {fmtStamp(t.due)}
      </p>
    </article>
  );
}

/** A card the pointer can pick up. Whole-card dragging; buttons inside still click because dragging needs a few pixels of movement. */
export function DraggableCard({ card, assessAt, actions, landed }: { card: KCard; assessAt: string; actions: CardActions; landed: boolean }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: card.key, data: { card } });
  return <CardFace card={card} assessAt={assessAt} actions={actions} ghost={isDragging} landed={landed && !isDragging} rootRef={setNodeRef as Ref<HTMLElement>} rootProps={listeners as ComponentPropsWithoutRef<"article">} />;
}

/** The lifted copy that follows the pointer. */
export function LiftedCard({ card, assessAt, actions, width }: { card: KCard; assessAt: string; actions: CardActions; width?: number }) {
  return <CardFace card={card} assessAt={assessAt} actions={actions} lifted width={width} />;
}
