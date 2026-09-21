"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { AppLocale, Currency } from "@/lib/database.types";
import type { FormState } from "@/lib/form-state";
import { isCountry } from "@/lib/countries";


const CURRENCIES: Currency[] = ["TND", "EUR", "USD"];
const LOCALES: AppLocale[] = ["fr", "en"];

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

  return {
    errors,
    values: {
      name: name ?? "",
      email: optional(form, "email"),
      address: optional(form, "address"),
      // only a known ISO code is stored: the invoice mentions compare it
      country: (() => {
        const value = optional(form, "country");
        return isCountry(value) ? value : null;
      })(),
      tax_id: optional(form, "tax_id"),
      vat_number: optional(form, "vat_number"),
      notes: optional(form, "notes"),
      currency: oneOf<Currency>(form, "currency", CURRENCIES, "EUR"),
      invoice_language: oneOf<AppLocale>(form, "invoice_language", LOCALES, "fr"),
    },
  };
}

export async function createClientRecord(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const t = await getTranslations("errors");
  const { errors, values } = await readForm(form);
  if (Object.keys(errors).length > 0) return { status: "error", errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert(values)
    .select("id")
    .single();

  if (error || !data) {
    return {
      status: "error",
      errors: {},
      message: t("saveFailed", { reason: error?.message ?? "" }),
    };
  }

  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClientRecord(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const t = await getTranslations("errors");
  const id = form.get("id");
  if (typeof id !== "string") return { status: "error", errors: {}, message: t("notFound") };

  const { errors, values } = await readForm(form);
  if (Object.keys(errors).length > 0) return { status: "error", errors };

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(values).eq("id", id);

  if (error) {
    return { status: "error", errors: {}, message: t("saveFailed", { reason: error.message }) };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}?saved=1`);
}

/** Archiving keeps the client on past invoices but hides it from the lists. */
export async function setClientArchived(id: string, archived: boolean) {
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);

  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
}
