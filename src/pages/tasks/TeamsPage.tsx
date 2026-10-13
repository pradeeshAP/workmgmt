import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Panel } from "@/components/kit/Blocks";
import { EmployeePicker, Field, Input, Textarea } from "@/components/kit/forms";
import { useTeams, type Team } from "./teams";

const PEOPLE = () => EMPLOYEES.map((e) => ({ id: e.id, name: e.name, sub: `${empCode(e.id)} · ${e.dept} · ${e.role}` }));
const NEW = "new";

/** Teams: who belongs to which group, so a task can be assigned to a whole team at once. */
export default function TeamsPage({ route }: { route: Route }) {
  const { teams, save, remove } = useTeams();
  const toast = useApp((s) => s.toast);
  const [sel, setSel] = useState<string>(teams[0]?.id ?? NEW);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const current = teams.find((t) => t.id === sel) ?? null;
  useEffect(() => {
    setName(current?.name ?? "");
    setDescription(current?.description ?? "");
    setMembers(current?.members ?? []);
    setTried(false);
    setConfirm(false);
  }, [sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const taken = teams.some((t) => t.id !== current?.id && t.name.trim().toLowerCase() === name.trim().toLowerCase());
  const err = {
    name: tried && name.trim().length < 3 ? "Give the team a name of at least 3 characters." : tried && taken ? "A team with this name already exists." : "",
    members: tried && members.length === 0 ? "Add at least one member." : "",
  };

  const submit = () => {
    setTried(true);
    if (name.trim().length < 3 || taken || members.length === 0) return;
    const made = save({ id: current?.id, name: name.trim(), description: description.trim(), members });
    setSel(made.id);
    toast("success", current ? `${made.name} saved.` : `${made.name} created with ${members.length} ${members.length === 1 ? "member" : "members"}.`);
  };
  const drop = (t: Team) => {
    remove(t.id);
    setSel(NEW);
    toast("info", `${t.name} deleted. Tasks already assigned through it keep their people.`);
  };

  return (
    <>
      <PageHead
        route={route}
        title="Teams"
        back={{ to: "/tasks", label: "Tasks & outings" }}
        meta={<span className="tnum">{teams.length} {teams.length === 1 ? "team" : "teams"}</span>}
        actions={<button className="btn btn-primary" onClick={submit}>{current ? "Save team" : "Create team"}</button>}
      />
      <PageBody>
        <nav aria-label="Teams" className="flex flex-wrap items-center gap-1.5">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSel(t.id)}
              aria-current={sel === t.id ? "true" : undefined}
              className={cn("flex items-center gap-2 rounded-input border px-3 py-1.5 text-left transition-colors duration-150", sel === t.id ? "border-brand bg-brand-soft" : "border-line bg-surface hover:bg-surface-2")}
            >
              <Users aria-hidden className="h-4 w-4 shrink-0 text-ink-2" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-h3 text-ink">{t.name}</span>
                <span className="tnum block text-[11px] text-muted">{t.members.length} {t.members.length === 1 ? "member" : "members"}</span>
              </span>
              {sel === t.id && <Pencil className="h-3 w-3 text-brand" aria-hidden />}
            </button>
          ))}
          <button className={cn("btn", sel === NEW && "border-brand bg-brand-soft")} onClick={() => setSel(NEW)}><Plus aria-hidden />New team</button>
        </nav>

        <form aria-label={current ? `Edit ${current.name}` : "New team"} noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid items-start gap-3 lg:grid-cols-2">
          <Panel title={current ? current.name : "New team"}>
            <div className="space-y-3">
              <Field label="Team name" required error={err.name}><Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Field operations" suffix={`${name.length}/40`} /></Field>
              <Field label="What the team does" optional><Textarea value={description} maxLength={120} rows={2} onChange={(e) => setDescription(e.target.value)} /></Field>
              {current && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  {confirm ? (
                    <>
                      <p className="text-body text-ink-2">Delete <b className="text-ink">{current.name}</b>? This cannot be undone.</p>
                      <span className="flex gap-2"><button type="button" className="btn btn-sm" onClick={() => setConfirm(false)}>Keep</button><button type="button" className="btn btn-sm btn-danger" onClick={() => drop(current)}>Delete team</button></span>
                    </>
                  ) : (
                    <button type="button" className="btn btn-sm text-gap-ink" onClick={() => setConfirm(true)}><Trash2 aria-hidden />Delete team</button>
                  )}
                </div>
              )}
            </div>
          </Panel>
          <Panel title="Members" count={members.length}>
            <Field label="Who belongs" required error={err.members}>
              <EmployeePicker people={PEOPLE()} selected={members} onChange={setMembers} />
            </Field>
          </Panel>
          <button type="submit" className="sr-only" tabIndex={-1}>Save</button>
        </form>
      </PageBody>
    </>
  );
}
