import { Fragment, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { fmtClock } from "@/lib/utils";
import { SHIFTS, TODAY, empCode } from "@/store/data";
import { defaultPolicyId } from "@/pages/sessions/data";
import { useSessions } from "@/pages/sessions/store";
import { usePolicies } from "@/pages/policies/store";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, Panel } from "@/components/kit/Blocks";
import { DatePicker, Field, Input, Select } from "@/components/kit/forms";
import { meta, suggestCode, type Kind } from "./model";
import { newId, useOrg, type Lists } from "./store";

const NAME_MAX = 60;
const norm = (s: string) => s.trim().toLowerCase();

interface Form {
  name: string; code: string;
  countryId: string; stateId: string; cityId: string;
  companyId: string; departmentId: string; roleId: string;
  shiftId: string; joined: string;
  email: string; policyId: string; effective: string;
}
const EMPTY: Form = { name: "", code: "", countryId: "", stateId: "", cityId: "", companyId: "", departmentId: "", roleId: "", shiftId: "general", joined: "", email: "", policyId: "", effective: "" };

/** The policy a role usually follows: people who work away from the office get the field policy, everyone else the office one. */
const policyForRole = (role: string, dept: string) => (/field|site|outdoor|visit|delivery/i.test(role) ? "field" : defaultPolicyId(dept));
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The only choice, or nothing: a one-item list is picked for the person. */
const only = <T extends { id: string }>(list: T[]) => (list.length === 1 ? list[0].id : "");

function initial(kind: Kind, id: string | null, l: Lists, companyId: string, today: string): Form {
  const f: Form = { ...EMPTY, joined: today };
  const fromCity = (cityId: string) => {
    const city = l.cities.find((c) => c.id === cityId);
    const state = l.states.find((s) => s.id === city?.stateId);
    return { cityId, stateId: state?.id ?? "", countryId: state?.countryId ?? "" };
  };
  const fromDept = (departmentId: string) => ({ departmentId, companyId: l.departments.find((d) => d.id === departmentId)?.companyId ?? "" });

  if (id) {
    if (kind === "country") { const r = l.countries.find((x) => x.id === id)!; return { ...f, name: r.name, code: r.code }; }
    if (kind === "state") { const r = l.states.find((x) => x.id === id)!; return { ...f, name: r.name, code: r.code, countryId: r.countryId }; }
    if (kind === "city") { const r = l.cities.find((x) => x.id === id)!; return { ...f, name: r.name, code: r.code, stateId: r.stateId, countryId: l.states.find((s) => s.id === r.stateId)?.countryId ?? "" }; }
    if (kind === "company") { const r = l.companies.find((x) => x.id === id)!; return { ...f, name: r.name, code: r.code, ...fromCity(r.cityId) }; }
    if (kind === "department") { const r = l.departments.find((x) => x.id === id)!; return { ...f, name: r.name, code: r.code, companyId: r.companyId }; }
    if (kind === "role") { const r = l.roles.find((x) => x.id === id)!; return { ...f, name: r.name, code: r.code, ...fromDept(r.departmentId) }; }
    const p = l.persons.find((x) => x.id === id)!;
    const role = l.roles.find((r) => r.id === p.roleId)?.name ?? "";
    const dept = l.departments.find((d) => d.id === p.departmentId)?.name ?? "";
    const rec = usePolicies.getState().assigned[p.id];
    const policyId = useSessions.getState().assignments[p.id] ?? policyForRole(role, dept);
    return { ...f, name: p.name, ...fromDept(p.departmentId), roleId: p.roleId, shiftId: p.shiftId, joined: p.joined, email: p.email ?? "", policyId, effective: rec?.effective ?? p.joined };
  }
  // new record: start from the selected company, and pick any level that has a single choice
  const companyPick = l.companies.some((c) => c.id === companyId) ? companyId : only(l.companies);
  if (kind === "state") f.countryId = only(l.countries);
  if (kind === "city" || kind === "company") {
    f.countryId = only(l.countries);
    const states = l.states.filter((s) => s.countryId === f.countryId);
    f.stateId = f.countryId ? only(states) : "";
    if (kind === "company") f.cityId = f.stateId ? only(l.cities.filter((c) => c.stateId === f.stateId)) : "";
  }
  if (kind === "department" || kind === "role" || kind === "employee") f.companyId = companyPick;
  if (kind === "role" || kind === "employee") f.departmentId = f.companyId ? only(l.departments.filter((d) => d.companyId === f.companyId)) : "";
  if (kind === "employee") {
    f.roleId = f.departmentId ? only(l.roles.filter((r) => r.departmentId === f.departmentId)) : "";
    f.effective = today;
    if (f.roleId) f.policyId = policyForRole(l.roles.find((r) => r.id === f.roleId)?.name ?? "", l.departments.find((d) => d.id === f.departmentId)?.name ?? "");
  }
  return f;
}

