import { create } from "zustand";
import { eachDayOfInterval, format, parseISO } from "date-fns";
import { SHIFTS, type Shift } from "./data";
import { safeGet, safeSet } from "@/lib/utils";
import { shiftIdFor } from "@/pages/timeline/model";

const LS = "ascending.templates";
const SEEDS: Shift[] = SHIFTS.map((s) => ({ ...s }));

function load(): Shift[] {
  try {
    const raw = safeGet(LS);
    if (!raw) return SEEDS;
    const saved = JSON.parse(raw) as Shift[];
    if (!Array.isArray(saved) || saved.length === 0) return SEEDS;
    // seeded templates stay present even if a browser saved an older list
    const seeds = SEEDS.map((s) => saved.find((x) => x.id === s.id) ?? s);
    return [...seeds, ...saved.filter((x) => !SEEDS.some((s) => s.id === x.id))];
  } catch {
    return SEEDS;
  }
}

/** Screens read SHIFTS directly, so the shared array always mirrors the store. */
const sync = (list: Shift[]) => SHIFTS.splice(0, SHIFTS.length, ...list);

export type TemplateDraft = Omit<Shift, "id" | "code" | "version" | "archived">;

interface TemplateState {
  templates: Shift[];
  create: (d: TemplateDraft) => Shift;
  /** saves the next version of a template */
  update: (id: string, d: TemplateDraft) => void;
  setArchived: (id: string, archived: boolean) => void;
}

export const useTemplates = create<TemplateState>((set, get) => {
  const initial = load();
  sync(initial);
  const commit = (templates: Shift[]) => {
    sync(templates);
    set({ templates });
    safeSet(LS, JSON.stringify(templates));
  };
  return {
    templates: initial,
    create: (d) => {
      const list = get().templates;
      const n = list.reduce((m, s) => Math.max(m, Number(s.code.slice(1)) || 0), 0) + 1;
      const made: Shift = { ...d, id: `tpl-${Date.now().toString(36)}`, code: `S${n}`, version: 1 };
      commit([...list, made]);
      return made;
    },
    update: (id, d) => commit(get().templates.map((s) => (s.id === id ? { ...s, ...d, version: s.version + 1 } : s))),
    setArchived: (id, archived) => commit(get().templates.map((s) => (s.id === id ? { ...s, archived } : s))),
  };
});

export const activeTemplates = (list: Shift[]) => list.filter((s) => !s.archived);

/** Employee-days in October 2026 whose roster uses this template (explicit assignments and defaults). */
export function rosterRecords(shiftId: string, empIds: string[], assignments: Record<string, string>): number {
  const days = eachDayOfInterval({ start: parseISO("2026-10-01"), end: parseISO("2026-10-31") }).map((d) => format(d, "yyyy-MM-dd"));
  let n = 0;
  for (const e of empIds) for (const d of days) if (shiftIdFor(e, d, assignments) === shiftId) n++;
  return n;
}
