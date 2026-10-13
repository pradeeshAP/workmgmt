import { create } from "zustand";
import type { ReactNode } from "react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { PERMISSIONS, PERIOD, TODAY, type PermissionRequest } from "./data";
import { safeGet, safeSet } from "@/lib/utils";
import type { AttRecord } from "@/lib/engine";

export type SaveState = "saved" | "unsaved" | "session";
export type ToastKind = "success" | "info" | "warning" | "error";
export interface ToastAction { label: string; onClick: () => void }
export interface Toast { id: number; kind: ToastKind; message: string; action?: ToastAction; /** ms it stays */ duration: number }
export interface ToastOptions { action?: ToastAction; /** ms before it dismisses itself; default 6000 */ duration?: number }

export interface Filters {
  company: string;
  employee: string; // "" = all
  date: string;
  from: string;
  to: string;
  week: string; // ISO date of week start
  month: string; // yyyy-MM
  department: string;
  shift: string;
  search: string;
}

export type ModalSpec =
  | {
      type: "confirm";
      title: string;
      body: string;
      confirmLabel: string;
      destructive?: boolean;
      requireReason?: boolean;
      onConfirm: (reason: string) => void;
    }
  | { type: "custom"; title: string; description?: string; render: () => ReactNode };

export const DEFAULT_FILTERS: Filters = {
  company: "ascending",
  employee: "",
  date: TODAY,
  from: PERIOD.from,
  to: PERIOD.to,
  week: "2026-10-05",
  month: TODAY.slice(0, 7),
  department: "",
  shift: "",
  search: "",
};

const LS = { prefs: "ascending.prefs", data: "ascending.data", theme: "ascending.theme" };

interface Prefs { collapsed: boolean; theme: "light" | "dark"; sandbox: boolean }

function loadPrefs(): Prefs {
  const base: Prefs = { collapsed: false, theme: "light", sandbox: false };
  try {
    const raw = safeGet(LS.prefs);
    return raw ? { ...base, ...JSON.parse(raw) } : base;
  } catch {
    return base;
  }
}
interface Data { permissions: PermissionRequest[]; attendance: Record<string, AttRecord>; assignments: Record<string, string> }
function loadData(): Data {
  const base: Data = { permissions: PERMISSIONS, attendance: {}, assignments: {} };
  try {
    const raw = safeGet(LS.data);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Data>;
      const stored = saved.permissions ?? [];
      // sample requests added after this browser saved its data still appear, and saved edits win
      const seeds = PERMISSIONS.map((s) => ({ ...s, ...stored.find((p) => p.id === s.id) }));
      const extra = stored.filter((p) => !PERMISSIONS.some((s) => s.id === p.id));
      return { ...base, ...saved, permissions: [...seeds, ...extra] };
    }
  } catch {
    /* fall through to sample data */
  }
  return base;
}

const prefs = loadPrefs();
let toastId = 0;

interface AppState extends Prefs {
  permissions: PermissionRequest[];
  /** edited records only; untouched days come from the seed generator */
  attendance: Record<string, AttRecord>;
  /** "empId|date" -> shiftId, or "" for explicitly unassigned */
  assignments: Record<string, string>;
  saveState: SaveState;
  filters: Filters;
  toasts: Toast[];
  modal: ModalSpec | null;
  commandOpen: boolean;

  toggleSidebar: () => void;
  toggleTheme: () => void;
  setSandbox: (on: boolean) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  setPermissions: (p: PermissionRequest[]) => void;
  saveAttendance: (key: string, rec: AttRecord) => void;
  assignShift: (key: string, shiftId: string) => void;
  /** many "empId|date" -> shiftId entries in one save */
  assignShifts: (entries: Record<string, string>) => void;
  persist: () => void;
  markUnsaved: () => void;
  toast: (kind: ToastKind, message: string, opts?: ToastOptions) => void;
  dismissToast: (id: number) => void;
  openModal: (m: ModalSpec) => void;
  closeModal: () => void;
  setCommandOpen: (o: boolean) => void;
  backup: () => void;
  /** replaces the saved records with those from a backup that `readBackup` accepted */
  restoreData: (data: BackupData) => void;
}

