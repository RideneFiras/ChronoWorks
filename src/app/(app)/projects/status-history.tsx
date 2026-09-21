import { getTranslations } from "next-intl/server";
import { StatusPill } from "@/components/ui/status-pill";
import { formatDateLong } from "@/lib/format";
import type { AppLocale, ProjectStatus, ProjectStatusHistoryRow } from "@/lib/database.types";

const tone = { active: "active", paused: "paused", done: "done" } as const;

/**
 * A history row says when a status started. A period ends where the next row
 * begins, which is what turns "paused on 3 March" into "paused from 3 March to
 * 12 May" (PRD section 5).
 */
export interface StatusPeriod {
  status: ProjectStatus;
  from: string;
  to: string | null;
  note: string | null;
}

export function toPeriods(rows: ProjectStatusHistoryRow[]): StatusPeriod[] {
  const ordered = [...rows].sort((a, b) =>
    a.changed_on === b.changed_on
      ? a.created_at.localeCompare(b.created_at)
      : a.changed_on.localeCompare(b.changed_on),
  );

  return ordered.map((row, i) => ({
    status: row.status,
    from: row.changed_on,
    to: ordered[i + 1]?.changed_on ?? null,
    note: row.note,
  }));
}

export async function StatusHistory({
  rows,
  locale,
}: {
  rows: ProjectStatusHistoryRow[];
  locale: AppLocale;
}) {
  const t = await getTranslations("projects");

  if (rows.length === 0) {
    return <p className="text-body text-ink-muted">{t("noHistory")}</p>;
  }

  const periods = toPeriods(rows).reverse();
  const label: Record<ProjectStatus, string> = {
    active: t("statusActive"),
    paused: t("statusPaused"),
    done: t("statusDone"),
  };

  return (
    <ol className="flex flex-col">
      {periods.map((p, i) => (
        <li
          key={`${p.from}-${i}`}
          className="flex flex-wrap items-baseline gap-3 border-b border-line py-3 last:border-b-0"
        >
          <StatusPill tone={tone[p.status]} label={label[p.status]} />
          <span className="text-body text-ink">
            {p.to
              ? t("periodBetween", {
                  from: formatDateLong(p.from, locale),
                  to: formatDateLong(p.to, locale),
                })
              : t("periodSince", { from: formatDateLong(p.from, locale) })}
          </span>
          {p.note ? <span className="text-meta text-ink-muted">{p.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}
