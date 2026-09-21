/**
 * The countries Chrono bills in and around (PRD section 2: Tunisia and Europe,
 * France first). Stored as an ISO 3166-1 alpha-2 code, shown as a name.
 *
 * The code has to be exact: the invoice's reverse-charge mention compares the
 * seller's and the buyer's country, so a free-text "Tunisie" against "TN" would
 * quietly change what is printed on a legal document.
 */
export const COUNTRIES = [
  "TN", "FR", "DE", "BE", "ES", "IT", "NL", "PT", "LU", "IE",
  "AT", "PL", "SE", "DK", "FI", "GR", "CZ", "RO", "CH", "GB",
  "US", "CA", "MA", "DZ", "EG", "AE", "SA",
] as const;

export type CountryCode = (typeof COUNTRIES)[number];

export function isCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && (COUNTRIES as readonly string[]).includes(value);
}

/** "France" / "Tunisie", in the reader's language, with the code as the value. */
export function countryName(code: string, locale: string): string {
  try {
    const dn = new Intl.DisplayNames([locale === "fr" ? "fr-FR" : "en-GB"], {
      type: "region",
    });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Sorted by name in the reader's language, so the list reads naturally. */
export function countryOptions(locale: string): { code: string; name: string }[] {
  return [...COUNTRIES]
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale === "fr" ? "fr" : "en"));
}
