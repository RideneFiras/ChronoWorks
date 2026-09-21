import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";
import { requireSession } from "@/lib/profile";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const { profile } = await requireSession();

  return (
    <>
      <PageHeader title={t("title")} />
      <SettingsForm profile={profile} />
    </>
  );
}