export interface BackupData {
  savedAt?: string;
  permissions: PermissionRequest[];
  attendance: Record<string, AttRecord>;
  assignments: Record<string, string>;
}

/** Reads a backup file and checks it is one of ours. Throws when it is not. */
export async function readBackup(file: File): Promise<BackupData> {
  const data = JSON.parse(await file.text());
  if (data?.app !== "ascending-attendance-studio" || !Array.isArray(data.permissions)) throw new Error("shape");
  return { savedAt: typeof data.savedAt === "string" ? data.savedAt : undefined, permissions: data.permissions, attendance: data.attendance ?? {}, assignments: data.assignments ?? {} };
}

function applyTheme(t: "light" | "dark") {
  if (t === "dark") document.documentElement.setAttribute("data-theme", "dark");
  else document.documentElement.removeAttribute("data-theme");
  safeSet(LS.theme, t);
}
applyTheme(prefs.theme);

export const useApp = create<AppState>((set, get) => {
  const savePrefs = () => {
    const { collapsed, theme, sandbox } = get();
    return safeSet(LS.prefs, JSON.stringify({ collapsed, theme, sandbox }));
  };
  const canStore = safeSet("ascending.probe", "1");

  return {
    ...prefs,
    ...loadData(),
    saveState: canStore ? "saved" : "session",
    filters: DEFAULT_FILTERS,
    toasts: [],
    modal: null,
    commandOpen: false,

    toggleSidebar: () => {
      set((s) => ({ collapsed: !s.collapsed }));
      savePrefs();
    },
    toggleTheme: () => {
      const theme = get().theme === "dark" ? "light" : "dark";
      set({ theme });
      applyTheme(theme);
      savePrefs();
    },
    setSandbox: (on) => {
      set({ sandbox: on });
      savePrefs();
      get().toast(
        "info",
        on ? "Sample sandbox is on. Your records are unchanged." : "Sample sandbox is off. Showing your records."
      );
    },
    setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
    resetFilters: () => set({ filters: DEFAULT_FILTERS }),
    setPermissions: (permissions) => {
      set({ permissions });
      get().persist();
    },
    saveAttendance: (key, rec) => {
      set((s) => ({ attendance: { ...s.attendance, [key]: rec } }));
      get().persist();
    },
    assignShift: (key, shiftId) => {
      set((s) => ({ assignments: { ...s.assignments, [key]: shiftId } }));
      get().persist();
    },
    assignShifts: (entries) => {
      set((s) => ({ assignments: { ...s.assignments, ...entries } }));
      get().persist();
    },
    markUnsaved: () => {
      if (get().saveState !== "session") set({ saveState: "unsaved" });
    },
    persist: () => {
      const { permissions, attendance, assignments } = get();
      const ok = safeSet(LS.data, JSON.stringify({ permissions, attendance, assignments }));
      set({ saveState: ok ? "saved" : "session" });
      if (!ok) get().toast("warning", "This browser blocked storage. Changes last for this session only.");
    },
    toast: (kind, message, opts) => {
      const id = ++toastId;
      const duration = opts?.duration ?? 6000;
      set((s) => ({ toasts: [...s.toasts, { id, kind, message, action: opts?.action, duration }].slice(-4) }));
      window.setTimeout(() => get().dismissToast(id), duration);
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    openModal: (modal) => set({ modal }),
    closeModal: () => set({ modal: null }),
    setCommandOpen: (commandOpen) => set({ commandOpen }),

    backup: () => {
      const payload = { app: "ascending-attendance-studio", version: 1, savedAt: new Date().toISOString(), permissions: get().permissions, attendance: get().attendance, assignments: get().assignments };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meridian-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      get().toast("success", "Backup downloaded.");
    },
    restoreData: (data) => {
      set({ permissions: data.permissions, attendance: data.attendance, assignments: data.assignments });
      get().persist();
      get().toast("success", "Backup restored.");
    },
  };
});

/** Days in the selected range, inclusive; null if unparsable. */
export function rangeDays(f: Pick<Filters, "from" | "to">): number | null {
  try {
    return differenceInCalendarDays(parseISO(f.to), parseISO(f.from)) + 1;
  } catch {
    return null;
  }
}