/* ------------------------------ breadcrumb ------------------------------ */
function Crumbs({ parts }: { parts: { label: string; value?: string }[] }) {
  return (
    <nav aria-label="Where this record sits" className="rounded-input border border-line bg-surface-2 px-3 py-2.5">
      <div className="eyebrow mb-1.5">Hierarchy preview</div>
      <ol className="flex flex-wrap items-center gap-1.5">
        {parts.map((p, i) => {
          const last = i === parts.length - 1;
          return (
            <Fragment key={p.label}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-faint" aria-hidden />}
              <li
                aria-current={last ? "true" : undefined}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-small font-semibold",
                  p.value ? (last ? "border-brand bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-ink") : "border-dashed border-line-strong text-faint"
                )}
              >
                {p.value || p.label}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------ dialog ------------------------------ */
/** Create or edit one record of the setup chain, as a screen of its own: where it sits on the left, its details on the right. */
export default function RecordPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const kind: Kind = (["country", "state", "city", "company", "department", "role", "employee"] as Kind[]).includes(q.get("kind") as Kind) ? (q.get("kind") as Kind) : "employee";
  const editId = q.get("id");
  const onClose = () => navigate("/people", { tab: kind });
  const l = useOrg();
  const upsert = useOrg((s) => s.upsert);
  const { toast, filters } = useApp();
  const m = meta(kind);
  const [f, setF] = useState<Form>(() => initial(kind, editId, l, filters.company, TODAY));
  const [codeTouched, setCodeTouched] = useState(!!editId);
  const [policyTouched, setPolicyTouched] = useState(!!editId);
  const policies = usePolicies((s) => s.policies);
  const [tried, setTried] = useState(false);

  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));
  const needsCode = kind !== "employee";
  const needsCountry = kind === "state" || kind === "city" || kind === "company";
  const needsState = kind === "city" || kind === "company";
  const needsCity = kind === "company";
  const needsCompany = kind === "department" || kind === "role" || kind === "employee";
  const needsDept = kind === "role" || kind === "employee";
  const needsRole = kind === "employee";

  const states = l.states.filter((s) => s.countryId === f.countryId);
  const cities = l.cities.filter((c) => c.stateId === f.stateId);
  const depts = l.departments.filter((d) => d.companyId === f.companyId);
  const roles = l.roles.filter((r) => r.departmentId === f.departmentId);
  const shifts = SHIFTS.filter((s) => !s.archived || s.id === f.shiftId);

  const opts = (list: { id: string; name: string }[], none: string) => [{ value: "", label: none }, ...list.map((x) => ({ value: x.id, label: x.name }))];

  // changing a parent clears the choices below it, keeping a lone remaining option
  const pickCountry = (countryId: string) => {
    const st = l.states.filter((s) => s.countryId === countryId);
    const stateId = only(st);
    set({ countryId, stateId, cityId: stateId ? only(l.cities.filter((c) => c.stateId === stateId)) : "" });
  };
  const pickState = (stateId: string) => set({ stateId, cityId: only(l.cities.filter((c) => c.stateId === stateId)) });
  const pickCompany = (companyId: string) => {
    const ds = l.departments.filter((d) => d.companyId === companyId);
    const departmentId = only(ds);
    set({ companyId, departmentId, roleId: departmentId ? only(l.roles.filter((r) => r.departmentId === departmentId)) : "" });
  };
  const policyFor = (roleId: string, departmentId: string) =>
    policyForRole(l.roles.find((r) => r.id === roleId)?.name ?? "", l.departments.find((d) => d.id === departmentId)?.name ?? "");
  // until the policy is chosen by hand, it follows the role
  const withPolicy = (patch: Partial<Form>): Partial<Form> => {
    if (kind !== "employee" || policyTouched) return patch;
    const roleId = patch.roleId ?? f.roleId, departmentId = patch.departmentId ?? f.departmentId;
    return roleId ? { ...patch, policyId: policyFor(roleId, departmentId) } : patch;
  };
  const pickDept = (departmentId: string) => set(withPolicy({ departmentId, roleId: only(l.roles.filter((r) => r.departmentId === departmentId)) }));
  const onName = (name: string) => set({ name, ...(needsCode && !codeTouched ? { code: suggestCode(name) } : {}) });

  /* ----- validation ----- */
  const name = f.name.trim();
  const code = f.code.trim().toUpperCase();
  const errors = useMemo(() => {
    const e: Partial<Record<keyof Form, string>> = {};
    if (!name) e.name = `Give the ${m.singular} a name.`;
    else {
      const siblings: { id: string; name: string }[] =
        kind === "country" ? l.countries :
        kind === "state" ? l.states.filter((x) => x.countryId === f.countryId) :
        kind === "city" ? l.cities.filter((x) => x.stateId === f.stateId) :
        kind === "company" ? l.companies :
        kind === "department" ? l.departments.filter((x) => x.companyId === f.companyId) :
        kind === "role" ? l.roles.filter((x) => x.departmentId === f.departmentId) :
        l.persons.filter((x) => x.departmentId === f.departmentId);
      const clash = siblings.find((x) => x.id !== editId && norm(x.name) === norm(name));
      if (clash) e.name = kind === "employee" ? `${name} is already in this department.` : `A ${m.singular} named “${name}” already exists here.`;
    }
    if (needsCode) {
      if (!code) e.code = "Add a short code.";
      else if (!/^[A-Z0-9-]{2,10}$/.test(code)) e.code = "Use 2 to 10 letters, numbers or dashes.";
      else {
        const all: { id: string; code: string }[] = kind === "country" ? l.countries : kind === "state" ? l.states : kind === "city" ? l.cities : kind === "company" ? l.companies : kind === "department" ? l.departments : l.roles;
        if (all.some((x) => x.id !== editId && x.code.toUpperCase() === code)) e.code = `The code ${code} is already used.`;
      }
    }
    if (needsCountry && !f.countryId) e.countryId = "Choose a country.";
    if (needsState && !f.stateId) e.stateId = "Choose a state.";
    if (needsCity && !f.cityId) e.cityId = "Choose a city.";
    if (needsCompany && !f.companyId) e.companyId = "Choose a company.";
    if (needsDept && !f.departmentId) e.departmentId = "Choose a department.";
    if (needsRole && !f.roleId) e.roleId = "Choose a role.";
    if (kind === "employee" && !f.joined) e.joined = "Pick the joining date.";
    if (kind === "employee" && f.email.trim()) {
      if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid email address, like name@company.com.";
      else if (l.persons.some((x) => x.id !== editId && x.email?.toLowerCase() === f.email.trim().toLowerCase())) e.email = "Another employee already uses this email.";
    }
    if (kind === "employee" && !f.policyId) e.policyId = "Choose an attendance policy.";
    if (kind === "employee" && f.effective && f.joined && f.effective < f.joined) e.effective = "The policy cannot start before the joining date.";
    return e;
  }, [f, name, code, kind, l, editId]); // eslint-disable-line react-hooks/exhaustive-deps
  const show = (k: keyof Form) => (tried ? errors[k] : undefined);
  const nameShown = errors.name && (tried || name) ? errors.name : undefined;

  const submit = () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    const id = editId ?? newId(m.key, l.persons);
    if (kind === "country") upsert("countries", { id, name, code });
    else if (kind === "state") upsert("states", { id, countryId: f.countryId, name, code });
    else if (kind === "city") upsert("cities", { id, stateId: f.stateId, name, code });
    else if (kind === "company") upsert("companies", { id, cityId: f.cityId, name, code });
    else if (kind === "department") upsert("departments", { id, companyId: f.companyId, name, code });
    else if (kind === "role") upsert("roles", { id, departmentId: f.departmentId, name, code });
    else {
      upsert("persons", { id, name, departmentId: f.departmentId, roleId: f.roleId, shiftId: f.shiftId, joined: f.joined, email: f.email.trim() || undefined });
      const pol = policies.find((p) => p.id === f.policyId);
      if (pol) {
        useSessions.getState().assignPolicy(id, pol.id);
        usePolicies.getState().assign(id, { policyId: pol.id, version: pol.version, effective: f.effective || f.joined });
      }
    }
    toast("success", editId ? `${name} saved. Every dropdown now shows the change.` : kind === "employee" ? `${name} added as ${empCode(id)}. They now appear in every employee list.` : `${name} added. It is now available in the dropdowns below it.`);
    onClose();
  };

  /* ----- breadcrumb ----- */
  const country = l.countries.find((x) => x.id === f.countryId)?.name;
  const state = l.states.find((x) => x.id === f.stateId)?.name;
  const city = l.cities.find((x) => x.id === f.cityId)?.name;
  const company = l.companies.find((x) => x.id === f.companyId)?.name;
  const dept = l.departments.find((x) => x.id === f.departmentId)?.name;
  const role = l.roles.find((x) => x.id === f.roleId)?.name;
  const parts =
    kind === "country" ? [{ label: "New country", value: name }]
    : kind === "state" ? [{ label: "Country", value: country }, { label: "New state", value: name }]
    : kind === "city" ? [{ label: "Country", value: country }, { label: "State", value: state }, { label: "New city", value: name }]
    : kind === "company" ? [{ label: "Country", value: country }, { label: "State", value: state }, { label: "City", value: city }, { label: "New company", value: name }]
    : kind === "department" ? [{ label: "Company", value: company }, { label: "New department", value: name }]
    : kind === "role" ? [{ label: "Company", value: company }, { label: "Department", value: dept }, { label: "New role", value: name }]
    : [{ label: "Company", value: company }, { label: "Department", value: dept }, { label: "Role", value: role }, { label: "New employee", value: name }];

  // a lower level cannot be filled until the level above has records
  const blocker =
    needsCountry && l.countries.length === 0 ? "Add a country first, then come back."
    : needsState && f.countryId && states.length === 0 ? "This country has no states yet. Add one on the States tab first."
    : needsCity && f.stateId && cities.length === 0 ? "This state has no cities yet. Add one on the Cities tab first."
    : needsCompany && l.companies.length === 0 ? "Add a company first, then come back."
    : needsDept && f.companyId && depts.length === 0 ? "This company has no departments yet. Add one on the Departments tab first."
    : needsRole && f.departmentId && roles.length === 0 ? "This department has no roles yet. Add one on the Roles tab first."
    : null;

  const nameField = (
    <Field label={kind === "employee" ? "Full name" : "Name"} required error={nameShown} className={needsCode ? undefined : "sm:col-span-2"}>
      <Input value={f.name} maxLength={NAME_MAX} onChange={(e) => onName(e.target.value)} placeholder={kind === "employee" ? "e.g. Karthik Subramanian" : `e.g. ${kind === "role" ? "Support engineer" : kind === "department" ? "Finance" : kind === "city" ? "Madurai" : "Name"}`} suffix={`${f.name.length}/${NAME_MAX}`} />
    </Field>
  );

  return (
    <>
      <PageHead
        route={route}
        title={`${editId ? "Edit" : "Create"} ${m.singular}`}
        back={{ to: "/people", label: "Company & people" }}
        actions={
          <>
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={!!blocker}>{editId ? "Save changes" : `Create ${m.singular}`}</button>
          </>
        }
      />
      <PageBody>
        <form className="grid items-start gap-3 lg:grid-cols-2" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="space-y-3">
            <Crumbs parts={parts} />
            {blocker && <Callout kind="warning" lead="One step first.">{blocker}</Callout>}
            {(needsCountry || needsCompany) && (
              <Panel title="Where it sits">
                <div className="grid gap-3 sm:grid-cols-2">
                  {needsCountry && (
                    <Field label="Country" required error={show("countryId")}>
                      <Select value={f.countryId} onChange={(e) => pickCountry(e.target.value)} options={opts(l.countries, "Choose a country")} />
                    </Field>
                  )}
                  {needsState && (
                    <Field label="State" required error={show("stateId")}>
                      <Select value={f.stateId} disabled={!f.countryId} onChange={(e) => pickState(e.target.value)} options={opts(states, f.countryId ? "Choose a state" : "Choose a country first")} />
                    </Field>
                  )}
                  {needsCity && (
                    <Field label="City" required error={show("cityId")} className="sm:col-span-2">
                      <Select value={f.cityId} disabled={!f.stateId} onChange={(e) => set({ cityId: e.target.value })} options={opts(cities, f.stateId ? "Choose a city" : "Choose a state first")} />
                    </Field>
                  )}
                  {needsCompany && (
                    <Field label="Company" required error={show("companyId")}>
                      <Select value={f.companyId} onChange={(e) => pickCompany(e.target.value)} options={opts(l.companies, "Choose a company")} />
                    </Field>
                  )}
                  {needsDept && (
                    <Field label="Department" required error={show("departmentId")}>
                      <Select value={f.departmentId} disabled={!f.companyId} onChange={(e) => pickDept(e.target.value)} options={opts(depts, f.companyId ? "Choose a department" : "Choose a company first")} />
                    </Field>
                  )}
                  {needsRole && (
                    <Field label="Role" required error={show("roleId")} className="sm:col-span-2">
                      <Select value={f.roleId} disabled={!f.departmentId} onChange={(e) => set(withPolicy({ roleId: e.target.value }))} options={opts(roles, f.departmentId ? "Choose a role" : "Choose a department first")} />
                    </Field>
                  )}
                </div>
              </Panel>
            )}
          </div>

          <Panel title="Details">
            <div className="grid gap-3 sm:grid-cols-2">
              {nameField}
              {needsCode && (
                <Field label="Code" required error={show("code")}>
                  <Input value={f.code} maxLength={10} onChange={(e) => { setCodeTouched(true); set({ code: e.target.value.toUpperCase() }); }} placeholder="ENG" />
                </Field>
              )}

              {kind === "employee" && (
                <>
                  <Field label="Employee ID">
                    <Input value={editId ? empCode(editId) : `AS-${1000 + (Math.max(0, ...l.persons.map((p) => Number(p.id.slice(1)) || 0)) + 1)}`} readOnly tabIndex={-1} />
                  </Field>
                  <Field label="Email" optional error={show("email")}>
                    <Input type="email" value={f.email} maxLength={80} onChange={(e) => set({ email: e.target.value })} placeholder="name@company.com" />
                  </Field>
                  <Field label="Joined on" required error={show("joined")}>
                    <DatePicker value={f.joined} onChange={(v) => set({ joined: v, ...(f.effective === "" || f.effective === f.joined ? { effective: v } : {}) })} />
                  </Field>
                  <Field label="First shift" optional>
                    <Select value={f.shiftId} onChange={(e) => set({ shiftId: e.target.value })} options={shifts.map((s) => ({ value: s.id, label: `${s.name} · ${fmtClock(s.start)} – ${fmtClock(s.end)}` }))} />
                  </Field>
                  <Field label="Attendance policy" required error={show("policyId")}>
                    <Select value={f.policyId} onChange={(e) => { setPolicyTouched(true); set({ policyId: e.target.value }); }} options={[{ value: "", label: "Choose a policy" }, ...policies.map((p) => ({ value: p.id, label: `${p.name} · v${p.version}` }))]} />
                  </Field>
                  <Field label="Policy effective from" required error={show("effective")}>
                    <DatePicker value={f.effective || f.joined} onChange={(v) => set({ effective: v })} />
                  </Field>
                  {editId && <p className="text-small text-muted sm:col-span-2">Employee code <b className="tnum text-ink">{empCode(editId)}</b>{f.joined && <> · joined {format(parseISO(f.joined), "dd MMM yyyy")}</>}</p>}
                </>
              )}
            </div>
          </Panel>
          <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
        </form>
      </PageBody>
    </>
  );
}
