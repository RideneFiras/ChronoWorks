import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "destructive" | "quiet";
type Size = "default" | "dialog";

/** DESIGN.md section 5. One primary button per view. */
const variants: Record<Variant, string> = {
  primary: "bg-brass text-night border border-brass hover:bg-brass-tint hover:text-ink",
  secondary: "bg-panel text-ink border border-line hover:bg-raised",
  destructive: "bg-panel text-red border border-line hover:bg-red-tint",
  quiet: "bg-transparent text-ink-muted border border-transparent hover:bg-raised hover:text-ink",
};

const sizes: Record<Size, string> = {
  default: "h-8 px-3",
  dialog: "h-9 px-4",
};

export function buttonClasses(
  variant: Variant = "secondary",
  size: Size = "default",
  className?: string,
): string {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-control text-body font-medium",
    "whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "secondary",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

/** A link that looks like a button. Keeps navigation as a real anchor rather
 *  than a button that pushes a route. */
export function ButtonLink({
  href,
  variant = "secondary",
  size = "default",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {children}
    </Link>
  );
}
