import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CornerDownLeft, Search } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES } from "@/store/data";
import { useTasks } from "@/pages/tasks/store";
import { openPdfPreview } from "@/pages/pdf/open";

/* ------------------------------ fuzzy match ------------------------------ */
interface Hit { score: number; at: number[] }

/**
 * Letters of `q` must appear in `text` in order. Runs of consecutive letters, matches at the start of a word
 * and matches near the front score higher, so "tl" finds Timeline before "Attendance policies".
 */
export function fuzzy(q: string, text: string): Hit | null {
  const t = text.toLowerCase();
  const at: number[] = [];
  let score = 0, from = 0, run = 0;
  for (const ch of q.toLowerCase()) {
    if (ch === " ") continue;
    const i = t.indexOf(ch, from);
    if (i < 0) return null;
    const start = i === 0 || /[\s\-_/·.,]/.test(t[i - 1]);
    run = i === from && at.length > 0 ? run + 1 : 0;
    score += 1 + (start ? 6 : 0) + run * 4 + (i === 0 ? 4 : 0) - Math.min(i, 30) * 0.04;
    at.push(i);
    from = i + 1;
  }
  return { score: score - text.length * 0.02, at };
}

function Marked({ text, at }: { text: string; at: number[] }) {
  if (!at.length) return <>{text}</>;
  const on = new Set(at);
  const out: ReactNode[] = [];
  let buf = "", hit = false;
  const flush = () => { if (buf) out.push(hit ? <mark key={out.length} className="rounded-[2px] bg-transparent font-bold text-brand-ink underline decoration-brand/40 underline-offset-2">{buf}</mark> : buf); buf = ""; };
  [...text].forEach((c, i) => { const h = on.has(i); if (h !== hit) { flush(); hit = h; } buf += c; });
  flush();
  return <>{out}</>;
}

/* ------------------------------ items ------------------------------ */
interface Item { id: string; group: string; label: string; hint?: string; keys?: string[]; run: () => void }

/** "g" then a letter jumps to a screen, as long as nobody is typing. */
const GO: Record<string, string> = { t: "/timeline", n: "/shift-timeline", e: "/people-attendance", s: "/sessions", p: "/permissions", k: "/kanban", a: "/tasks", o: "/outings", i: "/individual", r: "/reports", f: "/pdf-preview", m: "/monthly", l: "/planner" };

