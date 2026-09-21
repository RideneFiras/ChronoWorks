"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setInvoiceStatus } from "../actions";

/** An issued invoice is frozen. Only the status may move forward, and the PDF
 *  is fetched through a short-lived signed URL. */
export function IssuedActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: "issued" | "sent" | "paid" | "cancelled";
}) {
  const t = useTranslations("invoices");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function move(next: "sent" | "paid") {
    start(async () => {
      const result = await setInvoiceStatus(invoiceId, next);
      if (!result.ok) setError(result.reason ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <a
        href={`/invoices/${invoiceId}/pdf`}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-control border border-brass bg-brass px-3 text-body font-medium text-night hover:bg-brass-tint hover:text-ink"
      >
        <Download size={16} strokeWidth={1.5} />
        {t("downloadPdf")}
      </a>

      {status === "issued" ? (
        <Button disabled={pending} onClick={() => move("sent")}>
          {t("markSent")}
        </Button>
      ) : null}

      {status === "issued" || status === "sent" ? (
        <Button disabled={pending} onClick={() => move("paid")}>
          {t("markPaid")}
        </Button>
      ) : null}

      {error ? (
        <p role="alert" className="text-meta text-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
