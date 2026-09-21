import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";
import { requireSession } from "@/lib/profile";
import { ClientForm } from "../client-form";

export default async function NewClientPage() {
  const t = await getTranslations("clients");
  const { profile } = await requireSession();

  return (
    <>
      <PageHeader title={t("new")} />
      <ClientForm defaultCurrency={profile.default_currency} />
    </>
  );
}
