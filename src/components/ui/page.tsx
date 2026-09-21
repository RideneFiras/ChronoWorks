import { cn } from "@/lib/cn";

/** DESIGN.md section 4: title on the left, one primary action on the right. */
export function PageHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 pb-6">
      <div className="flex items-center gap-4">
        <h1 className="font-display text-title font-semibold text-ink">{title}</h1>
        {children}
      </div>
      {action}
    </header>
  );
}

export function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-t border-line pt-6", className)}>
      <h2 className="text-section font-semibold text-ink">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-[68ch] text-meta text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** DESIGN.md section 5: one sentence plus one action. No illustration. */
export function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 border border-line rounded-panel bg-panel p-6">
      <p className="text-body text-ink-muted">{message}</p>
      {action}
    </div>
  );
}
