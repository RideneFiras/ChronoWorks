import { cn } from "@/lib/cn";

/**
 * DESIGN.md section 4 and 5. Lists are tables, not grids of cards.
 * Row height 44px, header on --night, rows on --panel, 1px --line between.
 * At narrow widths the table scrolls inside its own container.
 */
export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("scroll-x rounded-panel border border-line", className)}>
      <table className="w-full border-collapse text-body">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-night">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = "start",
  className,
}: {
  children?: React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "h-11 border-b border-line px-3 text-meta font-medium text-ink-muted",
        align === "end" ? "text-end" : "text-start",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({
  children,
  selected,
  className,
}: {
  children: React.ReactNode;
  selected?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line last:border-b-0",
        selected ? "bg-brass-tint" : "bg-panel hover:bg-raised",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = "start",
  numeric,
  className,
}: {
  children?: React.ReactNode;
  align?: "start" | "end";
  /** Numbers are tabular and right-aligned. DESIGN.md section 3. */
  numeric?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "h-11 px-3 text-ink",
        numeric || align === "end" ? "text-end" : "text-start",
        numeric && "tabular font-medium",
        className,
      )}
    >
      {children}
    </td>
  );
}
