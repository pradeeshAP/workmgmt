import { useMemo, useState } from "react";
import { Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { EMPLOYEES, empCode } from "@/store/data";
import type { Route } from "@/lib/routes";
import { navigate, useRouteQuery } from "@/lib/useHashRoute";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Callout, Panel } from "@/components/kit/Blocks";
import { SegmentedControl } from "@/components/kit/Segmented";
import { DateTimePicker, EmployeePicker, Field, Input, Select, Textarea } from "@/components/kit/forms";
import { useOrg } from "@/pages/people/store";
import { rememberedReviewer } from "@/pages/permissions/model";
import { CATEGORIES, MODE_LABEL, useTasks, type Mode, type Priority, type TaskItem } from "./store";
import { useTeams } from "./teams";

const ORIGIN = "Tirunelveli office";
const PEOPLE = () => EMPLOYEES.map((e) => ({ id: e.id, name: e.name, sub: `${empCode(e.id)} · ${e.dept} · ${e.role}` }));

type By = "none" | "employees" | "teams" | "both";
type Where = "off-site" | "on-site";

interface Form {
  title: string;
  company: string;
  department: string;
  category: string;
  priority: Priority;
  location: Where;
  destination: string;
  start: string;
  due: string;
  instructions: string;
  by: By;
  people: string[];
  teamIds: string[];
  mode: Mode;
}

const blank = (queue?: boolean, company = ""): Form => ({
  title: "", company, department: "", category: CATEGORIES[0], priority: "medium", location: "off-site", destination: "",
  start: "2026-10-08T09:00", due: "2026-10-08T17:00", instructions: "", by: queue ? "none" : "employees", people: [], teamIds: [], mode: "individual",
});
const formOf = (t: TaskItem): Form => {
  const used = useTeams.getState().teams.filter((x) => t.teamIds?.includes(x.id));
  const viaTeams = new Set(used.flatMap((x) => x.members));
  const all = t.assignees.map((a) => a.empId);
  const direct = all.filter((id) => !viaTeams.has(id));
  const by: By = all.length === 0 ? "none" : used.length ? (direct.length ? "both" : "teams") : "employees";
  return {
    title: t.title, company: t.company ?? "", department: t.department ?? "", category: t.category, priority: t.priority,
    location: t.location ?? (t.destination === ORIGIN ? "on-site" : "off-site"), destination: t.destination, start: t.start, due: t.due, instructions: t.instructions ?? "",
    by, people: by === "employees" ? all : direct, teamIds: used.map((x) => x.id), mode: t.mode,
  };
};

const BY_OPTIONS: { value: By; label: string }[] = [
  { value: "none", label: "Unassigned" },
  { value: "employees", label: "Employees" },
  { value: "teams", label: "Teams" },
  { value: "both", label: "Both" },
];

/** where Back and Save lead: the screen the person came from */
const returnTo = (from: string, id: string | null): { to: string; label: string; query?: Record<string, string> } =>
  from === "kanban" ? { to: "/kanban", label: "Employee Kanban" }
  : from === "manage" && id ? { to: "/task-manage", label: "Task", query: { id } }
  : { to: "/tasks", label: "Tasks & outings" };

/**
 * Create a task, or edit one. Editing keeps each remaining person's progress and records who changed what, and why.
 * A screen of its own: the work and the schedule on the left, who it is for on the right.
 */