export function CommandPalette() {
  const { commandOpen, setCommandOpen, setFilters, resetFilters, toggleTheme, backup, theme } = useApp();
  const permissions = useApp((s) => s.permissions);
  const tasks = useTasks((s) => s.tasks);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    let armed = 0;
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!useApp.getState().commandOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || useApp.getState().commandOpen) return;
      const k = e.key.toLowerCase();
      if (armed && Date.now() - armed < 1000 && GO[k]) { e.preventDefault(); window.location.hash = GO[k]; armed = 0; return; }
      armed = k === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  useEffect(() => { if (commandOpen) { setQ(""); setIdx(0); } }, [commandOpen]);

  const close = () => setCommandOpen(false);
  const go = (path: string) => { window.location.hash = path; close(); };

  const all = useMemo<Item[]>(() => {
    const goKey = (path: string) => Object.entries(GO).find(([, v]) => v === path)?.[0];
    return [
      ...ROUTES.filter((r) => !r.hidden).map((r) => ({ id: r.path, group: "Screens", label: r.label, hint: r.group.toLowerCase(), keys: goKey(r.path) ? ["G", goKey(r.path)!.toUpperCase()] : undefined, run: () => go(r.path) })),
      { id: "pdf-period", group: "Actions", label: "Preview period report as PDF", hint: "landscape A4", run: () => { openPdfPreview("period"); close(); } },
      { id: "pdf-daily", group: "Actions", label: "Preview daily report as PDF", hint: "landscape A4", run: () => { openPdfPreview("daily"); close(); } },
      { id: "pdf-month", group: "Actions", label: "Preview monthly report as PDF", hint: "landscape A4", run: () => { openPdfPreview("monthly"); close(); } },
      { id: "theme", group: "Actions", label: theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme", hint: "appearance", run: () => { toggleTheme(); close(); } },
      { id: "backup", group: "Actions", label: "Download a backup", hint: "JSON", run: () => { backup(); close(); } },
      { id: "reset", group: "Actions", label: "Reset all filters", hint: "this session", run: () => { resetFilters(); close(); } },
      ...EMPLOYEES.map((e) => ({ id: `emp-${e.id}`, group: "Employees", label: e.name, hint: `${e.role} · ${e.dept}`, run: () => { setFilters({ employee: e.id }); go("/individual"); } })),
      ...tasks.filter((t) => t.lifecycle === "live").map((t) => ({ id: `task-${t.id}`, group: "Tasks", label: `${t.code} · ${t.title}`, hint: t.destination, run: () => { setFilters({ search: t.code }); go("/tasks"); } })),
      ...permissions.map((p) => ({ id: `perm-${p.id}`, group: "Permissions", label: `${EMPLOYEES.find((e) => e.id === p.employeeId)?.name ?? ""} · ${p.reason}`, hint: p.status, run: () => go(`/permission-review?id=${p.id}`) })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, permissions, theme]);

  const shown = useMemo<(Item & { at: number[] })[]>(() => {
    const s = q.trim();
    if (!s) return all.filter((i) => i.group === "Screens" || i.group === "Actions").map((i) => ({ ...i, at: [] }));
    const hits: (Item & { at: number[]; score: number })[] = [];
    for (const it of all) {
      const label = fuzzy(s, it.label);
      const meta = label ? null : fuzzy(s, `${it.group} ${it.hint ?? ""}`);
      const hit = label ?? (meta ? { score: meta.score * 0.4, at: [] } : null);
      if (hit) hits.push({ ...it, at: label?.at ?? [], score: hit.score + (it.group === "Screens" ? 14 : it.group === "Actions" ? 9 : it.group === "Employees" ? 5 : 0) });
    }
    return hits.sort((a, b) => b.score - a.score).slice(0, 30);
  }, [q, all]);

  useEffect(() => { setIdx((i) => Math.min(i, Math.max(0, shown.length - 1))); }, [shown.length]);
  useEffect(() => { listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }); }, [idx, shown]);

  let lastGroup = "";
  return (
    <Dialog.Root open={commandOpen} onOpenChange={setCommandOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-shell/60 backdrop-blur-[3px]" />
        <Dialog.Content
          className="fixed left-1/2 top-[12vh] z-[71] w-[calc(100vw-2rem)] max-w-[600px] -translate-x-1/2 animate-in overflow-hidden rounded-modal border border-line bg-surface shadow-pop max-md:inset-x-0 max-md:top-0 max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:rounded-t-none"
          aria-describedby={undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, shown.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Home") { e.preventDefault(); setIdx(0); }
            if (e.key === "End") { e.preventDefault(); setIdx(shown.length - 1); }
            if (e.key === "Enter") { e.preventDefault(); shown[idx]?.run(); }
          }}
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="h-4 w-4 text-muted" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls="cmdk-list"
              aria-activedescendant={shown[idx] ? `cmdk-${shown[idx].id}` : undefined}
              value={q}
              onChange={(e) => { setQ(e.target.value); setIdx(0); }}
              placeholder="Search screens, people, tasks, actions"
              aria-label="Search"
              className="h-11 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
            />
            <kbd className="rounded border border-line bg-surface-2 px-1.5 text-[11px] font-semibold text-muted">Esc</kbd>
          </div>
          <ul id="cmdk-list" ref={listRef} role="listbox" aria-label="Results" className="max-h-[min(380px,55vh)] overflow-y-auto p-1.5">
            {shown.length === 0 && <li className="px-3 py-8 text-center text-body text-muted">No matches for “{q}”. Try fewer letters, or part of a name.</li>}
            {shown.map((it, i) => {
              const head = !q.trim() && it.group !== lastGroup;
              lastGroup = it.group;
              return (
                <li key={it.id} role="presentation">
                  {head && <div className="eyebrow px-3 pb-1 pt-2.5">{it.group}</div>}
                  <div
                    id={`cmdk-${it.id}`}
                    role="option"
                    aria-selected={i === idx}
                    onMouseMove={() => i !== idx && setIdx(i)}
                    onClick={it.run}
                    className={cn("flex min-h-[38px] cursor-pointer items-center gap-3 rounded-[9px] px-3 py-1.5 transition-colors duration-100", i === idx && "bg-brand-soft")}
                  >
                    {q.trim() && <span className="eyebrow w-[84px] shrink-0 max-sm:hidden">{it.group}</span>}
                    <span className={cn("min-w-0 flex-1 truncate text-body", i === idx ? "font-semibold text-ink" : "text-ink")}><Marked text={it.label} at={it.at} /></span>
                    {it.hint && <span className="hidden max-w-[40%] truncate text-small capitalize text-muted sm:inline">{it.hint}</span>}
                    {it.keys && (
                      <span className="hidden shrink-0 gap-1 md:flex" aria-label={`Shortcut: ${it.keys.join(" then ")}`}>
                        {it.keys.map((k, n) => <kbd key={n} className="min-w-[20px] rounded border border-line bg-surface-2 px-1 text-center text-[11px] font-semibold text-muted">{k}</kbd>)}
                      </span>
                    )}
                    {i === idx && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-ink" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-surface-2 px-4 py-2 text-small text-muted max-sm:hidden" aria-hidden>
            <span><kbd className="rounded border border-line bg-surface px-1 text-[11px] font-semibold">↑</kbd> <kbd className="rounded border border-line bg-surface px-1 text-[11px] font-semibold">↓</kbd> move</span>
            <span><kbd className="rounded border border-line bg-surface px-1 text-[11px] font-semibold">↵</kbd> open</span>
            <span><kbd className="rounded border border-line bg-surface px-1 text-[11px] font-semibold">Esc</kbd> close</span>
            <span className="ml-auto"><kbd className="rounded border border-line bg-surface px-1 text-[11px] font-semibold">G</kbd> then a letter goes straight to a screen</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
