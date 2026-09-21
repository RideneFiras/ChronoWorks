/**
 * The two public Supabase values, plus a clear failure when .env.local is
 * missing.
 *
 * These must be written as literal `process.env.NEXT_PUBLIC_...` member reads.
 * Next.js substitutes those at build time when it bundles for the browser; a
 * computed lookup like `process.env[name]` is invisible to that pass, so it
 * survives on the server and comes back undefined in the browser.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in (see README.md). ` +
        `If you just edited the env file, restart the dev server: the value is baked into the browser bundle.`,
    );
  }
  return value;
}

export const supabaseUrl = () => required(url, "NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = () => required(anonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY");