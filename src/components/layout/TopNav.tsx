import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Hover from "@radix-ui/react-popover";
import { Bell, ChevronDown, FlaskConical, LogOut, Menu as MenuIcon, Moon, Search, Settings, Sun, X } from "lucide-react";
import { activePath, GROUPS, GROUP_ICONS, ROUTES, type Route, type RouteGroup } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useApp } from "@/store/useApp";
import { COMPANY } from "@/store/data";
import { Avatar, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tip } from "@/components/ui/primitives";

export const BRAND = "Meridian";

export const LEGEND = [
  { label: "Work", cls: "bg-work" },
  { label: "Permission", cls: "bg-permission" },
  { label: "Duty", cls: "bg-duty" },
  { label: "Gap", cls: "bg-gap" },
  { label: "Extra", cls: "bg-extra" },
];

/** The mark is a plain glyph: a sun on the meridian line. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M3.5 18.5h17" />
      <path d="M6.5 18.5a5.5 5.5 0 0 1 11 0" />
      <path d="M12 4v5" />
      <path d="m5.2 9.4 2 2" />
      <path d="m18.8 9.4-2 2" />
    </svg>
  );
}

function Brand() {
  return (
    <a href="#/timeline" className="mr-2 flex shrink-0 items-center gap-2 rounded-input pr-2 text-white" aria-label={`${BRAND} home`}>
      <span className="flex h-7 w-7 items-center justify-center rounded-[9px]" style={{ background: "linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--work) 70%, var(--brand)))" }}>
        <BrandMark className="h-[18px] w-[18px] text-white" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight max-sm:hidden">{BRAND}</span>
    </a>
  );
}

/** One screen as it appears in a menu: icon tile, name, a line of what it is for. */
function MenuLink({ r, active, pending, onGo }: { r: Route; active: boolean; pending: number; onGo?: () => void }) {
  const Icon = r.icon;
  const count = r.badge === "permissions" ? pending : 0;
  return (
    <a
      href={`#${r.path}`}
      onClick={onGo}
      aria-current={active ? "page" : undefined}
      className={cn("group flex items-start gap-2.5 rounded-[9px] p-2 transition-colors duration-150 hover:bg-surface-3", active && "bg-brand-soft hover:bg-brand-soft")}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand text-white" : "bg-surface-3 text-ink-2 group-hover:bg-surface group-hover:text-brand-ink")}>
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          {r.label}
          {count > 0 && <span className="tnum inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-pending/30 px-1 text-[10px] font-bold text-duty-ink">{count}</span>}
        </span>
        <span className="block truncate text-[11.5px] text-muted">{r.desc}</span>
      </span>
    </a>
  );
}

const visible = (g: RouteGroup) => ROUTES.filter((r) => r.group === g && !r.hidden);

function GroupMenu({ group, current, pending }: { group: RouteGroup; current: string | null; pending: number }) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>();
  const byPointer = useRef(false);
  const items = visible(group);
  const here = items.some((r) => r.path === current);
  const Icon = GROUP_ICONS[group];
  // a menu opens when the pointer rests on it and closes shortly after the pointer leaves
  const enter = () => { window.clearTimeout(timer.current); byPointer.current = true; setOpen(true); };
  const leave = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(false), 140); };
  return (
    <Hover.Root open={open} onOpenChange={setOpen}>
      <Hover.Trigger asChild>
        <button
          className="navbtn"
          data-active={here || undefined}
          aria-haspopup="menu"
          onPointerEnter={(e) => e.pointerType === "mouse" && enter()}
          onPointerLeave={(e) => e.pointerType === "mouse" && leave()}
          onClick={(e) => { e.preventDefault(); byPointer.current = e.detail > 0; setOpen((o) => (e.detail > 0 ? true : !o)); }}
        >
          <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
          {group}
          {group === "Operate" && pending > 0 && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pending" />}
          <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform duration-150", open && "rotate-180")} aria-hidden />
        </button>
      </Hover.Trigger>
      <Hover.Portal>
        <Hover.Content
          align="start"
          sideOffset={8}
          onOpenAutoFocus={(e) => { if (byPointer.current) e.preventDefault(); }}
          onPointerEnter={enter}
          onPointerLeave={leave}
          className={cn("z-[85] animate-menu rounded-card border border-line bg-surface p-1.5 shadow-pop", items.length > 4 ? "w-[min(640px,calc(100vw-24px))]" : "w-[min(330px,calc(100vw-24px))]")}
        >
          <div className="eyebrow px-2 pb-1 pt-1">{group}</div>
          <div className={cn("grid gap-0.5", items.length > 4 ? "grid-cols-2" : "grid-cols-1")}>
            {items.map((r) => <MenuLink key={r.path} r={r} active={r.path === current} pending={pending} onGo={() => setOpen(false)} />)}
          </div>
        </Hover.Content>
      </Hover.Portal>
    </Hover.Root>
  );
}

