import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/ui/page";
import { hoursPerDayFrom } from "@/lib/duration";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { BoardView } from "../board-view";
import { ProjectHeader } from "../project-header";

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("tasks");
  const { profile } = await requireSession();

  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const { data: board } = await supabase
    .from("boards")
    .select("id")
    .eq("project_id", id)
    .maybeSingle();

  if (!board) {
    return (
      <>
        <ProjectHeader project={project} locale={profile.locale} />
        <EmptyState message={t("boardEmpty")} />
      </>
    );
  }

  const [{ data: columns }, { data: tasks }] = await Promise.all([
    supabase.from("board_columns").select("*").eq("board_id", board.id).order("position"),
    supabase.from("tasks").select("*").eq("project_id", id).order("position"),
  ]);

  return (
    <>
      <ProjectHeader project={project} locale={profile.locale} />
      <BoardView
        projectId={id}
        boardId={board.id}
        columns={columns ?? []}
        tasks={tasks ?? []}
        hoursPerDay={hoursPerDayFrom(profile.hours_per_day)}
        locale={profile.locale}
      />
    </>
  );
}
