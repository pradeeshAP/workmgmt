import { createElement, lazy, Suspense, useEffect, useState, type ComponentType } from "react";
import { MotionConfig, motion } from "framer-motion";
import { TooltipProvider } from "@/components/ui/primitives";
import { BRAND, TopNav } from "@/components/layout/TopNav";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { ModalHost, Toaster } from "@/components/layout/Overlays";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { useHashRoute } from "@/lib/useHashRoute";
import { findRoute, type Route } from "@/lib/routes";

import "@/pages/people/store"; // hydrates saved companies and employees before any screen reads them
import "@/store/templates"; // hydrates saved shift templates before any screen reads them
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

const page = (load: () => Promise<{ default: ComponentType<{ route: Route }> }>) => lazy(load);

/** Every screen, by path. Hidden screens (reached by a button) are listed here too. Each loads when first opened. */
const PAGES: Record<string, ComponentType<{ route: Route }>> = {
  "/timeline": page(() => import("@/pages/timeline/TimelinePage")),
  "/shift-timeline": page(() => import("@/pages/timeline/ShiftTimelinePage")),
  "/people-attendance": page(() => import("@/pages/timeline/PeopleAttendancePage")),
  "/attendance-record": page(() => import("@/pages/timeline/RecordPage")),
  "/sessions": page(() => import("@/pages/sessions/SessionsPage")),
  "/permissions": page(() => import("@/pages/permissions/PermissionsPage")),
  "/permission-review": page(() => import("@/pages/permissions/ReviewPage")),
  "/permission-new": page(() => import("@/pages/permissions/NewPermissionPage")),
  "/reports": page(() => import("@/pages/reports/ReportsPage")),
  "/report-detail": page(() => import("@/pages/reports/DetailedReportPage")),
  "/individual": page(() => import("@/pages/individual/IndividualPage")),
  "/day-detail": page(() => import("@/pages/individual/DayDetailPage")),
  "/time-away": page(() => import("@/pages/individual/TimeAwayPage")),
  "/planner": page(() => import("@/pages/planner/PlannerPage")),
  "/planner-assign": page(() => import("@/pages/planner/AssignPage")),
  "/shift-templates": page(() => import("@/pages/templates/TemplatesPage")),
  "/template-edit": page(() => import("@/pages/templates/TemplateEditPage")),
  "/policies": page(() => import("@/pages/policies/PoliciesPage")),
  "/policy-assignments": page(() => import("@/pages/policies/PolicyAssignmentsPage")),
  "/policy-edit": page(() => import("@/pages/policies/PolicyEditPage")),
  "/policy-history": page(() => import("@/pages/policies/PolicyHistoryPage")),
  "/policy-assign": page(() => import("@/pages/policies/PolicyAssignPage")),
  "/tasks": page(() => import("@/pages/tasks/TasksPage")),
  "/task-manage": page(() => import("@/pages/tasks/TaskManagePage")),
  "/task-edit": page(() => import("@/pages/tasks/TaskEditPage")),
  "/teams": page(() => import("@/pages/tasks/TeamsPage")),
  "/outing-check": page(() => import("@/pages/tasks/OutingCheckPage")),
  "/outings": page(() => import("@/pages/outings/OutingsPage")),
  "/outing-review": page(() => import("@/pages/outings/OutingReviewPage")),
  "/outing-plan": page(() => import("@/pages/outings/OutingPlanPage")),
  "/kanban": page(() => import("@/pages/kanban/KanbanPage")),
  "/people": page(() => import("@/pages/people/PeoplePage")),
  "/employee-record": page(() => import("@/pages/people/RecordPage")),
  "/register": page(() => import("@/pages/register/RegisterPage")),
  "/monthly": page(() => import("@/pages/monthly/MonthlyPage")),
  "/pdf-preview": page(() => import("@/pages/pdf/PdfPreviewPage")),
  "/my-day": page(() => import("@/pages/myday/MyDayPage")),
  "/settings": page(() => import("@/pages/settings/SettingsPage")),
  "/time-rules": page(() => import("@/pages/settings/TimeRulesPage")),
};

function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center">
      <h1 className="text-h1 text-ink">Screen not found</h1>
      <a className="btn btn-primary" href="#/timeline">Go to Attendance timeline</a>
    </div>
  );
}

export default function App() {
  const path = useHashRoute();
  const route = path ? findRoute(path) : undefined;
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    document.title = `${route?.label ?? "Not found"} · ${BRAND}`;
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, [route]);

  const Page = route ? PAGES[route.path] : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[90] focus:rounded-input focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <TopNav path={path} drawer={drawer} setDrawer={setDrawer} />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none max-md:pb-[calc(60px+env(safe-area-inset-bottom))]">
          {route && Page ? (
            <ErrorBoundary key={route.path}>
              <motion.div
                key={route.path}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.14, ease: "easeOut" }}
                className="flex flex-1 flex-col"
              >
                <Suspense fallback={<div className="flex-1" aria-busy="true" />}>{createElement(Page, { route })}</Suspense>
              </motion.div>
            </ErrorBoundary>
          ) : (
            <NotFound />
          )}
        </main>
        <MobileTabBar path={path} onMore={() => setDrawer(true)} />
        <Toaster />
        <ModalHost />
        <CommandPalette />
      </TooltipProvider>
    </MotionConfig>
  );
}
