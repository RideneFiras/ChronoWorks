"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Pause, Play } from "lucide-react";
import { addTimeEntry } from "@/app/(app)/time-actions";
import { todayColumn } from "@/lib/week";

/**
 * DESIGN.md section 6. A 28px ring, always visible.
 *  - stopped: 1.5px --line ring with a play glyph
 *  - running: 1.5px --time ring filling clockwise over each hour, elapsed time
 *    in tabular figures, project name beside it
 * No numerals, no tick marks, no glow. Stopping writes an entry into the Week
 * grid.
 *
 * The running timer lives in localStorage, so it survives a reload but stays on
 * this browser. PRD section 6 lists no table for it and we did not invent one.
 */
const KEY = "chrono.timer";

interface Running {
  projectId: string;
  projectName: string;
  startedAt: number;
}

// A tiny store so the value can be read with useSyncExternalStore: reading
// localStorage straight from render, or setting state inside an effect, are
// both wrong in React 19.
const listeners = new Set<() => void>();
let cached: Running | null = null;
let loaded = false;

function readStorage(): Running | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Running;
    if (!parsed?.projectId || typeof parsed.startedAt !== "number") return null;
    return parsed;
  } catch {
    // private window, or storage blocked: the timer simply does not persist
    return null;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      cached = readStorage();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Running | null {
  if (!loaded) {
    cached = readStorage();
    loaded = true;
  }
  return cached;
}

function getServerSnapshot(): Running | null {
  return null;
}

function setRunning(value: Running | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    // ignored, as above
  }
  cached = value;
  loaded = true;
  listeners.forEach((l) => l());
}

export function Timer({
  projects,
}: {
  projects: { id: string; name: string; clientName: string }[];
}) {
  const t = useTranslations("timer");
  const router = useRouter();
  const running = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The clock ticks into state; elapsed is derived during render, so nothing
  // calls setState from inside an effect body.
  const [now, setNow] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    const id = window.setTimeout(apply, 0);
    media.addEventListener("change", apply);
    return () => {
      window.clearTimeout(id);
      media.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    // first tick out of band, so it is not a synchronous effect update
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [running]);

  const elapsed =
    running && now ? Math.max(0, Math.floor((now - running.startedAt) / 1000)) : 0;

  function stop() {
    if (!running) return;
    const minutes = Math.max(1, Math.round((Date.now() - running.startedAt) / 60000));
    const projectId = running.projectId;
    setRunning(null);
    start(async () => {
      await addTimeEntry(projectId, todayColumn(), minutes, null);
      router.refresh();
    });
  }

  if (!running) {
    return (
      <div className="relative flex items-center gap-3">
        {/* The dial alone says nothing to someone opening Chrono for the
            first time, so the verb sits next to it until a timer is running. */}
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-expanded={picking}
          className="flex items-center gap-2 rounded-control py-1 pe-2 text-meta text-ink-muted hover:text-brass"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-[1.5px] border-line">
            <Play size={12} strokeWidth={1.5} />
          </span>
          {t("start")}
        </button>

        {picking ? (
          <div className="absolute end-0 top-9 z-50 w-[280px] rounded-panel border border-line bg-raised p-3">
            <p className="mb-2 text-meta text-ink-muted">{t("chooseProject")}</p>
            <ul className="flex max-h-[240px] flex-col overflow-y-auto">
              {projects.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRunning({
                        projectId: p.id,
                        projectName: p.name,
                        startedAt: Date.now(),
                      });
                      setPicking(false);
                    }}
                    className="w-full rounded-control px-2 py-2 text-start text-body text-ink hover:bg-panel"
                  >
                    {p.clientName} / {p.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const label = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Fraction of the current hour, so the ring fills once per hour.
  // With reduced motion it steps rather than moving smoothly (DESIGN.md 7).
  const rawFraction = (elapsed % 3600) / 3600;
  const fraction = reducedMotion ? Math.round(rawFraction * 12) / 12 : rawFraction;
  const radius = 12;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={stop}
        aria-label={t("stop")}
        className="relative flex h-7 w-7 items-center justify-center rounded-full text-time"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          className="absolute inset-0"
          aria-hidden="true"
        >
          <circle cx="14" cy="14" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="1.5" />
          <circle
            cx="14"
            cy="14"
            r={radius}
            fill="none"
            stroke="var(--color-time)"
            strokeWidth="1.5"
            strokeDasharray={`${fraction * circumference} ${circumference}`}
            transform="rotate(-90 14 14)"
          />
        </svg>
        <Pause size={11} strokeWidth={1.5} />
      </button>
      <span className="text-body tabular text-time">{label}</span>
      <span className="hidden text-meta text-ink-muted sm:inline">{running.projectName}</span>
    </div>
  );
}
