/** DESIGN.md section 6: a circle with a single hand at ten past.
 *  1.5px brass stroke, no fill, no numerals. Do not draw any other logo art. */
export function LogoMark({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--color-brass)"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12 L16.33 9.5" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-section font-semibold text-ink">Chrono</span>
    </span>
  );
}
