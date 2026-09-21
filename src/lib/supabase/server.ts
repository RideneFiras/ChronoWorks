import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Server components, server actions and route handlers. Never import this in
 *  client code, and never add the service role key to it (CLAUDE.md rule 7). */
export async function createClient() {
  const store = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          for (const { name, value, options } of list) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // The middleware refreshes the session instead.
        }
      },
    },
  });
}
