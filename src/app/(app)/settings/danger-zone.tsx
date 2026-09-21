"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { Section } from "@/components/ui/page";
import { useToast } from "@/components/ui/toast";
import { deleteAccount, exportAccount } from "./account-actions";

/** PRD section 10: account deletion and data export. The export is offered
 *  next to the delete, because accounting rules in France and Tunisia expect
 *  issued invoices to be kept for years after the account is gone. */
export function DangerZone() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const toast = useToast();

  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const word = t("deleteConfirmWord");
  const matches = typed.trim().toUpperCase() === word.toUpperCase();

  function download() {
    start(async () => {
      const result = await exportAccount();
      if (!result.ok) {
        toast(result.reason, "error");
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chrono-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(t("exported"));
    });
  }

  return (
    <Section title={t("dangerSection")} description={t("dangerBody")}>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={download} disabled={pending}>
          {t("exportData")}
        </Button>
        <Button variant="destructive" onClick={() => setConfirming(true)} disabled={pending}>
          {t("deleteAccount")}
        </Button>
      </div>

      {confirming ? (
        <Dialog
          title={t("deleteConfirmTitle")}
          onClose={() => {
            setConfirming(false);
            setTyped("");
            setError(null);
          }}
        >
          <p className="max-w-[60ch] text-body text-ink-muted">
            {t("deleteConfirmBody", { word })}
          </p>

          <div className="mt-4">
            <Field label={word} htmlFor="delete_confirm" error={error ?? undefined}>
              <Input
                id="delete_confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              size="dialog"
              onClick={() => {
                setConfirming(false);
                setTyped("");
              }}
            >
              {tCommon("cancel")}
            </Button>
            {/* DESIGN.md section 5: filled red only in the final confirm step. */}
            <Button
              size="dialog"
              disabled={!matches || pending}
              className="border-red bg-red text-night hover:bg-red-tint hover:text-red"
              onClick={() =>
                start(async () => {
                  const result = await deleteAccount(typed);
                  if (result && !result.ok) setError(result.reason ?? null);
                })
              }
            >
              {pending ? tCommon("saving") : t("deleteConfirmAction")}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </Section>
  );
}
