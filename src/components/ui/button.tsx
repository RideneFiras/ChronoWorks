import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "destructive" | "quiet";
type Size = "default" | "dialog";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** DESIGN.md section 5. One primary button per view. */
const variants: Record<Variant, string> = {
  primary: "bg-brass text-night hover:bg-brass-tint hover:text-ink border border-brass",
  secondary: "bg-panel text-ink border border-line hover:bg-raised",
  destructive: "bg-panel text-red border border-line hover:bg-red-tint",
  quiet: "bg-transparent text-ink-muted border border-transparent hover:text-ink hover:bg-raised",
};

const sizes: Record<Size, string> = {
  default: "h-8 px-3",
  dialog: "h-9 px-4",
};

export function Button({
  variant = "secondary",
  size = "default",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control text-body font-medium",
        "disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}
