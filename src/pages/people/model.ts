import { BriefcaseBusiness, Building2, Globe, Map as MapIcon, MapPin, Network, UsersRound, type LucideIcon } from "lucide-react";
import { placeOf, placeText, type Lists } from "./store";

export type Kind = "country" | "state" | "city" | "company" | "department" | "role" | "employee";

export interface KindMeta {
  kind: Kind;
  key: keyof Lists;
  step: string;
  singular: string;
  plural: string;
  icon: LucideIcon;
}

export const KINDS: KindMeta[] = [
  { kind: "country", key: "countries", step: "01", singular: "country", plural: "Countries", icon: Globe },
  { kind: "state", key: "states", step: "02", singular: "state", plural: "States", icon: MapIcon },
  { kind: "city", key: "cities", step: "03", singular: "city", plural: "Cities", icon: MapPin },
  { kind: "company", key: "companies", step: "04", singular: "company", plural: "Companies", icon: Building2 },
  { kind: "department", key: "departments", step: "05", singular: "department", plural: "Departments", icon: Network },
  { kind: "role", key: "roles", step: "06", singular: "role", plural: "Roles", icon: BriefcaseBusiness },
  { kind: "employee", key: "persons", step: "07", singular: "employee", plural: "Employees", icon: UsersRound },
];
export const meta = (k: Kind) => KINDS.find((m) => m.kind === k)!;

const n = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

export interface MasterRow { id: string; name: string; code: string; parent: string; connections: string }

/** Departments, roles and employees that belong to one company. */
export function scope(l: Lists, companyId: string) {
  const departments = l.departments.filter((d) => d.companyId === companyId);
  const roles = l.roles.filter((r) => departments.some((d) => d.id === r.departmentId));
  const persons = l.persons.filter((p) => departments.some((d) => d.id === p.departmentId));
  return { departments, roles, persons };
}

export function counts(l: Lists, companyId: string): Record<Kind, number> {
  const s = scope(l, companyId);
  return { country: l.countries.length, state: l.states.length, city: l.cities.length, company: l.companies.length, department: s.departments.length, role: s.roles.length, employee: s.persons.length };
}

export function masterRows(kind: Exclude<Kind, "employee">, l: Lists, companyId: string): MasterRow[] {
  const s = scope(l, companyId);
  switch (kind) {
    case "country":
      return l.countries.map((c) => {
        const states = l.states.filter((x) => x.countryId === c.id);
        const cities = l.cities.filter((x) => states.some((st) => st.id === x.stateId));
        return { id: c.id, name: c.name, code: c.code, parent: "Top level", connections: `${n(states.length, "state")} · ${n(cities.length, "city", "cities")}` };
      });
    case "state":
      return l.states.map((st) => {
        const cities = l.cities.filter((x) => x.stateId === st.id);
        const companies = l.companies.filter((x) => cities.some((c) => c.id === x.cityId));
        return { id: st.id, name: st.name, code: st.code, parent: l.countries.find((c) => c.id === st.countryId)?.name ?? "—", connections: `${n(cities.length, "city", "cities")} · ${n(companies.length, "company", "companies")}` };
      });
    case "city":
      return l.cities.map((c) => {
        const p = placeOf(l, c.id);
        return { id: c.id, name: c.name, code: c.code, parent: [p.state?.name, p.country?.name].filter(Boolean).join(", ") || "—", connections: n(l.companies.filter((x) => x.cityId === c.id).length, "company", "companies") };
      });
    case "company":
      return l.companies.map((c) => {
        const depts = l.departments.filter((d) => d.companyId === c.id);
        const people = l.persons.filter((p) => depts.some((d) => d.id === p.departmentId));
        return { id: c.id, name: c.name, code: c.code, parent: placeText(placeOf(l, c.cityId)) || "No location", connections: `${n(depts.length, "department")} · ${n(people.length, "employee")}` };
      });
    case "department":
      return s.departments.map((d) => ({
        id: d.id, name: d.name, code: d.code,
        parent: l.companies.find((c) => c.id === d.companyId)?.name ?? "—",
        connections: `${n(l.roles.filter((r) => r.departmentId === d.id).length, "role")} · ${n(l.persons.filter((p) => p.departmentId === d.id).length, "employee")}`,
      }));
    case "role":
      return s.roles.map((r) => {
        const d = l.departments.find((x) => x.id === r.departmentId);
        return { id: r.id, name: r.name, code: r.code, parent: d ? `${d.name} · ${l.companies.find((c) => c.id === d.companyId)?.name ?? ""}` : "—", connections: n(l.persons.filter((p) => p.roleId === r.id).length, "employee") };
      });
  }
}

/** "ENG", "SWE", "AS": a short uppercase code suggested from a name. */
export function suggestCode(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3);
  return words.map((w) => w[0]).join("").slice(0, 5);
}
