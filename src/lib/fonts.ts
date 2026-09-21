import localFont from "next/font/local";

/**
 * DESIGN.md section 3. Two families, self-hosted.
 *
 * The woff2 files are committed rather than fetched by next/font/google at
 * build time: the build then works offline and behind a proxy, and the bytes
 * never change under us. Latin subset only, which covers French and English
 * in full (including the accents, oe and the euro sign).
 *
 * Spectral ships one file per weight; Hanken Grotesk is a variable font, so one
 * file covers 400 to 600.
 */
export const spectral = localFont({
  src: [
    { path: "../fonts/Spectral-500-latin.woff2", weight: "500", style: "normal" },
    { path: "../fonts/Spectral-600-latin.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-spectral",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const hanken = localFont({
  src: [
    { path: "../fonts/HankenGrotesk-variable-latin.woff2", weight: "400 600", style: "normal" },
  ],
  variable: "--font-hanken",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});
