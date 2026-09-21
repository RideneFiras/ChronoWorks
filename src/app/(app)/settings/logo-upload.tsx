"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { clearLogo, setLogoPath } from "./account-actions";

const MAX_BYTES = 512 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/**
 * The logo goes on the invoice (DESIGN.md section 9). It is uploaded straight
 * from the browser to the private logos bucket under {user_id}/, which the
 * storage policy is what actually enforces; the path is then recorded on the
 * profile so issue_invoice() can snapshot it.
 */
export function LogoUpload({
  logoPath,
  previewUrl,
}: {
  logoPath: string | null;
  previewUrl: string | null;
}) {
  const t = useTranslations("settings");
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);

    if (!TYPES.includes(file.type)) {
      setError(t("logoType"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t("logoSize"));
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${user.id}/logo.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    start(async () => {
      const result = await setLogoPath(path);
      if (!result.ok) setError(result.reason ?? null);
      else toast(t("logoSaved"));
    });
  }

  return (
    <Field label={t("logo")} htmlFor="logo" help={t("logoHelp")} error={error ?? undefined}>
      <div className="flex flex-wrap items-center gap-4">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={t("logo")}
            className="h-12 w-12 rounded-control border border-line bg-night object-contain p-1"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-control border border-line bg-night text-meta text-ink-muted">
            —
          </div>
        )}

        <input
          ref={input}
          id="logo"
          type="file"
          accept={TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />

        <Button onClick={() => input.current?.click()} disabled={pending}>
          {logoPath ? t("logoReplace") : t("logoChoose")}
        </Button>

        {logoPath ? (
          <button
            type="button"
            disabled={pending}
            aria-label={t("logoRemove")}
            onClick={() =>
              start(async () => {
                const result = await clearLogo();
                if (!result.ok) setError(result.reason ?? null);
                else toast(t("logoRemoved"));
              })
            }
            className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-red-tint hover:text-red"
          >
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </Field>
  );
}
