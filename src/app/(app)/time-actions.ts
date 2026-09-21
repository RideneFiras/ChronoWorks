"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/database.types";

export interface CellResult {
  ok: boolean;
  /** The database refused it, or the input was not a duration. */
  reason?: string;
}

const MAX_MINUTES = 1440;

/**
 * Sets what a Week grid cell holds for one project on one day.
 *
 * The grid shows a total. Zero or one entry behind it is the ordinary case, so
 * we create or update in place and keep the note and the task link. With more
 * than one entry the cell is not a single value any more, so the caller opens
 * the day editor instead and this refuses.
 */
export async function setCellDuration(
  projectId: string,
  entryDate: string,
  minutes: number | null,
): Promise<CellResult> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) return { ok: false, reason: "date" };
  if (minutes !== null && (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES)) {
    return { ok: false, reason: "duration" };
  }

  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("time_entries")
    .select("id, invoice_id")
    .eq("project_id", projectId)
    .eq("entry_date", entryDate)
    .order("created_at", { ascending: true });

  if (readError) return { ok: false, reason: readError.message };

  const rows = existing ?? [];
  if (rows.length > 1) return { ok: false, reason: "several" };

  // Clearing the cell removes the entry.
  if (minutes === null) {
    if (rows.length === 1) {
      const { error } = await supabase.from("time_entries").delete().eq("id", rows[0].id);
      if (error) return { ok: false, reason: error.message };
    }
    revalidatePath("/");
    return { ok: true };
  }

  if (rows.length === 1) {
    const { error } = await supabase
      .from("time_entries")
      .update({ duration_minutes: minutes })
      .eq("id", rows[0].id);
    if (error) return { ok: false, reason: error.message };
  } else {
    const { error } = await supabase
      .from("time_entries")
      .insert({ project_id: projectId, entry_date: entryDate, duration_minutes: minutes });
    if (error) return { ok: false, reason: error.message };
  }

  revalidatePath("/");
  return { ok: true };
}

export async function addTimeEntry(
  projectId: string,
  entryDate: string,
  minutes: number,
  description: string | null,
  taskId: string | null = null,
): Promise<CellResult> {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES) {
    return { ok: false, reason: "duration" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    entry_date: entryDate,
    duration_minutes: minutes,
    description: description?.trim() || null,
    task_id: taskId,
  });

  if (error) return { ok: false, reason: error.message };

  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function updateTimeEntry(
  id: string,
  minutes: number,
  description: string | null,
): Promise<CellResult> {
  if (!Number.isInteger(minutes) || minutes <= 0 || minutes > MAX_MINUTES) {
    return { ok: false, reason: "duration" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("time_entries")
    .update({ duration_minutes: minutes, description: description?.trim() || null })
    .eq("id", id);

  // The trigger refuses an entry that an issued invoice has locked.
  if (error) return { ok: false, reason: error.message };

  revalidatePath("/");
  return { ok: true };
}

export async function deleteTimeEntry(id: string): Promise<CellResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/");
  return { ok: true };
}

/** "Logging on a paused or done project offers to reactivate it" (PRD section 5). */
export async function reactivateProject(projectId: string): Promise<CellResult> {
  const supabase = await createClient();
  const status: ProjectStatus = "active";
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
