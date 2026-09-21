import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";

// Replaced by the Week grid in milestone 3 (PRD section 11, DESIGN.md section 6).
export default async function WeekPage() {
  const t = await getTranslations("nav");
  const tw = await getTranslations("week");

  return (
    <>
      <PageHeader title={t("week")} />
      <p className="max-w-[68ch] text-body text-ink-muted">{tw("building")}</p>
    </>
  );
}
