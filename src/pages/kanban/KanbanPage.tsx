import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, rectIntersection, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent, type Announcements } from "@dnd-kit/core";
import { Inbox, ListTodo, Plus, SearchX, Users } from "lucide-react";
import { useApp } from "@/store/useApp";
import type { Route } from "@/lib/routes";
import { navigate } from "@/lib/useHashRoute";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { PageBody, PageHead } from "@/components/layout/PageHead";
import { FilterBar, FilterSearch } from "@/components/layout/FilterBar";
import { EmptyState } from "@/components/kit/Blocks";
import { Pager, usePaging } from "@/components/kit/DataGrid";
import { Vitals } from "@/components/kit/Vitals";
import { rememberedReviewer } from "@/pages/permissions/model";
import { DEFAULT_ASSESS } from "@/pages/tasks/model";
import { useTasks } from "@/pages/tasks/store";
import { useTaskSub } from "@/pages/tasks/TaskSub";
import { useOutings } from "@/pages/outings/store";
import { LiftedCard, type CardActions } from "./Card";
import { Lane, hintFor } from "./Lane";
import { MovePicker } from "./Dialogs";
import { QUEUE, checkMove, nameOf, planMove, useBoard, type KCard } from "./model";

/** Pointer position decides the lane; if the pointer is outside every lane (or a keyboard drag has none), fall back to overlap. */
const collide: CollisionDetection = (args) => {
  const hit = pointerWithin(args);
  return hit.length ? hit : rectIntersection(args);
};

const LANE_SIZES = [2, 3, 4, 5, 6, 8];

