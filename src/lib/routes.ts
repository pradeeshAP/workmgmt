import {
  Building2, ShieldCheck, LayoutTemplate, CalendarRange, Kanban, ListTodo,
  GanttChartSquare, Layers, Inbox, Footprints, UserRound, FileSpreadsheet, FileText, Smartphone, ClipboardList, CalendarDays, Settings, BookOpenCheck,
  CalendarClock, UserCheck, Table2, Rows3, Users, FilePenLine, FilePlus2, ScanSearch, Route as RouteIcon, UserPen,
  type LucideIcon,
} from "lucide-react";

export type FilterField =
  | "company" | "employee" | "date" | "range" | "week" | "month" | "department" | "shift" | "search";

export type RouteGroup = "Operate" | "Plan" | "Insight" | "Registers" | "Setup" | "Workspace";

export interface Route {
  path: string;
  label: string;
  /** one line for the menu */
  desc: string;
  group: RouteGroup;
  icon: LucideIcon;
  filters: FilterField[];
  badge?: "permissions";
  /** short name on the masthead's screen tabs */
  tab?: string;
  /** screens of one family share a tab strip in the masthead */
  family?: string;
  /** a screen reached by a button, not listed in the menu */
  hidden?: boolean;
  /** the menu entry that stays lit while a hidden screen is open */
  parent?: string;
}

