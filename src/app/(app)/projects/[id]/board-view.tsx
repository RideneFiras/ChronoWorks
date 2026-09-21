"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status-pill";
import { cn } from "@/lib/cn";
import { formatHours, parseDuration } from "@/lib/duration";
import { formatDate, todayColumn } from "@/lib/format";
import type { AppLocale, BoardColumnRow, TaskRow } from "@/lib/database.types";
import {
  addColumn,
  createTask,
  deleteColumn,
  deleteTask,
  moveTask,
  updateTask,
} from "./task-actions";
import { midpoint } from "@/lib/position";
import { LogTimeDialog } from "./log-time-dialog";

export function BoardView({
  projectId,
  boardId,
  columns,
  tasks,
  hoursPerDay,
  locale,
}: {
  projectId: string;
  boardId: string;
  columns: BoardColumnRow[];
  tasks: TaskRow[];
  hoursPerDay: number;
  locale: AppLocale;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [, start] = useTransition();

  const [dragging, setDragging] = useState<TaskRow | null>(null);
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [logging, setLogging] = useState<TaskRow | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const byColumn = (columnId: string) =>
    tasks.filter((task) => task.column_id === columnId).sort((a, b) => a.position - b.position);

  function onDragStart(event: DragStartEvent) {
    const task = tasks.find((x) => x.id === event.active.id);
    setDragging(task ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    const taskId = String(event.active.id);
    const columnId = event.over ? String(event.over.id) : null;
    if (!columnId) return;

    const task = tasks.find((x) => x.id === taskId);
    if (!task || task.column_id === columnId) return;

    const list = byColumn(columnId);
    const position = midpoint(list.at(-1)?.position ?? null, null);
    start(async () => {
      const result = await moveTask(projectId, taskId, columnId, position);
      if (!result.ok) setError(result.reason ?? null);
      router.refresh();
    });
  }

  function move(task: TaskRow, columnId: string) {
    const list = byColumn(columnId);
    const position = midpoint(list.at(-1)?.position ?? null, null);
    start(async () => {
      await moveTask(projectId, task.id, columnId, position);
      router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-4 text-meta text-red">
          {error}
        </p>
      ) : null}

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="scroll-x flex gap-4 pb-4">
          {columns.map((column) => (
            <Column
              key={column.id}
              column={column}
              tasks={byColumn(column.id)}
              columns={columns}
              locale={locale}
              onAdd={() => setCreatingIn(column.id)}
              onEdit={setEditing}
              onLog={setLogging}
              onMove={move}
              onDelete={(task) =>
                start(async () => {
                  await deleteTask(projectId, task.id);
                  router.refresh();
                })
              }
              onDeleteColumn={() =>
                start(async () => {
                  const result = await deleteColumn(projectId, column.id);
                  if (!result.ok) {
                    setError(result.reason === "not-empty" ? t("columnNotEmpty") : (result.reason ?? null));
                  }
                  router.refresh();
                })
              }
            />
          ))}

          <div className="w-[296px] shrink-0">
            <Button onClick={() => setAddingColumn(true)} className="w-full">
              <Plus size={16} strokeWidth={1.5} />
              {t("newColumn")}
            </Button>
          </div>
        </div>

        <DragOverlay>
          {dragging ? (
            <div className="w-[272px] rounded-panel border border-brass bg-panel p-3">
              <p className="text-body text-ink">{dragging.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {creatingIn || editing ? (
        <TaskDialog
          projectId={projectId}
          task={editing}
          columnId={creatingIn ?? editing?.column_id ?? ""}
          hoursPerDay={hoursPerDay}
          onClose={() => {
            setCreatingIn(null);
            setEditing(null);
            router.refresh();
          }}
        />
      ) : null}

      {logging ? (
        <LogTimeDialog
          projectId={projectId}
          task={logging}
          hoursPerDay={hoursPerDay}
          onClose={() => {
            setLogging(null);
            router.refresh();
          }}
        />
      ) : null}

      {addingColumn ? (
        <Dialog title={t("newColumn")} onClose={() => setAddingColumn(false)}>
          <form
            action={(form: FormData) => {
              const name = String(form.get("name") ?? "");
              start(async () => {
                await addColumn(projectId, boardId, name);
                setAddingColumn(false);
                router.refresh();
              });
            }}
            className="flex flex-col gap-4"
          >
            <Field label={t("columnName")} htmlFor="column_name">
              <Input id="column_name" name="name" required maxLength={60} />
            </Field>
            <div className="flex justify-end gap-3">
              <Button size="dialog" onClick={() => setAddingColumn(false)}>
                {tCommon("cancel")}
              </Button>
              <Button type="submit" size="dialog" variant="primary">
                {tCommon("save")}
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

function Column({
  column,
  tasks,
  columns,
  locale,
  onAdd,
  onEdit,
  onLog,
  onMove,
  onDelete,
  onDeleteColumn,
}: {
  column: BoardColumnRow;
  tasks: TaskRow[];
  columns: BoardColumnRow[];
  locale: AppLocale;
  onAdd: () => void;
  onEdit: (task: TaskRow) => void;
  onLog: (task: TaskRow) => void;
  onMove: (task: TaskRow, columnId: string) => void;
  onDelete: (task: TaskRow) => void;
  onDeleteColumn: () => void;
}) {
  const t = useTranslations("tasks");
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    // DESIGN.md section 5: columns 296px on --night, no border.
    <section ref={setNodeRef} className="w-[296px] shrink-0">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-section font-semibold text-ink">
          {column.name}{" "}
          <span className="text-meta font-medium text-ink-muted tabular">{tasks.length}</span>
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAdd}
            aria-label={t("new")}
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
          >
            <Plus size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={onDeleteColumn}
            aria-label={t("deleteColumn")}
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-red-tint hover:text-red"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      <div className={cn("flex min-h-[80px] flex-col gap-3 rounded-panel p-1", isOver && "bg-raised")}>
        {tasks.length === 0 ? (
          <p className="px-2 py-3 text-meta text-ink-muted">{t("empty")}</p>
        ) : (
          tasks.map((task) => (
            <Card
              key={task.id}
              task={task}
              columns={columns}
              locale={locale}
              onEdit={() => onEdit(task)}
              onLog={() => onLog(task)}
              onMove={(columnId) => onMove(task, columnId)}
              onDelete={() => onDelete(task)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function Card({
  task,
  columns,
  locale,
  onEdit,
  onLog,
  onMove,
  onDelete,
}: {
  task: TaskRow;
  columns: BoardColumnRow[];
  locale: AppLocale;
  onEdit: () => void;
  onLog: () => void;
  onMove: (columnId: string) => void;
  onDelete: () => void;
}) {
  const t = useTranslations("tasks");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });

  const today = todayColumn();
  const soon = new Date();
  soon.setDate(soon.getDate() + 3);
  const soonColumn = todayColumn(soon);

  const due =
    task.completed_at || !task.due_date
      ? null
      : task.due_date < today
        ? ("overdue" as const)
        : task.due_date <= soonColumn
          ? ("dueSoon" as const)
          : null;

  return (
    // DESIGN.md section 5: card on --panel, 1px --line, 8px radius, 12px padding.
    <article
      ref={setNodeRef}
      className={cn(
        "rounded-panel border bg-panel p-3",
        isDragging ? "border-brass opacity-50" : "border-line",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          {...listeners}
          {...attributes}
          onClick={onEdit}
          className="flex-1 text-start text-body text-ink hover:text-brass"
        >
          {task.title}
        </button>
      </div>

      {task.due_date || task.estimate_minutes ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {task.due_date ? (
            due ? (
              <StatusPill tone={due} label={`${t(due)} · ${formatDate(task.due_date, locale)}`} />
            ) : (
              <span className="text-meta text-ink-muted">{formatDate(task.due_date, locale)}</span>
            )
          ) : null}
          {task.estimate_minutes ? (
            <span className="text-meta tabular text-ink-muted">
              {formatHours(task.estimate_minutes)}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="quiet" onClick={onLog} className="h-8 px-2">
          {t("logTime")}
        </Button>

        {/* Every drag needs a keyboard alternative (DESIGN.md section 5). */}
        <div className="flex items-center gap-1">
          <label className="sr-only" htmlFor={`move-${task.id}`}>
            {t("moveTo")}
          </label>
          <Select
            id={`move-${task.id}`}
            value={task.column_id}
            onChange={(e) => onMove(e.target.value)}
            className="h-8 w-[120px] text-meta"
          >
            {columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <button
            type="button"
            onClick={onDelete}
            aria-label={t("delete")}
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-red-tint hover:text-red"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </article>
  );
}

function TaskDialog({
  projectId,
  task,
  columnId,
  hoursPerDay,
  onClose,
}: {
  projectId: string;
  task: TaskRow | null;
  columnId: string;
  hoursPerDay: number;
  onClose: () => void;
}) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog title={task ? t("edit") : t("new")} onClose={onClose}>
      <form
        action={(form: FormData) => {
          const title = String(form.get("title") ?? "");
          const description = String(form.get("description") ?? "");
          const dueDate = String(form.get("due_date") ?? "");
          const estimateText = String(form.get("estimate") ?? "").trim();

          const estimate =
            estimateText === ""
              ? null
              : parseDuration(estimateText, { hoursPerDay, allowDays: true });
          if (estimateText !== "" && estimate === null) {
            setError(t("estimateHelp"));
            return;
          }

          start(async () => {
            const result = task
              ? await updateTask(projectId, task.id, {
                  title,
                  description: description || null,
                  due_date: dueDate || null,
                  estimate_minutes: estimate,
                })
              : await createTask(
                  projectId,
                  columnId,
                  title,
                  description || null,
                  dueDate || null,
                  estimate,
                );
            if (!result.ok) setError(result.reason ?? null);
            else onClose();
          });
        }}
        className="flex flex-col gap-4"
      >
        <Field label={t("taskTitle")} htmlFor="title">
          <Input id="title" name="title" required maxLength={200} defaultValue={task?.title ?? ""} />
        </Field>

        <Field label={t("description")} htmlFor="description">
          <Textarea id="description" name="description" rows={3} defaultValue={task?.description ?? ""} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dueDate")} htmlFor="due_date">
            <Input id="due_date" name="due_date" type="date" defaultValue={task?.due_date ?? ""} />
          </Field>
          <Field label={t("estimate")} htmlFor="estimate" help={t("estimateHelp")}>
            <Input
              id="estimate"
              name="estimate"
              defaultValue={task?.estimate_minutes ? formatHours(task.estimate_minutes) : ""}
            />
          </Field>
        </div>

        {error ? (
          <p role="alert" className="text-meta text-red">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button size="dialog" onClick={onClose}>
            {tCommon("cancel")}
          </Button>
          <Button type="submit" size="dialog" variant="primary">
            {task ? tCommon("save") : t("create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
