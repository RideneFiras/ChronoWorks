"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { parseAmount, toColumn } from "@/lib/money";
import type { Currency, ProjectStatus, RateType } from "@/lib/database.types";
import type { FormState } from "@/lib/form-state";


const CURRENCIES: Currency[] = ["TND", "EUR", "USD"];
const RATE_TYPES: RateType[] = ["daily", "hourly", "fixed"];
const STATUSES: ProjectStatus[] = ["active", "paused", "done"];

function optional(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function oneOf<T extends string>(form: FormData, name: string, allowed: T[], fallback: T): T {
  const value = form.get(name);
  return typeof value === "string" && (allowed as string[]).includes(value)
    ? (value as T)
    : fallback;
}

async function readForm(form: FormData) {
  const t = await getTranslations("errors");
  const errors: Record<string, string> = {};

  const name = optional(form, "name");
  if (!name) errors.name = t("nameRequired");

  const clientId = optional(form, "client_id");
  if (!clientId) errors.client_id = t("clientRequired");

  // Money never becomes a float: parsed to scaled bigint, back to a decimal
  // string for the numeric column.
  const rateRaw = (form.get("rate_amount") as string | null) ?? "0";
  const rate = parseAmount(rateRaw === "" ? "0" : rateRaw);
  if (rate === null || rate < 0n) errors.rate_amount = t("rateRequired");

  const startDate = optional(form, "start_date");
  const endDate = optional(form, "end_date");
  if (startDate && endDate && endDate < startDate) {
    errors.end_date = t("endBeforeStart");
  }

  return {
    errors,
    values: {
      name: name ?? "",
      client_id: clientId ?? "",
      description: optional(form, "description"),
      rate_type: oneOf<RateType>(form, "rate_type", RATE_TYPES, "daily"),
      rate_amount: toColumn(rate ?? 0n),
      currency: oneOf<Currency>(form, "currency", CURRENCIES, "EUR"),
      start_date: startDate,
      end_date: endDate,
    },
  };
}

export async function createProject(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const t = await getTranslations("errors");
  const { errors, values } = await readForm(form);
  if (Object.keys(errors).length > 0) return { status: "error", errors };

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert(values).select("id").single();

  if (error || !data) {
    return {
      status: "error",
      errors: {},
      message: t("saveFailed", { reason: error?.message ?? "" }),
    };
  }

  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

export async function updateProject(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const t = await getTranslations("errors");
  const id = form.get("id");
  if (typeof id !== "string") return { status: "error", errors: {}, message: t("notFound") };

  const { errors, values } = await readForm(form);
  if (Object.keys(errors).length > 0) return { status: "error", errors };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(values).eq("id", id);

  if (error) {
    return { status: "error", errors: {}, message: t("saveFailed", { reason: error.message }) };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect(`/projects/${id}`);
}

/**
 * The status change itself writes a history row through a trigger, which is
 * what guarantees the history exists. The trigger cannot know the user's note,
 * so we attach it to the row the trigger just wrote.
 */
export async function changeProjectStatus(
  id: string,
  status: ProjectStatus,
  note: string | null,
) {
  // A server action's arguments arrive from the client, so re-check them here
  // (PRD section 10). The enum in Postgres is the final guard.
  if (!STATUSES.includes(status)) return;

  const supabase = await createClient();

  const { error } = await supabase.from("projects").update({ status }).eq("id", id);
  if (error) return;

  if (note && note.trim() !== "") {
    const { data: latest } = await supabase
      .from("project_status_history")
      .select("id")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      await supabase
        .from("project_status_history")
        .update({ note: note.trim() })
        .eq("id", latest.id);
    }
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
}