export function TopNav({ path, drawer, setDrawer }: { path: string | null; drawer: boolean; setDrawer: (o: boolean) => void }) {
  const s = useApp();
  const pending = s.permissions.filter((p) => p.status === "pending");
  const current = activePath(path);
  return (
    <>
      <header className="topnav">
        <button className="shell-btn lg:hidden" onClick={() => setDrawer(true)} aria-label="Open navigation"><MenuIcon className="h-[18px] w-[18px]" aria-hidden /></button>
        <Brand />

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {GROUPS.map((g) => <GroupMenu key={g} group={g} current={current} pending={pending.length} />)}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {s.sandbox && (
            <button
              onClick={() => s.setSandbox(false)}
              className="mr-1 inline-flex h-7 items-center gap-1.5 rounded-full bg-duty-soft px-2.5 text-[12px] font-semibold text-duty-ink"
              aria-label="Sample data is on. Return to my data"
            >
              <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              <span className="max-sm:hidden">Sample data</span>
              <X className="h-3 w-3" aria-hidden />
            </button>
          )}

          <button
            onClick={() => s.setCommandOpen(true)}
            className="mr-1 flex h-8 w-[220px] items-center gap-2 rounded-input border border-shell-line bg-shell-2 px-2.5 text-left text-[12.5px] text-shell-muted transition-colors duration-150 hover:border-shell-muted/50 max-xl:w-8 max-xl:justify-center max-xl:px-0"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1 truncate max-xl:hidden">Search anything</span>
            <kbd className="hidden rounded border border-shell-line px-1 text-[10px] font-semibold text-shell-muted xl:inline">Ctrl K</kbd>
          </button>

          <Menu>
            <Tip label="Notifications">
              <span className="inline-flex">
                <MenuTrigger asChild>
                  <button className="shell-btn relative" aria-label={`Notifications, ${pending.length} pending`}>
                    <Bell className="h-4 w-4" aria-hidden />
                    {pending.length > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-pending ring-2 ring-shell" />}
                  </button>
                </MenuTrigger>
              </span>
            </Tip>
            <MenuContent className="w-[320px]">
              <MenuLabel>Notifications</MenuLabel>
              {pending.length === 0 && <p className="px-2.5 py-3 text-body text-muted">Nothing needs attention.</p>}
              {pending.slice(0, 5).map((p) => (
                <MenuItem key={p.id} onSelect={() => (window.location.hash = `/permission-review?id=${p.id}`)}>
                  <span className="block text-body font-medium">Permission request pending</span>
                  <span className="block truncate text-small text-muted">{p.reason}</span>
                </MenuItem>
              ))}
              {pending.length > 0 && <><MenuSeparator /><MenuItem onSelect={() => (window.location.hash = "/permissions")}>Open Permission desk</MenuItem></>}
            </MenuContent>
          </Menu>

          <Tip label={s.theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
            <button className="shell-btn" onClick={s.toggleTheme} aria-label="Toggle theme" aria-pressed={s.theme === "dark"}>
              {s.theme === "dark" ? <Sun className="h-4 w-4" aria-hidden /> : <Moon className="h-4 w-4" aria-hidden />}
            </button>
          </Tip>

          <Menu>
            <MenuTrigger asChild>
              <button className="ml-1 rounded-[30%]" aria-label="Account menu"><Avatar initials="HS" tone="brand" size={30} /></button>
            </MenuTrigger>
            <MenuContent className="w-[250px]">
              <div className="px-2.5 py-2">
                <div className="text-h3 text-ink">Hema Subramanian</div>
                <div className="text-small text-muted">HR supervisor · {COMPANY.name}</div>
              </div>
              <MenuSeparator />
              <MenuItem icon={Settings} onSelect={() => (window.location.hash = "/settings")}>Settings</MenuItem>
              <MenuItem icon={ROUTES.find((r) => r.path === "/time-rules")!.icon} onSelect={() => (window.location.hash = "/time-rules")}>Time rules</MenuItem>
              <MenuSeparator />
              <MenuItem icon={LogOut}>Sign out</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>

      <Dialog.Root open={drawer} onOpenChange={setDrawer}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-shell/60 backdrop-blur-[2px]" />
          <Dialog.Content aria-describedby={undefined} className="fixed inset-y-0 left-0 z-[71] flex w-[min(340px,92vw)] animate-sheet flex-col bg-surface shadow-pop">
            <Dialog.Title className="sr-only">Navigation</Dialog.Title>
            <div className="flex h-[52px] shrink-0 items-center justify-between bg-shell px-3 text-white">
              <Brand />
              <Dialog.Close className="shell-btn" aria-label="Close navigation"><X className="h-4 w-4" aria-hidden /></Dialog.Close>
            </div>
            <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto p-2">
              {[...GROUPS, "Workspace" as RouteGroup].map((g) => (
                <div key={g} className="mb-2">
                  <div className="eyebrow px-2 pb-1 pt-2">{g}</div>
                  {visible(g).map((r) => <MenuLink key={r.path} r={r} active={r.path === current} pending={pending.length} onGo={() => setDrawer(false)} />)}
                </div>
              ))}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
