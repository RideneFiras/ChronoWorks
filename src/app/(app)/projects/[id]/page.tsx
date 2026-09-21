import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Section } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDate } from "@/lib/format";
import { formatColumn } from "@/lib/money";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus, RateType } from "@/lib/database.types";
import { ChangeStatus } from "../change-status";
import { StatusHistory } from "../status-history";

const tone = { active: "active", paused: "paused", done: "done" } as const;

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("projects");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: client }, { data: history }] = await Promise.all([
    supabase.from("clients").select("id, name").eq("id", project.client_id).maybeSingle(),
    supabase.from("project_status_history").select("*").eq("project_id", id),
  ]);

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
        action={<ButtonLink href={`/projects/${id}/edit`}>{t("edit")}</ButtonLink>}
      >
        <StatusPill tone={tone[project.status]} label={statusLabel[project.status]} />
      </PageHeader>

      <dl className="mb-8 grid gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-meta text-ink-muted">{t("client")}</dt>
          <dd className="mt-1 text-body">
            <Link href={`/clients/${project.client_id}`} className="text-ink hover:text-brass">
              {client?.name ?? "—"}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("rateType")}</dt>
          <dd className="mt-1 text-body tabular font-medium text-ink">
            {formatColumn(project.rate_amount, project.currency, profile.locale)}{" "}
            <span className="font-normal text-ink-muted">{rateLabel[project.rate_type]}</span>
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("startDate")}</dt>
          <dd className="mt-1 text-body text-ink">
            {formatDate(project.start_date, profile.locale)}
          </dd>
        </div>
        <div>
          <dt className="text-meta text-ink-muted">{t("endDate")}</dt>
          <dd className="mt-1 text-body text-ink">
            {formatDate(project.end_date, profile.locale)}
          </dd>
        </div>
        {project.description ? (
          <div className="sm:col-span-4">
            <dt className="text-meta text-ink-muted">{t("description")}</dt>
            <dd className="mt-1 max-w-[68ch] whitespace-pre-line text-body text-ink">
              {project.description}
            </dd>
          </div>
        ) : null}
      </dl>

      <Section title={t("changeStatus")} className="mb-8">
        <ChangeStatus id={project.id} status={project.status} />
      </Section>

      <Section title={t("history")}>
        <StatusHistory rows={history ?? []} locale={profile.locale} />
      </Section>
    </>
  );
}
