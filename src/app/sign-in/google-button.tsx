"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function GoogleButton() {
  const t = useTranslations("auth");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      // 400 from Supabase means the provider is off in the dashboard.
      setError(
        /provider is not enabled|unsupported provider/i.test(error.message)
          ? t("notConfigured")
          : error.message,
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="dialog" onClick={signIn} disabled={busy}>
        {busy ? t("signingIn") : t("continueWithGoogle")}
      </Button>
      {error ? (
        <p role="alert" className="max-w-[60ch] text-meta text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
