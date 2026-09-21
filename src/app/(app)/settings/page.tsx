import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/ui/page";
import { requireSession } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { DangerZone } from "./danger-zone";
import { LogoUpload } from "./logo-upload";
import { RestartTour } from "./restart-tour";

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const { profile } = await requireSession();

  // The logos bucket is private, so the preview needs a signed URL too.
  let previewUrl: string | null = null;
  if (profile.logo_path) {
    const supabase = await createClient();
    const { data } = await supabase.storage
      .from("logos")
      .createSignedUrl(profile.logo_path, 300);
    previewUrl = data?.signedUrl ?? null;
  }

  return (
    <>
      <PageHeader title={t("title")} />
      <div className="mb-8">
        <LogoUpload logoPath={profile.logo_path} previewUrl={previewUrl} />
      </div>

      <SettingsForm profile={profile} />

      <div className="mt-8 border-t border-line pt-6">
        <RestartTour />
      </div>

      <div className="mt-8">
        <DangerZone />
      </div>
    </>
  );
}
