"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import type { ProfileRow } from "@/lib/database.types";
import { emptyState, saveSettings } from "./actions";

export function SettingsForm({ profile }: { profile: ProfileRow }) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const [state, action, pending] = useActionState(saveSettings, emptyState);

  const taxIdHint =
    profile.tax_profile === "tn"
      ? t("taxIdHintTn")
      : profile.tax_profile === "fr"
        ? t("taxIdHintFr")
        : t("taxIdHintEu");

  return (
    <form action={action} className="flex flex-col gap-8">
      <Section title={t("profileSection")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("displayName")} htmlFor="display_name" error={state.errors.display_name}>
            <Input
              id="display_name"
              name="display_name"
              defaultValue={profile.display_name ?? ""}
              required
              maxLength={120}
              aria-invalid={Boolean(state.errors.display_name)}
            />
          </Field>

          <Field label={t("language")} htmlFor="locale">
            <Select id="locale" name="locale" defaultValue={profile.locale}>
              <option value="fr">{t("languageFr")}</option>
              <option value="en">{t("languageEn")}</option>
            </Select>
          </Field>

          <Field
            label={t("hoursPerDay")}
            htmlFor="hours_per_day"
            help={t("hoursPerDayHelp")}
            error={state.errors.hours_per_day}
          >
            <Input
              id="hours_per_day"
              name="hours_per_day"
              inputMode="decimal"
              defaultValue={profile.hours_per_day}
              aria-invalid={Boolean(state.errors.hours_per_day)}
            />
          </Field>

          <Field label={t("defaultCurrency")} htmlFor="default_currency">
            <Select
              id="default_currency"
              name="default_currency"
              defaultValue={profile.default_currency}
            >
              <option value="TND">TND</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </div>
      </Section>

      <Section title={t("businessSection")} description={t("businessHelp")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("legalName")} htmlFor="legal_name">
            <Input id="legal_name" name="legal_name" defaultValue={profile.legal_name ?? ""} />
          </Field>

          <Field label={t("country")} htmlFor="country">
            <Input id="country" name="country" defaultValue={profile.country ?? ""} />
          </Field>

          <Field label={t("address")} htmlFor="address" className="sm:col-span-2">
            <Textarea id="address" name="address" defaultValue={profile.address ?? ""} rows={3} />
          </Field>
        </div>
      </Section>

      <Section title={t("taxSection")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("taxProfile")} htmlFor="tax_profile" help={t("taxProfileHelp")}>
            <Select id="tax_profile" name="tax_profile" defaultValue={profile.tax_profile}>
              <option value="tn">{t("taxProfileTn")}</option>
              <option value="fr">{t("taxProfileFr")}</option>
              <option value="eu_generic">{t("taxProfileEu")}</option>
            </Select>
          </Field>

          <Field label={t("taxId")} htmlFor="tax_id" help={taxIdHint}>
            <Input id="tax_id" name="tax_id" defaultValue={profile.tax_id ?? ""} />
          </Field>

          <Field label={t("vatNumber")} htmlFor="vat_number">
            <Input id="vat_number" name="vat_number" defaultValue={profile.vat_number ?? ""} />
          </Field>

          <Field label={t("iban")} htmlFor="iban">
            <Input id="iban" name="iban" defaultValue={profile.iban ?? ""} />
          </Field>

          <Field
            label={t("legalMentions")}
            htmlFor="legal_mentions"
            help={t("legalMentionsHelp")}
            className="sm:col-span-2"
          >
            <Textarea
              id="legal_mentions"
              name="legal_mentions"
              defaultValue={profile.legal_mentions ?? ""}
              rows={3}
            />
          </Field>
        </div>
      </Section>

      <Section title={t("numberingSection")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("invoicePrefix")}
            htmlFor="invoice_prefix"
            help={t("invoicePrefixHelp", {
              example: `${profile.invoice_prefix}-${new Date().getFullYear()}-0001`,
            })}
            error={state.errors.invoice_prefix}
          >
            <Input
              id="invoice_prefix"
              name="invoice_prefix"
              defaultValue={profile.invoice_prefix}
              maxLength={12}
              aria-invalid={Boolean(state.errors.invoice_prefix)}
            />
          </Field>

          <Field
            label={t("paymentTerms")}
            htmlFor="payment_terms_days"
            help={t("paymentTermsHelp")}
            error={state.errors.payment_terms_days}
          >
            <Input
              id="payment_terms_days"
              name="payment_terms_days"
              inputMode="numeric"
              defaultValue={profile.payment_terms_days}
              aria-invalid={Boolean(state.errors.payment_terms_days)}
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center gap-4 border-t border-line pt-6">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? tCommon("saving") : tCommon("save")}
        </Button>
        {state.message ? (
          <p
            role="status"
            className={state.status === "saved" ? "text-meta text-time" : "text-meta text-red"}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
