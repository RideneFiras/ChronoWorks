/**
 * Board positions are doubles so a card can always be dropped between two
 * others without renumbering the column.
 *
 * This lives outside the "use server" module on purpose: every export of one
 * has to be an async function, and this is a plain calculation both the client
 * and the server use.
 */
export function midpoint(before: number | null, after: number | null): number {
  if (before === null && after === null) return 1;
  if (before === null) return after! - 1;
  if (after === null) return before + 1;
  return (before + after) / 2;
}
