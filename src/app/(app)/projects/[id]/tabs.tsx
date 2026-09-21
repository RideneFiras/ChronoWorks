"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/** PRD section 8: Overview, Time, Board, Invoices. */
export function ProjectTabs({ projectId }: { projectId: string }) {
  const t = useTranslations("projects");
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  const tabs = [
    { href: base, label: t("overview") },
    { href: `${base}/time`, label: t("time") },
    { href: `${base}/board`, label: t("board") },
    { href: `${base}/invoices`, label: t("invoices") },
  ];

  return (
    <nav className="mb-6 flex gap-1 border-b border-line" aria-label={t("title")}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-body",
              active
                ? "border-b-brass text-ink font-medium"
                : "border-b-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
