import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const t = await getTranslations("projects");
  const tc = await getTranslations("clients");
  const { client } = await searchParams;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name, currency")
    .is("archived_at", null)
    .order("name");

  return (
    <>
      <PageHeader title={t("new")} />
      {(clients ?? []).length === 0 ? (
        <EmptyState
          message={tc("empty")}
          action={
            <ButtonLink href="/clients/new" variant="primary">
              {tc("new")}
            </ButtonLink>
          }
        />
      ) : (
        <ProjectForm clients={clients ?? []} defaultClientId={client} />
      )}
    </>
  );
}
