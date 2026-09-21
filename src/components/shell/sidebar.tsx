"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Briefcase,
  CalendarDays,
  FileText,
  LogOut,
  Menu,
  Settings,
  TreePalm,
  Users,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";

const items = [
  { href: "/", key: "week", Icon: CalendarDays },
  { href: "/projects", key: "projects", Icon: Briefcase },
  { href: "/clients", key: "clients", Icon: Users },
  { href: "/invoices", key: "invoices", Icon: FileText },
  { href: "/leave", key: "leave", Icon: TreePalm },
  { href: "/settings", key: "settings", Icon: Settings },
] as const;

export function Sidebar({ displayName }: { displayName: string }) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-1" aria-label={t("menu")}>
      {items.map(({ href, key, Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
            className={cn(
              "flex h-8 items-center gap-3 rounded-control px-3 text-body",
              active
                ? "bg-brass-tint text-ink font-medium"
                : "text-ink-muted hover:bg-raised hover:text-ink",
            )}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
      <p className="px-3 text-meta text-ink-muted">{t("signedInAs", { name: displayName })}</p>
      <form action="/auth/sign-out" method="post">
        <button
          type="submit"
          className="flex h-8 w-full items-center gap-3 rounded-control px-3 text-body text-ink-muted hover:bg-raised hover:text-ink"
        >
          <LogOut size={16} strokeWidth={1.5} aria-hidden="true" />
          {tAuth("signOut")}
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* 375px and up to md: a top bar with a menu. DESIGN.md section 10. */}
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3 md:hidden">
        <Wordmark />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="chrono-nav"
          className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-raised hover:text-ink"
        >
          {open ? <X size={16} strokeWidth={1.5} /> : <Menu size={16} strokeWidth={1.5} />}
          <span className="sr-only">{t("menu")}</span>
        </button>
      </div>

      {open ? (
        <div id="chrono-nav" className="flex flex-col gap-4 border-b border-line bg-panel p-4 md:hidden">
          {nav}
          {footer}
        </div>
      ) : null}

      <aside className="hidden w-56 shrink-0 flex-col gap-6 border-e border-line bg-panel p-4 md:sticky md:top-0 md:flex md:h-screen">
        <Wordmark />
        {nav}
        {footer}
      </aside>
    </>
  );
}
