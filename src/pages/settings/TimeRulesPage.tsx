import { CalendarRange, Clock3, ShieldCheck, TimerReset } from "lucide-react";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { Panel } from "@/components/kit/Blocks";
import { LEGEND } from "@/components/layout/TopNav";
import { cn } from "@/lib/utils";
import type { Route } from "@/lib/routes";

const RULES = [
  { icon: Clock3, title: "Work & breaks", body: "Work counts only inside the scheduled shift. Breaks are excluded from scheduled minutes, so they never appear as a gap." },
  { icon: ShieldCheck, title: "Permissions", body: "Approved permission and business duty cover their minutes. Pending requests earn no credit until they are approved." },
  { icon: TimerReset, title: "Late & early", body: "Arriving after the shift start, or leaving before the end, leaves an uncovered gap. Minutes with no record show as + ?." },
  { icon: CalendarRange, title: "Reports", body: "Every report uses the shift start date. An overnight shift ending at 06:00 +1 belongs to the day it began." },
];

/** The rules the numbers follow, in four short notes and the colour key. */
export default function TimeRulesPage({ route }: { route: Route }) {
  return (
    <>
      <PageHead route={route} />
      <PageBody>
        <Panel title="Colour key">
          <ul className="flex flex-wrap gap-x-7 gap-y-2">
            {LEGEND.map((l) => (
              <li key={l.label} className="flex items-center gap-2 text-body font-medium text-ink">
                <span aria-hidden className={cn("h-2.5 w-2.5 rounded-full", l.cls)} />
                {l.label}
              </li>
            ))}
          </ul>
        </Panel>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {RULES.map((r) => (
            <Panel key={r.title} title={r.title} icon={r.icon}>
              <p className="text-body text-ink-2">{r.body}</p>
            </Panel>
          ))}
        </div>
      </PageBody>
    </>
  );
}
