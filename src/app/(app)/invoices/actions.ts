"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { parseAmount, toColumn } from "@/lib/money";
import { hoursPerDayFrom } from "@/lib/duration";
import type { Currency, InvoiceUnit, TaxProfile } from "@/lib/database.types";

export interface ActionResult {
  ok: boolean;
  reason?: string;
}

const UNITS: InvoiceUnit[] = ["day", "hour", "unit"];

/**
 * Creates a draft for a client and, when asked, turns that client's unbilled
 * time in the period into lines.
 *
 * One line per project: quantity in the project's own unit, unit price copied
 * from the project rate at creation time. PRD section 5 says a later rate
 * change must not alter an existing line, which is exactly what copying buys.
 * The chosen entries get invoice_id set, so the Week grid stops counting them
 * as unbilled and the database locks them once the invoice is issued.
 */
export async function createInvoiceDraft(
  clientId: string,
  from: string | null,
  to: string | null,
  fromTime: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "auth" };

  const [{ data: profile }, { data: client }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
  ]);
  if (!client || !profile) return { ok: false, reason: "client" };

  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + profile.payment_terms_days);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({
      client_id: clientId,
      currency: client.currency as Currency,
      language: client.invoice_language,
      tax_profile: profile.tax_profile as TaxProfile,
      issue_date: iso(today),
      due_date: iso(due),
      legal_mentions: profile.legal_mentions,
    })
    .select("id")
    .single();

  if (error || !invoice) return { ok: false, reason: error?.message };

  if (fromTime && from && to) {
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name, rate_type, rate_amount")
      .eq("client_id", clientId);

    const { data: entries } = await supabase
      .from("time_entries")
      .select("id, project_id, duration_minutes")
      .is("invoice_id", null)
      .eq("is_billable", true)
      .gte("entry_date", from)
      .lte("entry_date", to)
      .in("project_id", (projects ?? []).map((p) => p.id));

    const hoursPerDay = hoursPerDayFrom(profile.hours_per_day);
    const minutesByProject = new Map<string, number>();
    for (const entry of entries ?? []) {
      minutesByProject.set(
        entry.project_id,
        (minutesByProject.get(entry.project_id) ?? 0) + entry.duration_minutes,
      );
    }

    let position = 1;
    for (const project of projects ?? []) {
      const minutes = minutesByProject.get(project.id);
      if (!minutes || project.rate_type === "fixed") continue;

      const unit: InvoiceUnit = project.rate_type === "daily" ? "day" : "hour";
      const divisor = unit === "day" ? hoursPerDay * 60 : 60;
      const quantity = (minutes / divisor).toFixed(3);

      await supabase.from("invoice_lines").insert({
        invoice_id: invoice.id,
        project_id: project.id,
        position: position++,
        description: project.name,
        quantity,
        unit,
        unit_price: project.rate_amount,
        tax_rate: "0",
      });
    }

    const ids = (entries ?? [])
      .filter((e) => minutesByProject.has(e.project_id))
      .map((e) => e.id);
    if (ids.length > 0) {
      await supabase.from("time_entries").update({ invoice_id: invoice.id }).in("id", ids);
    }
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect(`/invoices/${invoice.id}`);
}

export async function addInvoiceLine(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("invoice_lines")
    .select("position")
    .eq("invoice_id", invoiceId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("invoice_lines").insert({
    invoice_id: invoiceId,
    description: "—",
    quantity: "1",
    unit: "unit",
    unit_price: "0",
    tax_rate: "0",
    position: (last?.position ?? 0) + 1,
  });

  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function updateInvoiceLine(
  invoiceId: string,
  lineId: string,
  values: {
    description: string;
    quantity: string;
    unit: string;
    unit_price: string;
    tax_rate: string;
  },
): Promise<ActionResult> {
  const quantity = parseAmount(values.quantity);
  const unitPrice = parseAmount(values.unit_price);
  const taxRate = parseAmount(values.tax_rate, 2);

  if (quantity === null || unitPrice === null || taxRate === null) {
    return { ok: false, reason: "number" };
  }
  if (taxRate < 0n || taxRate > 10000n) return { ok: false, reason: "number" };

  const unit: InvoiceUnit = (UNITS as string[]).includes(values.unit)
    ? (values.unit as InvoiceUnit)
    : "unit";

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_lines")
    .update({
      description: values.description.trim() || "—",
      quantity: toColumn(quantity),
      unit,
      unit_price: toColumn(unitPrice),
      tax_rate: toColumn(taxRate, 2),
    })
    .eq("id", lineId);

  // An issued invoice's lines are frozen by a trigger; surface that message.
  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deleteInvoiceLine(
  invoiceId: string,
  lineId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_lines").delete().eq("id", lineId);
  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function updateInvoiceDraft(
  invoiceId: string,
  values: { stamp_duty: string; withholding: string; notes: string; due_date: string },
): Promise<ActionResult> {
  const stamp = parseAmount(values.stamp_duty || "0");
  const withholding = parseAmount(values.withholding || "0");
  if (stamp === null || withholding === null || stamp < 0n || withholding < 0n) {
    return { ok: false, reason: "number" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({
      stamp_duty: toColumn(stamp),
      withholding: toColumn(withholding),
      notes: values.notes.trim() || null,
      due_date: values.due_date,
    })
    .eq("id", invoiceId);

  if (error) return { ok: false, reason: error.message };
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

/** The only way to issue. Everything that matters happens inside the
 *  SECURITY DEFINER function in 0001_init.sql. */
export async function issueInvoice(invoiceId: string): Promise<ActionResult> {
  const t = await getTranslations("invoices");
  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_invoice", { p_invoice_id: invoiceId });

  if (error) {
    // Say what happened and how to fix it, never a raw constraint name
    // (DESIGN.md section 8).
    if (/invoices_number_unique/.test(error.message)) {
      return { ok: false, reason: t("numberClash") };
    }
    return { ok: false, reason: error.message };
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setInvoiceStatus(
  invoiceId: string,
  status: "sent" | "paid",
): Promise<ActionResult> {
  const supabase = await createClient();
  const stamp = new Date().toISOString();
  const { error } = await supabase
    .from("invoices")
    .update(status === "sent" ? { status, sent_at: stamp } : { status, paid_at: stamp })
    .eq("id", invoiceId);

  if (error) return { ok: false, reason: error.message };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  return { ok: true };
}

export async function deleteDraft(invoiceId: string): Promise<ActionResult> {
  const supabase = await createClient();
  // Release the time first, so the entries go back to being unbilled.
  await supabase.from("time_entries").update({ invoice_id: null }).eq("invoice_id", invoiceId);
  const { error } = await supabase.from("invoices").delete().eq("id", invoiceId);
  if (error) return { ok: false, reason: error.message };

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/invoices");
}
