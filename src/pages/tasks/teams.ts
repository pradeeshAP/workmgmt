import { create } from "zustand";
import { safeGet, safeSet } from "@/lib/utils";

const LS = "ascending.teams";

export interface Team {
  id: string;
  name: string;
  description: string;
  /** employee ids */
  members: string[];
}

const SEEDS: Team[] = [
  { id: "team-field", name: "Field operations", description: "Site visits, client calls and pickups.", members: ["e2", "e5", "e10"] },
  { id: "team-release", name: "Release crew", description: "Builds, smoke tests and sign-off.", members: ["e1", "e2", "e3", "e6"] },
  { id: "team-front", name: "Front office", description: "Reception, accounts and HR.", members: ["e7", "e9", "e12"] },
];

function load(): Team[] {
  try {
    const raw = safeGet(LS);
    const saved = raw ? (JSON.parse(raw) as Team[]) : null;
    return Array.isArray(saved) ? saved : SEEDS;
  } catch {
    return SEEDS;
  }
}

interface TeamState {
  teams: Team[];
  save: (t: Omit<Team, "id"> & { id?: string }) => Team;
  remove: (id: string) => void;
}

export const useTeams = create<TeamState>((set, get) => {
  const commit = (teams: Team[]) => {
    set({ teams });
    safeSet(LS, JSON.stringify(teams));
  };
  return {
    teams: load(),
    save: (t) => {
      const list = get().teams;
      const made: Team = { ...t, id: t.id ?? `team-${Date.now().toString(36)}` };
      commit(list.some((x) => x.id === made.id) ? list.map((x) => (x.id === made.id ? made : x)) : [...list, made]);
      return made;
    },
    remove: (id) => commit(get().teams.filter((t) => t.id !== id)),
  };
});
