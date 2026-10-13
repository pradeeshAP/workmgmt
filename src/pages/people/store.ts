import { create } from "zustand";
import { COMPANY, DEPARTMENTS, EMPLOYEES, type Employee } from "@/store/data";
import { safeGet, safeSet } from "@/lib/utils";

const LS = "ascending.org";

/* ------------------------------ records ------------------------------ */
export interface Country { id: string; name: string; code: string }
export interface StateRec { id: string; countryId: string; name: string; code: string }
export interface City { id: string; stateId: string; name: string; code: string }
export interface Company { id: string; cityId: string; name: string; code: string }
export interface Department { id: string; companyId: string; name: string; code: string }
export interface Role { id: string; departmentId: string; name: string; code: string }
export interface Person { id: string; name: string; departmentId: string; roleId: string; shiftId: string; /** ISO date */ joined: string; email?: string }

export interface Lists {
  countries: Country[];
  states: StateRec[];
  cities: City[];
  companies: Company[];
  departments: Department[];
  roles: Role[];
  persons: Person[];
}
export type ListKey = keyof Lists;

/* ------------------------------ seed ------------------------------ */
const JOINED: Record<string, string> = {
  e1: "2019-04-15", e2: "2021-06-01", e3: "2022-01-10", e4: "2022-08-22", e5: "2023-02-13", e6: "2023-07-03",
  e7: "2020-11-09", e8: "2023-10-16", e9: "2021-03-29", e10: "2024-01-08", e11: "2022-05-23", e12: "2025-09-01",
};
const ROLE_CODES: Record<string, string> = {
  "Engineering lead": "ENG-LEAD", "Software engineer": "ENG-SWE", "QA engineer": "ENG-QA", "Site reliability engineer": "ENG-SRE",
  "Operations analyst": "OPS-ANL", "Field coordinator": "OPS-FLD", "Support engineer": "OPS-SUP",
  "HR executive": "ADM-HR", "Accounts associate": "ADM-ACC", "Office manager": "ADM-OFC",
};
const DEPT_CODES: Record<string, string> = { Engineering: "ENG", Operations: "OPS", Administration: "ADM" };

function seed(): Lists {
  const departments: Department[] = Object.entries(DEPT_CODES).map(([name, code]) => ({ id: `d-${code.toLowerCase()}`, companyId: COMPANY.id, name, code }));
  const deptId = (name: string) => departments.find((d) => d.name === name)!.id;
  // the sample employees are read once, before this store starts rewriting EMPLOYEES in place
  const roles: Role[] = [];
  EMPLOYEES.forEach((e) => {
    if (!roles.some((r) => r.name === e.role && r.departmentId === deptId(e.dept))) {
      roles.push({ id: `r-${(ROLE_CODES[e.role] ?? e.role).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, departmentId: deptId(e.dept), name: e.role, code: ROLE_CODES[e.role] ?? e.role.slice(0, 6).toUpperCase() });
    }
  });
  return {
    countries: [
      { id: "c-in", name: "India", code: "IN" },
      { id: "c-sg", name: "Singapore", code: "SG" },
    ],
    states: [
      { id: "s-tn", countryId: "c-in", name: "Tamil Nadu", code: "TN" },
      { id: "s-kl", countryId: "c-in", name: "Kerala", code: "KL" },
      { id: "s-ka", countryId: "c-in", name: "Karnataka", code: "KA" },
      { id: "s-cr", countryId: "c-sg", name: "Central Region", code: "CR" },
    ],
    cities: [
      { id: "ct-tvl", stateId: "s-tn", name: "Tirunelveli", code: "TVL" },
      { id: "ct-maa", stateId: "s-tn", name: "Chennai", code: "MAA" },
      { id: "ct-cbe", stateId: "s-tn", name: "Coimbatore", code: "CBE" },
      { id: "ct-cok", stateId: "s-kl", name: "Kochi", code: "COK" },
      { id: "ct-blr", stateId: "s-ka", name: "Bengaluru", code: "BLR" },
      { id: "ct-sin", stateId: "s-cr", name: "Singapore", code: "SIN" },
    ],
    companies: [{ id: COMPANY.id, cityId: "ct-tvl", name: COMPANY.name, code: "ASC" }],
    departments,
    roles,
    persons: EMPLOYEES.map<Person>((e) => ({
      id: e.id, name: e.name, departmentId: deptId(e.dept),
      roleId: roles.find((r) => r.name === e.role && r.departmentId === deptId(e.dept))!.id,
      shiftId: e.shiftId, joined: JOINED[e.id] ?? "2024-01-01",
    })),
  };
}

function load(): Lists {
  const base = seed();
  try {
    const raw = safeGet(LS);
    if (!raw) return base;
    const saved = JSON.parse(raw) as Partial<Lists>;
    const ok = (Object.keys(base) as ListKey[]).every((k) => Array.isArray(saved[k]));
    return ok ? (saved as Lists) : base;
  } catch {
    return base;
  }
}

/** Every screen reads EMPLOYEES and DEPARTMENTS directly, so they are rewritten in place to mirror the saved records. */
function sync(l: Lists) {
  const dept = (id: string) => l.departments.find((d) => d.id === id);
  const people: Employee[] = l.persons.map((p) => ({
    id: p.id,
    name: p.name,
    dept: dept(p.departmentId)?.name ?? "Unassigned",
    shiftId: p.shiftId,
    role: l.roles.find((r) => r.id === p.roleId)?.name ?? "No role",
  }));
  EMPLOYEES.splice(0, EMPLOYEES.length, ...people);
  const names = Array.from(new Set(l.departments.map((d) => d.name)));
  DEPARTMENTS.splice(0, DEPARTMENTS.length, ...names);
}

/* ------------------------------ store ------------------------------ */
interface OrgState extends Lists {
  /** bumps on every save, so components that read EMPLOYEES or DEPARTMENTS directly can re-render */
  rev: number;
  upsert: <K extends ListKey>(key: K, rec: Lists[K][number]) => void;
}

export const useOrg = create<OrgState>((set, get) => {
  const initial = load();
  sync(initial);
  return {
    ...initial,
    rev: 0,
    upsert: (key, rec) => {
      const list = get()[key] as { id: string }[];
      const next = list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? rec : x)) : [...list, rec];
      const s = get();
      const lists: Lists = { countries: s.countries, states: s.states, cities: s.cities, companies: s.companies, departments: s.departments, roles: s.roles, persons: s.persons, [key]: next };
      sync(lists);
      safeSet(LS, JSON.stringify(lists));
      set({ [key]: next, rev: s.rev + 1 } as Partial<OrgState>);
    },
  };
});

/** Fresh id for a new record. Employees keep the sample "e13" shape so employee codes (AS-1013) stay readable. */
export function newId(key: ListKey, persons: Person[]): string {
  if (key === "persons") return `e${Math.max(0, ...persons.map((p) => Number(p.id.slice(1)) || 0)) + 1}`;
  return `${key.slice(0, 2)}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/* ------------------------------ lookups ------------------------------ */
export interface Place { city?: City; state?: StateRec; country?: Country }
export function placeOf(l: Lists, cityId: string): Place {
  const city = l.cities.find((c) => c.id === cityId);
  const state = l.states.find((s) => s.id === city?.stateId);
  const country = l.countries.find((c) => c.id === state?.countryId);
  return { city, state, country };
}
export const placeText = (p: Place) => [p.city?.name, p.state?.name, p.country?.name].filter(Boolean).join(", ");
