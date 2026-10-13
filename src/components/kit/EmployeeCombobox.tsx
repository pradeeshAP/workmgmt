import { useId, useMemo, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPLOYEES, empCode } from "@/store/data";
import { Avatar } from "@/components/ui/primitives";
import { useOrg } from "@/pages/people/store";
import { initialsOf } from "./PersonCell";

/** Searchable employee picker with avatars. An empty value means everyone, when allLabel is given. */
export function EmployeeCombobox({
  value, onChange, allLabel, label = "Employee", className,
}: {
  value: string;
  onChange: (id: string) => void;
  allLabel?: string;
  label?: string;
  className?: string;
}) {
  const listId = useId();
  const rev = useOrg((s) => s.rev); // the list is rebuilt when people are added or renamed
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const options = useMemo(() => {
    const all = EMPLOYEES.map((e) => ({ id: e.id, name: e.name, sub: `${empCode(e.id)} · ${e.dept}`, role: e.role }));
    const s = q.trim().toLowerCase();
    const list = s ? all.filter((o) => [o.name, o.sub, o.role].some((t) => t.toLowerCase().includes(s))) : all;
    return allLabel && !s ? [{ id: "", name: allLabel, sub: `${EMPLOYEES.length} people`, role: "" }, ...list] : list;
  }, [q, allLabel, rev]);

  const current = EMPLOYEES.find((e) => e.id === value);
  const choose = (id: string) => { onChange(id); setQ(""); setOpen(false); };

  return (
    <div
      className={cn("relative w-[220px]", className)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setOpen(false); setQ(""); } }}
    >
      <span className="pointer-events-none absolute left-1.5 top-1/2 z-[1] -translate-y-1/2">
        {current ? <Avatar initials={initialsOf(current.name)} size={20} tone="brand" /> : <Users className="ml-1 h-4 w-4 text-muted" aria-hidden />}
      </span>
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && options[idx] ? `${listId}-${idx}` : undefined}
        autoComplete="off"
        className="input w-full pl-8 pr-7 font-semibold"
        placeholder={current?.name ?? allLabel ?? "Search people"}
        value={open ? q : current?.name ?? allLabel ?? ""}
        onFocus={(e) => { setOpen(true); e.currentTarget.select(); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setIdx((i) => Math.min(i + 1, options.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
          if (e.key === "Enter" && open && options[idx]) { e.preventDefault(); choose(options[idx].id); }
          if (e.key === "Escape") { setOpen(false); setQ(""); }
        }}
      />
      <ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute z-[75] mt-1 max-h-72 w-[300px] animate-menu overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-pop">
          {options.length === 0 && <li className="px-3 py-3 text-body text-muted">No one matches “{q}”.</li>}
          {options.map((o, i) => (
            <li
              key={o.id || "all"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(o.id)}
              onMouseEnter={() => setIdx(i)}
              className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5", i === idx && "bg-surface-3")}
            >
              {o.id ? <Avatar initials={initialsOf(o.name)} size={26} tone="brand" /> : <Users className="mx-1.5 h-4 w-4 text-muted" aria-hidden />}
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold text-ink">{o.name}</span>
                <span className="block truncate text-small text-muted">{o.role ? `${o.role} · ${o.sub}` : o.sub}</span>
              </span>
              {o.id === value && <Check className="h-3.5 w-3.5 shrink-0 text-brand-ink" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
