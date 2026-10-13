import { create } from "zustand";
import { BUILT_IN_POLICIES, type SessionPolicy } from "@/pages/sessions/data";
import { safeGet, safeSet } from "@/lib/utils";

const LS = "ascending.policies";
export const MAX_SESSIONS = 8;

/** What one saved version of a policy said. */
export interface PolicyVersion {
  version: number;
  /** ISO timestamp */
  at: string;
  by: string;
  name: string;
  sessions: number;
  requireReason: boolean;
  creditDuty: boolean;
  description: string;
  note: string;
}

export interface Policy {
  id: string;
  /** shown as POL-FIELD */
  code: string;
  name: string;
  sessions: number;
  requireReason: boolean;
  creditDuty: boolean;
  description: string;
  version: number;
  /** oldest first; the last entry is the current version */
  history: PolicyVersion[];
}

export type PolicyDraft = Pick<Policy, "name" | "sessions" | "requireReason" | "creditDuty" | "description">;

/** Where a person's policy came from: which policy, which version, and from when. */
export interface AssignmentRecord { policyId: string; version: number; effective: string }

const SEED_INFO: Record<string, { code: string; creditDuty: boolean; description: string }> = {
  standard: { code: "POL-OFFICE", creditDuty: true, description: "For office teams. Breaks and short errands are recorded as separate sessions, each check-out says why." },
  field: { code: "POL-FIELD", creditDuty: true, description: "For people who move between the office and client sites. Business outings are credited once HR approves them." },
  split: { code: "POL-SPLIT", creditDuty: false, description: "Two blocks of work with a long gap between them. Time in the gap is shown but earns no duty credit." },
  single: { code: "POL-SINGLE", creditDuty: false, description: "One check-in and one check-out. Leaving the site closes the day and a return is blocked." },
};

const seedVersion = (p: SessionPolicy, v: number, at: string, by: string, note: string, over: Partial<PolicyVersion> = {}): PolicyVersion => ({
  version: v, at, by, name: p.name, sessions: p.allowed, requireReason: p.exitReason === "Required", creditDuty: SEED_INFO[p.id].creditDuty, description: SEED_INFO[p.id].description, note, ...over,
});

const seedPolicies = (): Policy[] =>
  BUILT_IN_POLICIES.filter((p) => SEED_INFO[p.id]).map((p) => {
    const info = SEED_INFO[p.id];
    // the field policy has been revised once, so its history has something to show
    const history =
      p.id === "field"
        ? [
            seedVersion(p, 1, "2026-08-03T05:30:00Z", "Farah Nizam", "Created for the field team.", { sessions: 3, creditDuty: false }),
            seedVersion(p, 2, "2026-09-14T09:10:00Z", "Farah Nizam", "Allowed a fourth session and began crediting approved business duty.", { sessions: 4 }),
          ]
        : [seedVersion(p, 1, "2026-08-03T05:30:00Z", "Farah Nizam", "Created with the workspace.")];
    return {
      id: p.id, code: info.code, name: p.name, sessions: p.allowed, requireReason: p.exitReason === "Required", creditDuty: info.creditDuty,
      description: info.description, version: history.length, history,
    };
  });

function load(): { policies: Policy[]; assigned: Record<string, AssignmentRecord> } {
  const seeds = seedPolicies();
  try {
    const raw = safeGet(LS);
    if (!raw) return { policies: seeds, assigned: {} };
    const saved = JSON.parse(raw) as { policies?: Policy[]; assigned?: Record<string, AssignmentRecord> };
    const list = Array.isArray(saved.policies) ? saved.policies : [];
    const merged = seeds.map((s) => list.find((x) => x.id === s.id) ?? s);
    return { policies: [...merged, ...list.filter((x) => !seeds.some((s) => s.id === x.id))], assigned: saved.assigned ?? {} };
  } catch {
    return { policies: seeds, assigned: {} };
  }
}

const toSession = (p: Policy): SessionPolicy => {
  const old = BUILT_IN_POLICIES.find((b) => b.id === p.id);
  return { id: p.id, name: p.name, checkInMode: old?.checkInMode ?? "Self check-in", allowed: p.sessions, exitReason: p.requireReason ? "Required" : "Optional", builtIn: old?.builtIn };
};
/** The Sessions screen reads BUILT_IN_POLICIES directly, so the shared array always mirrors this store. */
const sync = (list: Policy[]) => BUILT_IN_POLICIES.splice(0, BUILT_IN_POLICIES.length, ...list.map(toSession));

const codeFor = (name: string, taken: string[]) => {
  const base = "POL-" + (name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim().split(" ")[0] || "NEW").slice(0, 8);
  let code = base, n = 2;
  while (taken.includes(code)) code = `${base}${n++}`;
  return code;
};

interface PolicyState {
  policies: Policy[];
  assigned: Record<string, AssignmentRecord>;
  create: (d: PolicyDraft, by: string) => Policy;
  /** saves the next version */
  update: (id: string, d: PolicyDraft, by: string, note: string) => void;
  assign: (empId: string, rec: AssignmentRecord) => void;
  /** policies made on the Sessions screen join this list as Version 1 */
  ingest: (custom: SessionPolicy[]) => void;
}

export const usePolicies = create<PolicyState>((set, get) => {
  const initial = load();
  sync(initial.policies);
  const commit = (policies: Policy[], assigned = get().assigned) => {
    sync(policies);
    set({ policies, assigned });
    safeSet(LS, JSON.stringify({ policies, assigned }));
  };
  const entry = (v: number, d: PolicyDraft, by: string, note: string): PolicyVersion => ({ version: v, at: new Date().toISOString(), by, note, ...d });
  return {
    policies: initial.policies,
    assigned: initial.assigned,
    create: (d, by) => {
      const list = get().policies;
      const made: Policy = { ...d, id: `pol-${Date.now().toString(36)}`, code: codeFor(d.name, list.map((p) => p.code)), version: 1, history: [entry(1, d, by, "Created.")] };
      commit([...list, made]);
      return made;
    },
    update: (id, d, by, note) =>
      commit(get().policies.map((p) => (p.id === id ? { ...p, ...d, version: p.version + 1, history: [...p.history, entry(p.version + 1, d, by, note)] } : p))),
    assign: (empId, rec) => commit(get().policies, { ...get().assigned, [empId]: rec }),
    ingest: (custom) => {
      const list = get().policies;
      const fresh = custom.filter((c) => !list.some((p) => p.id === c.id));
      if (!fresh.length) return;
      const made = fresh.map<Policy>((c) => {
        const d: PolicyDraft = { name: c.name, sessions: c.allowed, requireReason: c.exitReason === "Required", creditDuty: true, description: "Created from Sessions & tasks." };
        return { ...d, id: c.id, code: codeFor(c.name, list.map((p) => p.code)), version: 1, history: [entry(1, d, "Sessions & tasks", "Created from the Sessions screen.")] };
      });
      commit([...list, ...made]);
    },
  };
});

/** "Single entry · no re-entry", "4 sessions · 3 re-entries" */
export const sessionsLabel = (n: number) => (n === 1 ? "Single entry · no re-entry" : `${n} sessions · ${n - 1} re-ent${n - 1 === 1 ? "ry" : "ries"}`);
