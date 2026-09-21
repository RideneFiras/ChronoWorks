import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";

export default async function WeekPage() {
  const t = await getTranslations("nav");

  return (
    <>
      <PageHeader title={t("week")} />
      <p className="text-body text-ink-muted">
        The Week grid arrives in milestone 3.
      </p>
    </>
  );
}
