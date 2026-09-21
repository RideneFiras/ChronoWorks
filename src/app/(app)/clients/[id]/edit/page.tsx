import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ClientForm } from "../../client-form";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("clients");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();

  return (
    <>
      <PageHeader title={t("edit")} />
      <ClientForm client={client} defaultCurrency={profile.default_currency} />
    </>
  );
}
