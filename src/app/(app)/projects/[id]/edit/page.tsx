import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../../project-form";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("projects");

  const supabase = await createClient();
  const [{ data: project }, { data: clients }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    supabase.from("clients").select("id, name, currency").order("name"),
  ]);

  if (!project) notFound();

  return (
    <>
      <PageHeader title={t("edit")} />
      <ProjectForm project={project} clients={clients ?? []} />
    </>
  );
}
