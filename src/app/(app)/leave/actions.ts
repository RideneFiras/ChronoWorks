"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import type { LeaveType } from "@/lib/database.types";
import type { FormState } from "@/lib/form-state";


const TYPES: LeaveType[] = ["vacation", "sick", "other", "public_holiday"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function read(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export async function saveLeave(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const t = await getTranslations("errors");
  const errors: Record<string, string> = {};

  const startDate = read(form, "start_date");
  const endDate = read(form, "end_date");

  if (!startDate || !DATE.test(startDate)) errors.start_date = t("nameRequired");
  if (!endDate || !DATE.test(endDate)) errors.end_date = t("nameRequired");
  if (startDate && endDate && endDate < startDate) errors.end_date = t("endBeforeStart");

  if (Object.keys(errors).length > 0) return { status: "error", errors };

  const typeValue = form.get("type");
  const type: LeaveType =
    typeof typeValue === "string" && (TYPES as string[]).includes(typeValue)
      ? (typeValue as LeaveType)
      : "vacation";

  const values = {
    type,
    start_date: startDate!,
    end_date: endDate!,
    start_half: form.get("start_half") === "on",
    end_half: form.get("end_half") === "on",
    note: read(form, "note"),
  };

  const supabase = await createClient();
  const id = form.get("id");

  const { error } =
    typeof id === "string" && id !== ""
      ? await supabase.from("leaves").update(values).eq("id", id)
      : await supabase.from("leaves").insert(values);

  if (error) {
    return { status: "error", errors: {}, message: t("saveFailed", { reason: error.message }) };
  }

  // Leave changes the hatching in the Week grid, so refresh that too.
  revalidatePath("/leave");
  revalidatePath("/");
  return { status: "saved", errors: {} };
}

export async function deleteLeave(id: string) {
  const supabase = await createClient();
  await supabase.from("leaves").delete().eq("id", id);
  revalidatePath("/leave");
  revalidatePath("/");
}
