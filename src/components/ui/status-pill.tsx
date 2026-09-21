import { Pause } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * DESIGN.md section 5. Always carries the word, never colour alone.
 * Paused goes cool and still with a pause glyph: time has stopped.
 */
export type PillTone =
  | "active"
  | "paused"
  | "done"
  | "draft"
  | "issued"
  | "paid"
  | "overdue"
  | "dueSoon"
  | "cancelled";

const tones: Record<PillTone, string> = {
  active: "bg-green-tint text-green",
  paused: "bg-raised text-ink-muted",
  done: "bg-night text-ink-muted",
  draft: "bg-night text-ink-muted",
  issued: "bg-brass-tint text-brass",
  paid: "bg-green-tint text-green",
  overdue: "bg-red-tint text-red",
  dueSoon: "bg-amber-tint text-amber",
  cancelled: "bg-night text-ink-muted",
};

export function StatusPill({
  tone,
  label,
  className,
}: {
  tone: PillTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-meta font-medium",
        tones[tone],
        className,
      )}
    >
      {tone === "paused" ? <Pause size={12} strokeWidth={1.5} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