export default function TaskEditPage({ route }: { route: Route }) {
  const q = useRouteQuery();
  const id = q.get("id");
  const queue = q.get("queue") === "1";
  const back = returnTo(q.get("from") ?? "tasks", id);
  const { create, update } = useTasks();
  const tasks = useTasks((s) => s.tasks);
  const task = tasks.find((t) => t.id === id) ?? null;
  const toast = useApp((s) => s.toast);
  const filters = useApp((s) => s.filters);
  const companies = useOrg((s) => s.companies);
  const departments = useOrg((s) => s.departments);
  const teams = useTeams((s) => s.teams);

  const defaultCompany = companies.find((c) => c.id === filters.company)?.name ?? companies[0]?.name ?? "";
  const [f, setF] = useState<Form>(() => (task ? formOf(task) : blank(queue, defaultCompany)));
  const [editor, setEditor] = useState(() => rememberedReviewer());
  const [why, setWhy] = useState("");
  const [tried, setTried] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const companyId = companies.find((c) => c.name === f.company)?.id;
  const deptOptions = useMemo(() => departments.filter((d) => d.companyId === companyId), [departments, companyId]);

  const usesEmployees = f.by === "employees" || f.by === "both";
  const usesTeams = f.by === "teams" || f.by === "both";
  // everyone the task reaches: chosen employees plus the members of chosen teams
  const everyone = useMemo(() => {
    const ids = new Set<string>(usesEmployees ? f.people : []);
    if (usesTeams) for (const t of teams) if (f.teamIds.includes(t.id)) t.members.forEach((m) => ids.add(m));
    return [...ids];
  }, [f.people, f.teamIds, usesEmployees, usesTeams, teams]);

  const mode: Mode = everyone.length > 1 && f.mode === "individual" ? "team-all" : everyone.length <= 1 ? "individual" : f.mode;
  const err = {
    title: tried && f.title.trim().length < 3 ? "Give the task a name of at least 3 characters." : "",
    company: tried && !f.company ? "Choose a company." : "",
    destination: tried && f.location === "off-site" && f.destination.trim().length < 2 ? "An off-site task needs a destination." : "",
    due: tried && f.due <= f.start ? "The deadline must be after the start." : "",
    people: tried && f.by !== "none" && everyone.length === 0 ? (usesTeams && !usesEmployees ? "Choose at least one team." : "Choose who the task is for.") : "",
    editor: tried && task && editor.trim().length < 2 ? "Enter your name for the history." : "",
    why: tried && task && why.trim().length < 5 ? "Say why you are editing this task." : "",
  };

  const leave = () => navigate(back.to, back.query);
  const submit = () => {
    setTried(true);
    const wrong =
      f.title.trim().length < 3 || !f.company || f.due <= f.start || (f.location === "off-site" && f.destination.trim().length < 2) ||
      (f.by !== "none" && everyone.length === 0) || (!!task && (editor.trim().length < 2 || why.trim().length < 5));
    if (wrong) return;
    const by = (task ? editor.trim() : rememberedReviewer()) || "HR administrator";
    const assignees = f.by === "none" ? [] : everyone.map((id) => task?.assignees.find((a) => a.empId === id) ?? { empId: id, origin: ORIGIN, outcome: "assigned" as const, progress: 0 });
    const draft = {
      category: f.category, title: f.title.trim(), destination: f.location === "on-site" ? f.destination.trim() || ORIGIN : f.destination.trim(), mode, assignees,
      start: f.start, due: f.due, priority: f.priority, company: f.company, department: f.department || undefined, location: f.location,
      instructions: f.instructions.trim() || undefined, teamIds: usesTeams ? f.teamIds : [],
    };
    if (task) {
      update(task.id, draft, by, `Reason: ${why.trim()}`);
      toast("success", `${task.code} saved.`);
    } else {
      const made = create(draft, by);
      toast("success", assignees.length ? `${made.code} created for ${assignees.length} ${assignees.length === 1 ? "person" : "people"}.` : `${made.code} added to the Unassigned queue.`);
    }
    leave();
  };

  return (
    <>
      <PageHead
        route={route}
        back={{ to: back.to, label: back.label }}
        title={task ? `Edit ${task.code}` : queue ? "Create unassigned task" : "Create & assign task"}
        actions={
          <>
            <button className="btn" onClick={leave}>Cancel</button>
            <button className="btn btn-primary" onClick={submit}>{task ? "Save task" : f.by === "none" ? "Add to queue" : "Create & assign"}</button>
          </>
        }
      />
      <PageBody>
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <div className="space-y-3">
            <Panel title="The work">
              <div className="space-y-3">
                <Field label="Task name" required error={err.title}>
                  <Input value={f.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Collect signed contracts" suffix={`${f.title.length}/80`} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Company" required error={err.company}>
                    <Select value={f.company} onChange={(e) => setF((x) => ({ ...x, company: e.target.value, department: "" }))} options={[{ value: "", label: "Choose a company" }, ...companies.map((c) => ({ value: c.name, label: c.name }))]} />
                  </Field>
                  <Field label="Department" optional>
                    <Select value={f.department} disabled={!f.company} onChange={(e) => set("department", e.target.value)} options={[{ value: "", label: f.company ? "Any department" : "Choose a company first" }, ...deptOptions.map((d) => ({ value: d.name, label: d.name }))]} />
                  </Field>
                  <Field label="Category"><Select value={f.category} onChange={(e) => set("category", e.target.value)} options={CATEGORIES.map((c) => ({ value: c, label: c }))} /></Field>
                  <Field label="Priority">
                    <SegmentedControl<Priority> label="Priority" value={f.priority} onChange={(v) => set("priority", v)} options={[{ value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} />
                  </Field>
                </div>
                <Field label="Instructions" optional><Textarea value={f.instructions} maxLength={400} rows={3} onChange={(e) => set("instructions", e.target.value)} placeholder="What to do, what to bring, who to meet" /></Field>
              </div>
            </Panel>

            <Panel title="Where and when">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Location">
                  <SegmentedControl<Where> label="Location" value={f.location} onChange={(v) => set("location", v)} options={[{ value: "off-site", label: "Off site" }, { value: "on-site", label: "On site" }]} />
                </Field>
                <Field label="Destination" required={f.location === "off-site"} optional={f.location === "on-site"} error={err.destination}>
                  <Input value={f.destination} maxLength={80} onChange={(e) => set("destination", e.target.value)} placeholder={f.location === "off-site" ? "Where the work happens" : ORIGIN} />
                </Field>
                <Field label="Starts"><DateTimePicker value={f.start} onChange={(v) => set("start", v)} /></Field>
                <Field label="Deadline" error={err.due}><DateTimePicker value={f.due} baseDate={f.start.slice(0, 10)} onChange={(v) => set("due", v)} /></Field>
              </div>
            </Panel>
          </div>

          <div className="space-y-3">
            <Panel title="Assign by" count={f.by === "none" ? undefined : everyone.length}>
              <div className="space-y-3">
                <SegmentedControl<By> label="Assign by" value={f.by} onChange={(v) => set("by", v)} options={BY_OPTIONS} />
                {f.by === "none" && <Callout kind="info" lead="No owner yet" />}
                {usesEmployees && (
                  <Field label="Employees" required={f.by === "employees"} error={f.by === "employees" ? err.people : ""}>
                    <EmployeePicker people={PEOPLE()} selected={f.people} onChange={(ids) => set("people", ids)} />
                  </Field>
                )}
                {usesTeams && (
                  <Field label="Teams" required={f.by === "teams"} error={f.by === "teams" || everyone.length === 0 ? err.people : ""}>
                    <div className="rounded-input border border-line">
                      <ul className="p-1" aria-label="Teams">
                        {teams.length === 0 && <li className="px-3 py-4 text-center text-body text-muted">No teams yet</li>}
                        {teams.map((t) => {
                          const on = f.teamIds.includes(t.id);
                          return (
                            <li key={t.id}>
                              <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 hover:bg-surface-2", on && "bg-brand-soft hover:bg-brand-soft")}>
                                <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={on} onChange={() => set("teamIds", on ? f.teamIds.filter((x) => x !== t.id) : [...f.teamIds, t.id])} />
                                <span className="min-w-0 flex-1 leading-tight">
                                  <span className="block truncate text-[12.5px] font-semibold text-ink">{t.name}</span>
                                  <span className="tnum block truncate text-small text-muted">{t.members.length} {t.members.length === 1 ? "member" : "members"} · {t.members.map((m) => EMPLOYEES.find((e) => e.id === m)?.name.split(" ")[0]).filter(Boolean).join(", ")}</span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                      <div className="border-t border-line p-1.5"><button type="button" className="btn btn-sm w-full" onClick={() => navigate("/teams")}><Settings2 aria-hidden />Manage teams</button></div>
                    </div>
                  </Field>
                )}
                {f.by !== "none" && everyone.length > 1 && (
                  <Field label="Who has to finish it">
                    <Select value={mode} onChange={(e) => set("mode", e.target.value as Mode)} options={(["team-all", "team-any"] as Mode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))} />
                  </Field>
                )}
              </div>
            </Panel>

            {task && (
              <Panel title="For the history">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Edited by" required error={err.editor}><Input value={editor} maxLength={60} onChange={(e) => setEditor(e.target.value)} placeholder="Your name" /></Field>
                  <Field label="Reason for edit" required error={err.why}><Input value={why} maxLength={120} onChange={(e) => setWhy(e.target.value)} placeholder="e.g. Client moved the visit" /></Field>
                </div>
              </Panel>
            )}
          </div>
        </div>
      </PageBody>
    </>
  );
}
