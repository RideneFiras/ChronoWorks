import { cookies } from "next/headers";

export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export const LOCALE_COOKIE = "chrono_locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** The signed-in user's locale comes from their profile; the cookie mirrors it
 *  so the sign-in screen and server rendering agree before we hit the database. */
export async function getUserLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}
