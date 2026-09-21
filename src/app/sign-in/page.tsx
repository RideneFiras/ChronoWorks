import { getTranslations } from "next-intl/server";
import { Wordmark } from "@/components/ui/logo";
import { GoogleButton } from "./google-button";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations("auth");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-8 px-4">
      <Wordmark />

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-title font-semibold text-ink">
          {t("signInTitle")}
        </h1>
        <p className="max-w-[60ch] text-body text-ink-muted">{t("signInLead")}</p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-panel border border-line bg-red-tint p-4 text-body text-ink"
        >
          <p className="font-medium">{t("failedTitle")}</p>
          <p className="mt-1 text-ink-muted">{t("failedBody")}</p>
        </div>
      ) : null}

      <GoogleButton />
    </main>
  );
}
