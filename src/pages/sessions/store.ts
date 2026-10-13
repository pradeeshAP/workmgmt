import { create } from "zustand";
import { TODAY } from "@/store/data";
import { safeGet, safeSet } from "@/lib/utils";
import { toMin, type AttRecord, type Pair } from "@/lib/engine";
import { applyPunch } from "./model-core";
import { BUILT_IN_POLICIES, PRACTICE_STEPS, type SessionPolicy } from "./data";

const LS = "ascending.sessions";

interface Saved { customPolicies: SessionPolicy[]; assignments: Record<string, string> }

function load(): Saved {
  const base: Saved = { customPolicies: [], assignments: {} };
  try {
    const raw = safeGet(LS);
    return raw ? { ...base, ...JSON.parse(raw) } : base;
  } catch {
    return base;
  }
}

/** Practice punches are kept against TODAY and shifted onto whichever date is being viewed. */
const PRACTICE_KEY = "e12|practice";
export const scriptPairs = (count: number): Pair[] => {
  let rec: AttRecord = { status: "working", pairs: [], note: "", approveExtra: false };
  PRACTICE_STEPS.slice(0, count).forEach((s) => {
    rec = applyPunch(rec, PRACTICE_KEY, TODAY, { type: s.type, at: toMin(s.at), reason: s.reason, note: s.note });
  });
  return rec.pairs;
};

interface SessionsState extends Saved {
  practicePairs: Pair[];
  practicePolicyId: string;
  addPolicy: (p: SessionPolicy) => void;
  assignPolicy: (empId: string, policyId: string) => void;
  setPracticePairs: (pairs: Pair[]) => void;
  setPracticePolicy: (id: string) => void;
  restartPractice: () => void;
  completePractice: () => void;
}

export const useSessions = create<SessionsState>((set, get) => {
  const save = () => {
    const { customPolicies, assignments } = get();
    safeSet(LS, JSON.stringify({ customPolicies, assignments }));
  };
  return {
    ...load(),
    practicePairs: [],
    practicePolicyId: "field",
    addPolicy: (p) => { set((s) => ({ customPolicies: [...s.customPolicies, p] })); save(); },
    assignPolicy: (empId, policyId) => { set((s) => ({ assignments: { ...s.assignments, [empId]: policyId } })); save(); },
    setPracticePairs: (practicePairs) => set({ practicePairs }),
    setPracticePolicy: (practicePolicyId) => set({ practicePolicyId }),
    restartPractice: () => set({ practicePairs: [] }),
    completePractice: () => set({ practicePairs: scriptPairs(PRACTICE_STEPS.length), practicePolicyId: "field" }),
  };
});

export const allPolicies = (custom: SessionPolicy[]) => [...BUILT_IN_POLICIES, ...custom.filter((c) => !BUILT_IN_POLICIES.some((b) => b.id === c.id))];
