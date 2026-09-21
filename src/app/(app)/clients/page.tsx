import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const t = await getTranslations("clients");
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const supabase = await createClient();
  let query = supabase
    .from("clients")
    .select("id, name, email, country, currency, archived_at")
    .order("name");

  if (!showArchived) query = query.is("archived_at", null);

  // Counted separately rather than with an embedded projects(count): the
  // hand-written Database type declares no relationships, so PostgREST's type
  // parser cannot resolve an embed. RLS scopes both queries to this user.
  const [{ data: clients }, { data: projects }] = await Promise.all([
    query,
    supabase.from("projects").select("client_id"),
  ]);

  const projectCount = new Map<string, number>();
  for (const p of projects ?? []) {
    projectCount.set(p.client_id, (projectCount.get(p.client_id) ?? 0) + 1);
  }

  const rows = clients ?? [];

  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          <ButtonLink href="/clients/new" variant="primary">
            {t("new")}
          </ButtonLink>
        }
      />

      <div className="mb-4">
        <Link
          href={showArchived ? "/clients" : "/clients?archived=1"}
          className="text-meta text-ink-muted hover:text-ink"
        >
          {showArchived ? t("hideArchived") : t("showArchived")}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          message={t("empty")}
          action={
            <ButtonLink href="/clients/new" variant="primary">
              {t("new")}
            </ButtonLink>
          }
        />
      ) : (
        <Table>
          <THead>
            <TH>{t("name")}</TH>
            <TH>{t("email")}</TH>
            <TH>{t("country")}</TH>
            <TH>{t("currency")}</TH>
            <TH align="end">{t("projects")}</TH>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id}>
                <TD>
                  <Link href={`/clients/${row.id}`} className="text-ink hover:text-brass">
                    {row.name}
                  </Link>
                  {row.archived_at ? (
                    <StatusPill tone="done" label={t("archived")} className="ms-2" />
                  ) : null}
                </TD>
                <TD className="text-ink-muted">{row.email ?? "—"}</TD>
                <TD className="text-ink-muted">{row.country ?? "—"}</TD>
                <TD className="text-ink-muted">{row.currency}</TD>
                <TD numeric>{projectCount.get(row.id) ?? 0}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </>
  );
}
