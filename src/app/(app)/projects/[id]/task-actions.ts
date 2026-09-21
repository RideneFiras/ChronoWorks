"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { midpoint } from "@/lib/position";

export interface TaskResult {
  ok: boolean;
  reason?: string;
}

export async function createTask(
  projectId: string,
  columnId: string,
  title: string,
  description: string | null,
  dueDate: string | null,
  estimateMinutes: number | null,
): Promise<TaskResult> {
  if (title.trim() === "") return { ok: false, reason: "title" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("tasks").insert({
    project_id: projectId,
    column_id: columnId,
    title: title.trim(),
    description: description?.trim() || null,
    due_date: dueDate,
    estimate_minutes: estimateMinutes,
    position: midpoint(last?.position ?? null, null),
  });

  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateTask(
  projectId: string,
  id: string,
  values: {
    title: string;
    description: string | null;
    due_date: string | null;
    estimate_minutes: number | null;
  },
): Promise<TaskResult> {
  if (values.title.trim() === "") return { ok: false, reason: "title" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tasks")
    .update({ ...values, title: values.title.trim() })
    .eq("id", id);

  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Used by both the drag and the keyboard "Move to" menu. */
export async function moveTask(
  projectId: string,
  id: string,
  columnId: string,
  position: number,
): Promise<TaskResult> {
  const supabase = await createClient();

  // A column of another project would be refused by the tasks_guard trigger,
  // but check here too: these arguments come from the client.
  const { data: column } = await supabase
    .from("board_columns")
    .select("id, board_id")
    .eq("id", columnId)
    .maybeSingle();
  if (!column) return { ok: false, reason: "column" };

  const doneColumn = await isDoneColumn(columnId);
  const { error } = await supabase
    .from("tasks")
    .update({
      column_id: columnId,
      position,
      completed_at: doneColumn ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

async function isDoneColumn(columnId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("board_columns")
    .select("name")
    .eq("id", columnId)
    .maybeSingle();
  return /^(done|termin)/i.test(data?.name ?? "");
}

export async function deleteTask(projectId: string, id: string): Promise<TaskResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function addColumn(
  projectId: string,
  boardId: string,
  name: string,
): Promise<TaskResult> {
  if (name.trim() === "") return { ok: false, reason: "name" };

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("board_columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("board_columns").insert({
    board_id: boardId,
    name: name.trim(),
    position: midpoint(last?.position ?? null, null),
  });

  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteColumn(projectId: string, id: string): Promise<TaskResult> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("column_id", id);

  if ((count ?? 0) > 0) return { ok: false, reason: "not-empty" };

  const { error } = await supabase.from("board_columns").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
