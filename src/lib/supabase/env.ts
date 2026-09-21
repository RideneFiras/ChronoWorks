/** Reads the two public Supabase values and fails loudly if .env.local is missing. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in (see README.md).`,
    );
  }
  return value;
}

export const supabaseUrl = () => required("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseAnonKey = () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
export const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
