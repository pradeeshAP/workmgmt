import { useEffect, useId, useMemo, useState } from "react";
import { Check, Inbox, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPLOYEES, empCode } from "@/store/data";
import { Modal } from "@/components/kit/Modal";
import { Callout } from "@/components/kit/Blocks";
import { Avatar } from "@/components/ui/primitives";
import { initialsOf } from "@/components/kit/PersonCell";
import { useOutings } from "@/pages/outings/store";
import { QUEUE, frozen, type KCard, type KLane } from "./model";

/* ------------------------------ Move to… ------------------------------ */
interface Option { id: string; name: string; sub: string; open: number; out: string | null; note: string | null; disabled: boolean }

/** The keyboard route to a new owner: a searchable list of lanes. Arrow keys move, Enter picks. */
export function MovePicker({ card, lanes, onPick, onClose }: { card: KCard | null; lanes: KLane[]; onPick: (c: KCard, toId: string) => void; onClose: () => void }) {
  const outings = useOutings((s) => s.outings);
  const listId = useId();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  useEffect(() => { if (card) { setQ(""); setIdx(0); } }, [card]);

  const [last, setLast] = useState(card);
  useEffect(() => { if (card) setLast(card); }, [card]);
  const c = card ?? last;

  const stuck = c ? frozen(c, outings) : null;

  const options = useMemo<Option[]>(() => {
    if (!c) return [];
    const mine = c.empId ?? QUEUE;
    const all: Option[] = [
      { id: QUEUE, name: "Unassigned", sub: "Back to the queue", open: lanes.find((l) => l.id === QUEUE)?.cards.length ?? 0, out: null, note: null, disabled: false },
      ...EMPLOYEES.map((e) => {
        const lane = lanes.find((l) => l.id === e.id);
        return { id: e.id, name: e.name, sub: `${empCode(e.id)} · ${e.dept} · ${e.role}`, open: lane?.cards.length ?? 0, out: lane?.away?.id ?? null, note: null, disabled: false };
      }),
    ].map((o) => {
      if (o.id === mine) return { ...o, note: "Current", disabled: true };
      return o.id !== QUEUE && c.task.assignees.some((x) => x.empId === o.id) ? { ...o, note: "Already on this task", disabled: true } : o;
    });
    const s = q.trim().toLowerCase();
    // an unassigned card has no "back to the queue" option
    return all.filter((o) => (c.empId || o.id !== QUEUE) && (!s || [o.name, o.sub].some((x) => x.toLowerCase().includes(s))));
  }, [c, lanes, q, outings]);

  // a stuck task still lets you pick: the board answers with the same error toast a blocked drag gets
  const choose = (o: Option | undefined) => { if (o && !o.disabled && c) onPick(c, o.id); };
  const verb = c?.empId ? "Move" : "Assign";

  return (
    <Modal
      open={!!card}
      onOpenChange={(o) => !o && onClose()}
      size="md"
      title={c ? `${verb} ${c.task.code}` : "Move task"}
      secondary={<button className="btn" onClick={onClose}>Cancel</button>}
    >
      <div className="space-y-3">
        {stuck && <Callout kind="warning" lead="This task can’t move yet.">{stuck}</Callout>}
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-faint" />
          <input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-label="Find a person"
            aria-activedescendant={options[idx] ? `${listId}-${idx}` : undefined}
            autoComplete="off"
            className="input w-full pl-8"
            placeholder="Find a person"
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, options.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); choose(options[idx]); }
            }}
          />
        </div>
        <ul id={listId} role="listbox" aria-label="Who should own this task" className="max-h-[340px] space-y-0.5 overflow-y-auto rounded-input border border-line p-1">
          {options.length === 0 && <li className="px-3 py-6 text-center text-body text-muted">No one matches “{q}”.</li>}
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === idx}
              aria-disabled={o.disabled}
              onMouseEnter={() => setIdx(i)}
              onClick={() => choose(o)}
              className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5", i === idx && "bg-surface-3", o.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer")}
            >
              {o.id === QUEUE ? (
                <Inbox aria-hidden className="mx-1.5 h-5 w-5 shrink-0 text-duty" />
              ) : (
                <Avatar initials={initialsOf(o.name)} size={28} tone="brand" />
              )}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-body font-semibold text-ink">{o.name}</span>
                <span className="block truncate text-small text-muted">{o.sub}</span>
              </span>
              {o.out && <span className="chip chip-permission"><LogOut aria-hidden />Out</span>}
              <span className="tnum shrink-0 text-small text-muted">{o.open} {o.open === 1 ? "task" : "tasks"}</span>
              {o.note && <span className="shrink-0 text-small font-semibold text-brand-ink">{o.note === "Current" ? <Check aria-label="Current owner" className="h-4 w-4" /> : o.note}</span>}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
