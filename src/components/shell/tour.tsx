"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The first-run walkthrough. It points at real parts of the shell rather than
 * describing them, and it starts in Settings because the legal name and tax
 * identifier are copied onto every invoice at issue time.
 *
 * Steps are anchored with data-tour attributes. A step that lives on another
 * screen navigates there first, so the thing being pointed at is always on
 * the page.
 *
 * Whether it has been seen is kept in localStorage against the account id.
 * That is per browser: storing it on the profile would need a migration, and
 * the schema is not ours to change without asking.
 */
const KEY = "chrono.tour.seen";

interface Step {
  /** Matches a data-tour attribute in the shell, and names the copy keys. */
  anchor: string;
  path: string;
  /** Which side of the anchor the card sits on. */
  place: "end" | "bottom";
}

// Module level, so the array identity never changes between renders. The copy
// is looked up at render time instead of being baked in here.
const STEPS: Step[] = [
  { anchor: "settings", path: "/settings", place: "end" },
  { anchor: "clients", path: "/clients", place: "end" },
  { anchor: "projects", path: "/projects", place: "end" },
  { anchor: "week", path: "/", place: "end" },
  { anchor: "timer", path: "/", place: "bottom" },
  { anchor: "invoices", path: "/invoices", place: "end" },
];

export function Tour({ userId, isNewAccount }: { userId: string; isNewAccount: boolean }) {
  const t = useTranslations("tour");
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const step = STEPS[index];
  const anchor = step?.anchor ?? "";
  const seenKey = `${KEY}.${userId}`;

  // Starting the walkthrough has to take you to the first step's screen too,
  // not just point at the sidebar: step one says to start in Settings.
  const openAt = useCallback(
    (next: number) => {
      setIndex(next);
      setOpen(true);
      if (STEPS[next].path !== window.location.pathname) router.push(STEPS[next].path);
    },
    [router],
  );

  // Opened out of band so nothing sets state straight inside an effect body.
  useEffect(() => {
    if (!isNewAccount) return;
    let seen = true;
    try {
      seen = localStorage.getItem(seenKey) === "1";
    } catch {
      seen = false;
    }
    if (seen) return;
    const id = window.setTimeout(() => openAt(0), 0);
    return () => window.clearTimeout(id);
  }, [isNewAccount, seenKey, openAt]);

  // Listen for the restart link in Settings.
  useEffect(() => {
    const restart = () => openAt(0);
    window.addEventListener("chrono:tour", restart);
    return () => window.removeEventListener("chrono:tour", restart);
  }, [openAt]);

  const measure = useCallback(() => {
    if (!open) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, measure, pathname]);

  const finish = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(seenKey, "1");
    } catch {
      // private window: the walkthrough simply shows again next time
    }
  }, [seenKey]);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= STEPS.length) return finish();
      setIndex(next);
      if (STEPS[next].path !== pathname) router.push(STEPS[next].path);
    },
    [finish, pathname, router],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight" || e.key === "Enter") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, finish, go]);

  if (!open || !step) return null;

  const gap = 12;
  const cardWidth = 320;
  const top = rect
    ? step.place === "bottom"
      ? Math.min(rect.bottom + gap, window.innerHeight - 200)
      : Math.max(12, Math.min(rect.top - 8, window.innerHeight - 220))
    : 120;
  const left = rect
    ? step.place === "bottom"
      ? Math.max(12, Math.min(rect.right - cardWidth, window.innerWidth - cardWidth - 12))
      : Math.min(rect.right + gap, window.innerWidth - cardWidth - 12)
    : 120;

  return (
    <>
      {/* Dims the page without hiding it, and a click anywhere moves on. */}
      <div
        className="fixed inset-0 z-[70] bg-night/60"
        onClick={() => go(index + 1)}
        aria-hidden="true"
      />

      {/* A brass outline around whatever the step is pointing at. */}
      {rect ? (
        <div
          className="pointer-events-none fixed z-[71] rounded-control border-2 border-brass"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
          aria-hidden="true"
        />
      ) : null}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={t(`${anchor}Title`)}
        className={cn(
          "fixed z-[72] w-[320px] rounded-panel border border-line bg-raised p-4",
        )}
        style={{ top, left }}
      >
        <p className="text-meta text-ink-muted">
          {t("step", { current: index + 1, total: STEPS.length })}
        </p>
        <h2 className="mt-1 text-section font-semibold text-ink">{t(`${anchor}Title`)}</h2>
        <p className="mt-2 text-body text-ink-muted">{t(`${anchor}Body`)}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-meta text-ink-muted hover:text-ink"
          >
            {t("skip")}
          </button>

          <div className="flex items-center gap-2">
            {index > 0 ? (
              <Button onClick={() => go(index - 1)}>{t("back")}</Button>
            ) : null}
            <Button variant="primary" onClick={() => go(index + 1)} autoFocus>
              {index === STEPS.length - 1 ? t("done") : t("next")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
