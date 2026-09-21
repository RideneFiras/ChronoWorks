/**
 * The shape every form action returns, and its initial value.
 *
 * This deliberately lives outside the "use server" modules. Next.js only keeps
 * async function exports on a server-action module; anything else arrives as
 * `undefined` in a client component, which makes useActionState start with no
 * state and the first `state.errors` read throw. A production build does not
 * catch it, because these pages are dynamic and never prerendered.
 */
export interface FormState {
  status: "idle" | "saved" | "error";
  errors: Record<string, string>;
  message?: string;
}

export const emptyFormState: FormState = { status: "idle", errors: {} };