export const ROUTES: Route[] = [
  // Operate
  { path: "/my-day", label: "My day", desc: "Check in, check out and see your own day", group: "Operate", icon: Smartphone, filters: [] },
  { path: "/timeline", label: "Attendance timeline", desc: "The day accounted for: coverage and what needs attention", group: "Operate", icon: GanttChartSquare, filters: ["company", "date", "department", "shift", "search"], tab: "Overview", family: "attendance" },
  { path: "/shift-timeline", label: "Shift timeline", desc: "Every shift on its own clock, person by person", group: "Operate", icon: RouteIcon, filters: ["company", "date", "department", "shift", "search"], tab: "Shift timeline", family: "attendance" },
  { path: "/people-attendance", label: "People attendance", desc: "Everyone on the day, with status, hours and flags", group: "Operate", icon: Users, filters: ["company", "date", "department", "shift", "search"], tab: "People", family: "attendance" },
  { path: "/attendance-record", label: "Attendance record", desc: "Punches, permissions and notes for one person and day", group: "Operate", icon: FilePenLine, filters: ["date"], hidden: true, parent: "/people-attendance", family: "attendance" },
  { path: "/sessions", label: "Sessions & tasks", desc: "Check-in and check-out sessions with linked tasks", group: "Operate", icon: Layers, filters: ["employee", "date"] },
  { path: "/permissions", label: "Permission desk", desc: "Review, approve and decline permission requests", group: "Operate", icon: Inbox, filters: ["company", "range", "department", "shift", "search"], badge: "permissions" },
  { path: "/permission-review", label: "Review permission", desc: "One request in full, with its history", group: "Operate", icon: ScanSearch, filters: [], hidden: true, parent: "/permissions" },
  { path: "/permission-new", label: "New permission", desc: "Record a permission on someone's behalf", group: "Operate", icon: FilePlus2, filters: [], hidden: true, parent: "/permissions" },
  { path: "/outings", label: "Outing control", desc: "Plan, depart, return and reconcile outings", group: "Operate", icon: Footprints, filters: ["range", "employee", "department", "search"] },
  { path: "/outing-review", label: "Outing review", desc: "One outing in full, with the decision form", group: "Operate", icon: ScanSearch, filters: [], hidden: true, parent: "/outings" },
  { path: "/outing-plan", label: "Plan an outing", desc: "Request an outing with a manual estimate", group: "Operate", icon: FilePlus2, filters: [], hidden: true, parent: "/outings" },
  // Plan
  { path: "/planner", label: "Shift planner", desc: "Assign shifts across the week", group: "Plan", icon: CalendarRange, filters: ["company", "week", "department", "shift", "search"] },
  { path: "/planner-assign", label: "Assign employees", desc: "Give people a shift across a range of days", group: "Plan", icon: Users, filters: [], hidden: true, parent: "/planner" },
  { path: "/kanban", label: "Employee Kanban", desc: "Work by person, lane by lane", group: "Plan", icon: Kanban, filters: ["company", "range", "department", "search"] },
  { path: "/tasks", label: "Tasks & outings", desc: "Assign, track and close tasks", group: "Plan", icon: ListTodo, filters: ["company", "range", "department", "search"] },
  { path: "/task-manage", label: "Manage task", desc: "A task in full: people, outings, links and activity", group: "Plan", icon: ListTodo, filters: [], hidden: true, parent: "/tasks" },
  { path: "/task-edit", label: "Task", desc: "Create or edit a task", group: "Plan", icon: FilePenLine, filters: [], hidden: true, parent: "/tasks" },
  { path: "/teams", label: "Teams", desc: "Groups of people a task can be assigned to", group: "Plan", icon: Users, filters: [], hidden: true, parent: "/tasks" },
  { path: "/outing-check", label: "Outing check", desc: "Does this outing add up?", group: "Plan", icon: ScanSearch, filters: [], hidden: true, parent: "/tasks" },
  // Insight
  { path: "/individual", label: "Individual report", desc: "One person across a period", group: "Insight", icon: UserRound, filters: ["employee", "range"], tab: "Individual", family: "individual" },
  { path: "/day-detail", label: "Day detail", desc: "One person's day, in the order it happened", group: "Insight", icon: CalendarClock, filters: [], hidden: true, parent: "/individual", family: "individual" },
  { path: "/time-away", label: "Time away", desc: "Permissions and duty time for one person", group: "Insight", icon: CalendarClock, filters: ["employee", "range"], tab: "Time away", family: "individual" },
  { path: "/reports", label: "Reports & export", desc: "Period totals with CSV, Excel and PDF export", group: "Insight", icon: FileSpreadsheet, filters: ["company", "range", "department", "shift", "search"], tab: "Summary", family: "reports" },
  { path: "/report-detail", label: "Detailed report", desc: "Every person and day, line by line", group: "Insight", icon: Table2, filters: ["company", "range", "department", "shift", "search"], tab: "Detailed", family: "reports" },
  { path: "/pdf-preview", label: "PDF preview", desc: "Print-ready report pages", group: "Insight", icon: FileText, filters: ["company", "range", "department", "shift", "search"], tab: "PDF", family: "reports" },
  // Registers
  { path: "/register", label: "Daily register", desc: "The classic day sheet", group: "Registers", icon: ClipboardList, filters: ["date", "department", "search"], tab: "Daily", family: "registers" },
  { path: "/monthly", label: "Monthly report", desc: "A month of attendance, day by day", group: "Registers", icon: CalendarDays, filters: ["month", "department", "search"], tab: "Monthly", family: "registers" },
  // Setup
  { path: "/people", label: "Company & people", desc: "Companies, departments and employees", group: "Setup", icon: Building2, filters: ["company"] },
  { path: "/employee-record", label: "Record", desc: "Create or edit a record of the setup chain", group: "Setup", icon: UserPen, filters: [], hidden: true, parent: "/people" },
  { path: "/policies", label: "Attendance policies", desc: "Session and check-in rules", group: "Setup", icon: ShieldCheck, filters: [], tab: "Policies", family: "policies" },
  { path: "/policy-assignments", label: "Policy assignments", desc: "Who follows which policy", group: "Setup", icon: UserCheck, filters: [], tab: "Assignments", family: "policies" },
  { path: "/policy-edit", label: "Policy", desc: "Create or edit an attendance policy", group: "Setup", icon: FilePenLine, filters: [], hidden: true, parent: "/policies", family: "policies" },
  { path: "/policy-history", label: "Policy history", desc: "Every version of a policy", group: "Setup", icon: ScanSearch, filters: [], hidden: true, parent: "/policies", family: "policies" },
  { path: "/policy-assign", label: "Assign policy", desc: "Give one policy to several people", group: "Setup", icon: UserCheck, filters: [], hidden: true, parent: "/policy-assignments", family: "policies" },
  { path: "/shift-templates", label: "Shift templates", desc: "The shifts people can be rostered on", group: "Setup", icon: LayoutTemplate, filters: [] },
  { path: "/template-edit", label: "Shift template", desc: "Create or edit a shift template", group: "Setup", icon: FilePenLine, filters: [], hidden: true, parent: "/shift-templates" },
  // Workspace
  { path: "/settings", label: "Settings", desc: "Appearance, data and backups", group: "Workspace", icon: Settings, filters: [] },
  { path: "/time-rules", label: "Time rules", desc: "How attendance time is counted", group: "Workspace", icon: BookOpenCheck, filters: [] },
];

export const GROUPS: RouteGroup[] = ["Operate", "Plan", "Insight", "Registers", "Setup"];
export const GROUP_ICONS: Record<RouteGroup, LucideIcon> = {
  Operate: GanttChartSquare, Plan: CalendarRange, Insight: FileSpreadsheet, Registers: Rows3, Setup: Building2, Workspace: Settings,
};
export const DEFAULT_PATH = "/timeline";
export const findRoute = (p: string) => ROUTES.find((r) => r.path === p);
/** the menu entry that stays lit for a path */
export const activePath = (p: string | null) => (p ? findRoute(p)?.parent ?? p : null);
/** the other screens of a route's family, in menu order */
export const familyOf = (r: Route) => (r.family ? ROUTES.filter((x) => x.family === r.family && !x.hidden) : []);
