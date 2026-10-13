import { create } from "zustand";
import { safeGet, safeSet } from "@/lib/utils";
import type { Estimate, Outing, OutingEvent, OutingState } from "./model";

const LS = "ascending.outings";

const E = (outbound: number, onsite: number, ret: number, buffer: number): Estimate => ({ outbound, onsite, ret, buffer });
const ev = (at: string, actor: string, action: string, state: OutingState, note?: string): OutingEvent => ({ at, actor, action, state, ...(note ? { note } : {}) });

/** Sample outings: one in every state of the process. */
const SEEDS: Outing[] = [
  {
    id: "OUT-2078", employeeId: "e2", taskCode: "TSK-2038", date: "2026-10-05", destination: "Tirunelveli Junction", km: 9,
    reqOut: "10:00", reqReturn: "12:30", est: E(15, 110, 15, 10), actualOut: "10:00", actualReturn: "13:00",
    state: "re-review", planReviewer: "Farah Nizam", actualReviewer: "Farah Nizam",
    history: [
      ev("2026-10-02T09:15:00Z", "Arun Daniel", "Requested the outing", "plan-review"),
      ev("2026-10-02T10:00:00Z", "Farah Nizam", "Approved the plan", "plan-approved", "Approved for 10:00 to 12:30."),
      ev("2026-10-05T04:30:00Z", "Arun Daniel", "Checked out", "away"),
      ev("2026-10-05T07:25:00Z", "Arun Daniel", "Checked back in", "actual-review"),
      ev("2026-10-06T04:40:00Z", "Farah Nizam", "Accepted the actual time", "actual-accepted"),
      ev("2026-10-07T05:05:00Z", "Maya Raj", "Edited the return punch", "re-review", "Return corrected from 12:55 to 13:00 after the cabling log was checked."),
    ],
  },
  {
    id: "OUT-2079", employeeId: "e1", taskCode: "TSK-2036", date: "2026-10-06", destination: "Client office, Palayamkottai", km: 7,
    reqOut: "14:00", reqReturn: "16:00", est: E(20, 75, 20, 5), actualOut: "14:00", actualReturn: "15:55",
    state: "actual-accepted", planReviewer: "Farah Nizam", actualReviewer: "Farah Nizam",
    history: [
      ev("2026-10-05T10:10:00Z", "Maya Raj", "Requested the outing", "plan-review"),
      ev("2026-10-05T10:45:00Z", "Farah Nizam", "Approved the plan", "plan-approved"),
      ev("2026-10-06T08:30:00Z", "Maya Raj", "Checked out", "away"),
      ev("2026-10-06T10:25:00Z", "Maya Raj", "Checked back in", "actual-review"),
      ev("2026-10-07T04:00:00Z", "Farah Nizam", "Accepted the actual time", "actual-accepted", "Inside the plan. Duty credit given."),
    ],
  },
  {
    id: "OUT-2080", employeeId: "e5", taskCode: "TSK-2043", date: "2026-10-08", destination: "Tenkasi", km: 56,
    reqOut: "20:00", reqReturn: "21:00", est: E(55, 30, 55, 10),
    state: "plan-review",
    history: [ev("2026-10-08T09:25:00Z", "P. Ravi", "Requested the outing", "plan-review")],
  },
  {
    id: "OUT-2081", employeeId: "e2", taskCode: "TSK-2041", date: "2026-10-08", destination: "Palayamkottai", km: 14,
    reqOut: "11:30", reqReturn: "13:00", est: E(25, 45, 20, 10), actualOut: "11:30", actualReturn: "14:00",
    state: "actual-review", planReviewer: "Farah Nizam",
    history: [
      ev("2026-10-07T10:05:00Z", "Arun Daniel", "Requested the outing", "plan-review"),
      ev("2026-10-07T10:40:00Z", "Farah Nizam", "Approved the plan", "plan-approved"),
      ev("2026-10-08T06:00:00Z", "Arun Daniel", "Checked out", "away"),
      ev("2026-10-08T08:30:00Z", "Arun Daniel", "Checked back in", "actual-review"),
    ],
  },
  {
    id: "OUT-2082", employeeId: "e9", taskCode: "TSK-2049", date: "2026-10-08", destination: "Nagercoil", km: 72,
    reqOut: "09:30", reqReturn: "15:30", est: E(75, 150, 75, 30), actualOut: "09:40",
    state: "away", planReviewer: "Maya Raj",
    history: [
      ev("2026-10-07T14:45:00Z", "Ruth George", "Requested the outing", "plan-review"),
      ev("2026-10-07T15:20:00Z", "Maya Raj", "Approved the plan", "plan-approved"),
      ev("2026-10-08T04:10:00Z", "Ruth George", "Checked out", "away"),
    ],
  },
  {
    id: "OUT-2083", employeeId: "e10", taskCode: "TSK-2044", date: "2026-10-08", destination: "Gangaikondan Industrial Estate", km: 22,
    reqOut: "18:30", reqReturn: "19:30", est: E(30, 150, 30, 30),
    state: "clarification", planReviewer: "Farah Nizam",
    history: [
      ev("2026-10-08T07:00:00Z", "Leena Joseph", "Requested the outing", "plan-review"),
      ev("2026-10-08T07:40:00Z", "Farah Nizam", "Asked for clarification", "clarification", "The estimate gives 2h 30m on site for a vendor pickup. What is being collected, and why does it take that long?"),
    ],
  },
  {
    id: "OUT-2084", employeeId: "e12", taskCode: "TSK-2050", date: "2026-10-09", destination: "Madurai regional office", km: 160,
    reqOut: "07:30", reqReturn: "19:30", est: E(150, 180, 150, 30),
    state: "plan-approved", planReviewer: "Maya Raj",
    history: [
      ev("2026-10-08T08:20:00Z", "Sarah Paul", "Requested the outing", "plan-review"),
      ev("2026-10-08T09:05:00Z", "Maya Raj", "Approved the plan", "plan-approved", "Approved. Keep the toll receipts."),
    ],
  },
  {
    id: "OUT-2085", employeeId: "e6", taskCode: "TSK-2047", date: "2026-10-07", destination: "Nagercoil", km: 85,
    reqOut: "13:00", reqReturn: "16:00", est: E(90, 45, 90, 15),
    state: "plan-declined", planReviewer: "Farah Nizam",
    history: [
      ev("2026-10-06T14:00:00Z", "Daniel Lim", "Requested the outing", "plan-review"),
      ev("2026-10-07T03:45:00Z", "Farah Nizam", "Declined the plan", "plan-declined", "The window is an hour shorter than the trip and overlaps release testing. Reschedule once the build is signed off."),
    ],
  },
  {
    id: "OUT-2086", employeeId: "e3", taskCode: "TSK-2052", date: "2026-10-07", destination: "Kokkirakulam", km: 6,
    reqOut: "11:00", reqReturn: "12:00", est: E(10, 30, 10, 5),
    state: "revoked", planReviewer: "Farah Nizam",
    history: [
      ev("2026-10-06T15:00:00Z", "N. Priya", "Requested the outing", "plan-review"),
      ev("2026-10-06T15:30:00Z", "Farah Nizam", "Approved the plan", "plan-approved"),
      ev("2026-10-07T04:10:00Z", "Maya Raj", "Revoked the outing", "revoked", "Task revoked. The bank visit was handled online."),
    ],
  },
];

