"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AccountResult {
  ok: boolean;
  reason?: string;
}

const BUCKETS = ["invoices", "logos"] as const;

/**
 * Everything the account holds, as JSON (PRD section 10, GDPR export).
 * Read through the signed-in client, so RLS decides what comes out: the export
 * can never contain another user's rows.
 */
export async function exportAccount(): Promise<
  { ok: true; json: string } | { ok: false; reason: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  const tables = [
    "profiles",
    "clients",
    "projects",
    "project_status_history",
    "boards",
    "board_columns",
    "tasks",
    "time_entries",
    "leaves",
    "invoices",
    "invoice_lines",
    "invoice_counters",
  ] as const;

  const payload: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    account: { id: user.id, email: user.email },
  };

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { ok: false, reason: error.message };
    payload[table] = data ?? [];
  }

  return { ok: true, json: JSON.stringify(payload, null, 2) };
}

/**
 * Erases the account. The stored files go first, through the Storage API:
 * Postgres refuses a direct delete from storage.objects, so deleting the user
 * would otherwise leave the PDFs and logos orphaned in the bucket.
 *
 * delete_account() then removes the auth user, and the cascade takes every
 * row with it. It lifts the invoice lock for that one transaction, which is
 * the only thing in the system allowed to.
 */
export async function deleteAccount(confirmation: string): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  // The typed word is checked again here: the dialog is client code.
  if (!["DELETE", "SUPPRIMER"].includes(confirmation.trim().toUpperCase())) {
    return { ok: false, reason: "confirmation" };
  }

  for (const bucket of BUCKETS) {
    const { data: files } = await supabase.storage.from(bucket).list(user.id);
    const paths = (files ?? []).map((f) => `${user.id}/${f.name}`);
    if (paths.length > 0) {
      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) return { ok: false, reason: error.message };
    }
  }

  const { error } = await supabase.rpc("delete_account");
  if (error) return { ok: false, reason: error.message };

  await supabase.auth.signOut();
  redirect("/sign-in");
}

/** Records the uploaded logo on the profile. The file itself is uploaded from
 *  the browser; the storage policy is what keeps it under {user_id}/. */
export async function setLogoPath(path: string): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  // Re-check the prefix here: the path came from client code.
  if (!path.startsWith(`${user.id}/`)) return { ok: false, reason: "path" };

  const { error } = await supabase.from("profiles").update({ logo_path: path }).eq("id", user.id);
  if (error) return { ok: false, reason: error.message };

  revalidatePath("/settings");
  return { ok: true };
}

export async function clearLogo(): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  const { data: files } = await supabase.storage.from("logos").list(user.id);
  const paths = (files ?? []).map((f) => `${user.id}/${f.name}`);
  if (paths.length > 0) await supabase.storage.from("logos").remove(paths);

  const { error } = await supabase.from("profiles").update({ logo_path: null }).eq("id", user.id);
  if (error) return { ok: false, reason: error.message };

  revalidatePath("/settings");
  return { ok: true };
}