/** Work by person. The Unassigned queue stays in view on every page; the employees are paged so every column fits the screen. */
export default function KanbanPage({ route }: { route: Route }) {
  const { toast, resetFilters } = useApp();
  const setAssignees = useTasks((s) => s.setAssignees);
  const outings = useOutings((s) => s.outings);
  const [query, setQuery] = useState("");
  const { lanes, waiting, columns } = useBoard(query);

  const wide = useMediaQuery("(min-width: 1500px)");
  const mid = useMediaQuery("(min-width: 1180px)");
  const narrow = useMediaQuery("(min-width: 900px)");
  const phone = useMediaQuery("(max-width: 767px)");
  const queueLane = lanes.find((l) => l.id === QUEUE)!;
  const people = lanes.filter((l) => l.id !== QUEUE);
  const { slice, pager } = usePaging(people, wide ? 5 : mid ? 4 : narrow ? 3 : phone ? 1 : 2, LANE_SIZES);
  const shown = [queueLane, ...slice];

  const [carried, setCarried] = useState<KCard | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [landed, setLanded] = useState<string | null>(null);
  const [width, setWidth] = useState<number | undefined>();
  const [moving, setMoving] = useState<KCard | null>(null);
  const sub = useTaskSub(DEFAULT_ASSESS);

  const landTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(landTimer.current), []);

  // mouse after a few pixels of movement, touch after a short press, so scrolling and clicking still work
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  /**
   * Move a card to a lane. The board changes the instant this runs; the toast offers Undo, which puts the
   * owners back as they were (and says so in the history) unless the task has changed again since.
   */
  const move = useCallback((card: KCard, toId: string): boolean => {
    if (toId === (card.empId ?? QUEUE)) return false;
    const verdict = checkMove(card, toId, outings);
    if (!verdict.ok) {
      toast("error", verdict.reason);
      return false;
    }
    const by = rememberedReviewer() || "HR administrator";
    const plan = planMove(card, toId, outings);
    const before = card.task.assignees;
    setAssignees(card.task.id, plan.assignees, by, plan.history);

    setLanded(`${card.task.id}:${toId}`);
    window.clearTimeout(landTimer.current);
    landTimer.current = window.setTimeout(() => setLanded(null), 1500);

    const after = JSON.stringify(plan.assignees);
    toast("success", plan.toast, {
      duration: 9000,
      action: {
        label: "Undo",
        onClick: () => {
          const now = useTasks.getState().tasks.find((t) => t.id === card.task.id);
          if (!now || JSON.stringify(now.assignees) !== after) {
            toast("error", `${card.task.code} changed since the move, so it can’t be undone automatically.`);
            return;
          }
          setAssignees(card.task.id, before, by, `Move undone. Back with ${card.empId ? nameOf(card.empId) : "Unassigned"}.`);
          setLanded(`${card.task.id}:${card.empId ?? QUEUE}`);
          window.clearTimeout(landTimer.current);
          landTimer.current = window.setTimeout(() => setLanded(null), 1500);
          toast("info", `${card.task.code} is back with ${card.empId ? nameOf(card.empId) : "Unassigned"}.`);
        },
      },
    });
    return true;
  }, [outings, setAssignees, toast]);

  const actions: CardActions = {
    onOpen: (c) => navigate("/task-manage", { id: c.task.id, from: "kanban" }),
    onMove: setMoving,
    onProgress: (c) => c.empId && sub.actions.progress(c.task.id, c.empId),
    onUnassign: (c) => move(c, QUEUE),
  };

  const onStart = (e: DragStartEvent) => {
    setCarried((e.active.data.current as { card: KCard }).card);
    setWidth(e.active.rect.current.initial?.width);
  };
  const end = () => { setCarried(null); setOverId(null); };
  const onEnd = (e: DragEndEvent) => {
    const card = (e.active.data.current as { card: KCard }).card;
    const to = e.over ? String(e.over.id) : null;
    end();
    if (to) move(card, to);
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${(active.data.current as { card: KCard }).card.task.code}.`,
    onDragOver: ({ over }) => (over ? `Over ${nameOf(String(over.id))}.` : "Not over a column."),
    onDragEnd: ({ active, over }) => `${(active.data.current as { card: KCard }).card.task.code} ${over ? `dropped on ${nameOf(String(over.id))}` : "was not moved"}.`,
    onDragCancel: ({ active }) => `Moving ${(active.data.current as { card: KCard }).card.task.code} was cancelled.`,
  };

  return (
    <>
      <PageHead
        route={route}
        actions={
          <>
            <a className="btn" href="#/tasks"><ListTodo aria-hidden />Tasks &amp; outings</a>
            <button className="btn" onClick={() => navigate("/task-edit", { queue: "1", from: "kanban" })}><Inbox aria-hidden />Create unassigned task</button>
            <button className="btn btn-primary" onClick={() => navigate("/task-edit", { from: "kanban" })}><Plus aria-hidden />Create task</button>
          </>
        }
        vitals={
          <Vitals
            items={[
              { tone: "duty", icon: Inbox, label: "Waiting", value: waiting, sub: "for an owner" },
              { tone: "brand", icon: Users, label: "Employee columns", value: columns },
            ]}
          />
        }
      />
      <FilterBar
        fields={route.filters}
        extra={{
          active: !!query,
          onReset: () => setQuery(""),
          node: <FilterSearch label="Find task / customer" placeholder="Task or customer" value={query} onChange={setQuery} className="w-[188px] max-lg:w-full" />,
        }}
      />

      <PageBody>
        <DndContext
          sensors={sensors}
          collisionDetection={collide}
          accessibility={{ announcements }}
          onDragStart={onStart}
          onDragOver={(e) => setOverId(e.over ? String(e.over.id) : null)}
          onDragEnd={onEnd}
          onDragCancel={end}
        >
          <div role="group" aria-label="Employee board" className="grid items-stretch gap-2.5" style={{ gridTemplateColumns: phone ? "minmax(0,1fr)" : `repeat(${shown.length}, minmax(0, 1fr))` }}>
            {shown.map((l) => (
              <Lane
                key={l.id}
                lane={l}
                assessAt={DEFAULT_ASSESS}
                actions={actions}
                landedKey={landed}
                carrying={!!carried}
                hint={carried && overId === l.id && l.id !== (carried.empId ?? QUEUE) ? hintFor(l.id, checkMove(carried, l.id, outings)) : null}
              />
            ))}
          </div>
          {columns === 0 && (
            <div className="panel"><EmptyState icon={SearchX} title="No employee columns" action={<button className="btn btn-sm" onClick={resetFilters}>Clear filters</button>} /></div>
          )}
          <div className="panel overflow-hidden"><Pager {...pager} noun="employees" per="Columns per page" className="border-t-0" /></div>
          <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(.2,.7,.2,1)" }}>
            {carried ? <LiftedCard card={carried} assessAt={DEFAULT_ASSESS} actions={actions} width={width} /> : null}
          </DragOverlay>
        </DndContext>
      </PageBody>

      <MovePicker card={moving} lanes={lanes} onClose={() => setMoving(null)} onPick={(c, to) => { setMoving(null); move(c, to); }} />
      {sub.node}
    </>
  );
}
