"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/i18n/locale";
import { createClient } from "@/lib/supabase/server";
import type { Currency, TaxProfile } from "@/lib/database.types";
import type { FormState } from "@/lib/form-state";


const CURRENCIES: Currency[] = ["TND", "EUR", "USD"];
const TAX_PROFILES: TaxProfile[] = ["tn", "fr", "eu_generic"];
const PREFIX = /^[A-Za-z0-9-]{1,12}$/;

/** Trim, and turn an empty box into a NULL rather than an empty string. */
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

export async function saveSettings(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const t = await getTranslations("errors");
  const tCommon = await getTranslations("common");
  const errors: Record<string, string> = {};

  const displayName = optional(form, "display_name");
  if (!displayName) errors.display_name = t("nameRequired");

  const prefix = (optional(form, "invoice_prefix") ?? "").toUpperCase();
  if (!PREFIX.test(prefix)) errors.invoice_prefix = t("prefixFormat");

  const hoursRaw = (form.get("hours_per_day") as string | null)?.trim().replace(",", ".") ?? "";
  const hours = Number(hoursRaw);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
    errors.hours_per_day = t("hoursRange");
  }

  const termsRaw = (form.get("payment_terms_days") as string | null)?.trim() ?? "";
  const terms = Number(termsRaw);
  if (!Number.isInteger(terms) || terms < 0 || terms > 365) {
    errors.payment_terms_days = t("termsRange");
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", errors };
  }

  const locale = oneOf<Locale>(form, "locale", ["fr", "en"], "fr");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", errors: {}, message: t("notSignedIn") };

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      locale,
      country: optional(form, "country"),
      default_currency: oneOf<Currency>(form, "default_currency", CURRENCIES, "EUR"),
      tax_profile: oneOf<TaxProfile>(form, "tax_profile", TAX_PROFILES, "fr"),
      legal_name: optional(form, "legal_name"),
      address: optional(form, "address"),
      tax_id: optional(form, "tax_id"),
      vat_number: optional(form, "vat_number"),
      iban: optional(form, "iban"),
      legal_mentions: optional(form, "legal_mentions"),
      invoice_prefix: prefix,
      payment_terms_days: terms,
      hours_per_day: hoursRaw,
    })
    .eq("id", user.id);

  if (error) {
    return { status: "error", errors: {}, message: t("saveFailed", { reason: error.message }) };
  }

  if (isLocale(locale)) {
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  revalidatePath("/", "layout");
  return { status: "saved", errors: {}, message: tCommon("saved") };
}
