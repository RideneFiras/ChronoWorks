import { cn } from "@/lib/cn";

/** DESIGN.md section 5: label above, 12px; error below in red, saying what is
 *  wrong and how to fix it. */
export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const describedBy = [help && `${htmlFor}-help`, error && `${htmlFor}-error`]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-meta text-ink">
        {label}
      </label>
      <div data-described-by={describedBy || undefined}>{children}</div>
      {help ? (
        <p id={`${htmlFor}-help`} className="text-meta text-ink-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-meta text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "h-9 w-full rounded-control border border-line bg-night px-3 text-body text-ink";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "pe-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, "h-auto min-h-[76px] py-2 leading-[22px]", className)}
      {...props}
    />
  );
}