function load(): Outing[] {
  try {
    const raw = safeGet(LS);
    if (!raw) return SEEDS;
    const saved = JSON.parse(raw) as Outing[];
    if (!Array.isArray(saved)) return SEEDS;
    return [...SEEDS.map((s) => saved.find((x) => x.id === s.id) ?? s), ...saved.filter((x) => !SEEDS.some((s) => s.id === x.id))];
  } catch {
    return SEEDS;
  }
}

export type OutingDraft = Pick<Outing, "employeeId" | "taskCode" | "date" | "destination" | "km" | "reqOut" | "reqReturn" | "est"> & Partial<Pick<Outing, "purpose">>;

export interface OutingChange {
  state: OutingState;
  action: string;
  actor: string;
  note?: string;
  patch?: Partial<Pick<Outing, "actualOut" | "actualReturn" | "planReviewer" | "actualReviewer" | "link">>;
}

interface OutingStore {
  outings: Outing[];
  add: (d: OutingDraft, actor: string) => Outing;
  apply: (id: string, c: OutingChange) => void;
}

export const useOutings = create<OutingStore>((set, get) => {
  const commit = (outings: Outing[]) => {
    set({ outings });
    safeSet(LS, JSON.stringify(outings));
  };
  return {
    outings: load(),
    add: (d, actor) => {
      const list = get().outings;
      const n = list.reduce((m, o) => Math.max(m, Number(o.id.slice(4)) || 0), 2086) + 1;
      const made: Outing = { ...d, id: `OUT-${n}`, state: "plan-review", history: [ev(new Date().toISOString(), actor, "Requested the outing", "plan-review")] };
      commit([...list, made]);
      return made;
    },
    apply: (id, c) =>
      commit(
        get().outings.map((o) =>
          o.id === id ? { ...o, ...c.patch, state: c.state, history: [...o.history, ev(new Date().toISOString(), c.actor, c.action, c.state, c.note)] } : o
        )
      ),
  };
});
