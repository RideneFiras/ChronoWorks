import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { formatColumn } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { AppLocale, ProjectRow, ProjectStatus, RateType } from "@/lib/database.types";
import { ProjectTabs } from "./tabs";

const tone = { active: "active", paused: "paused", done: "done" } as const;

/** PRD section 8: the header shows client, status and rate on every tab. */
export async function ProjectHeader({
  project,
  locale,
}: {
  project: ProjectRow;
  locale: AppLocale;
}) {
  const t = await getTranslations("projects");
  const supabase = await createClient();
  const { data: client } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", project.client_id)
    .maybeSingle();

  const statusLabel: Record<ProjectStatus, string> = {
    active: t("statusActive"),
    paused: t("statusPaused"),
    done: t("statusDone"),
  };
  const rateLabel: Record<RateType, string> = {
    daily: t("perDay"),
    hourly: t("perHour"),
    fixed: t("fixed"),
  };

  return (
    <>
      <PageHeader
        title={project.name}
        action={<ButtonLink href={`/projects/${project.id}/edit`}>{t("edit")}</ButtonLink>}
      >
        <StatusPill tone={tone[project.status]} label={statusLabel[project.status]} />
      </PageHeader>

      <p className="mb-6 flex flex-wrap items-center gap-4 text-body text-ink-muted">
        <Link href={`/clients/${project.client_id}`} className="text-ink hover:text-brass">
          {client?.name ?? "—"}
        </Link>
        <span className="tabular">
          {formatColumn(project.rate_amount, project.currency, locale)}{" "}
          {rateLabel[project.rate_type]}
        </span>
      </p>

      <ProjectTabs projectId={project.id} />
    </>
  );
}
