import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PERIODS, type Period } from "@/lib/period";

/** Plain links, so the chosen period survives a reload and can be shared. */
export async function PeriodFilter({
  active,
  basePath,
  extra,
}: {
  active: Period;
  basePath: string;
  /** Query values to keep alongside the period. */
  extra?: Record<string, string | undefined>;
}) {
  const t = await getTranslations("period");

  const href = (period: Period) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extra ?? {})) if (v) params.set(k, v);
    params.set("period", period);
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-meta text-ink-muted">{t("label")}</span>
      {PERIODS.map((period) => (
        <Link
          key={period}
          href={href(period)}
          aria-current={active === period ? "page" : undefined}
          className={
            active === period
              ? "text-meta font-medium text-ink"
              : "text-meta text-ink-muted hover:text-ink"
          }
        >
          {t(period)}
        </Link>
      ))}
    </div>
  );
}
