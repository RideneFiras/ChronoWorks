"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Skipping the walkthrough should not be permanent, so it can be restarted
 *  from Settings. The shell listens for this event. */
export function RestartTour() {
  const t = useTranslations("tour");
  const toast = useToast();

  return (
    <Button
      onClick={() => {
        window.dispatchEvent(new Event("chrono:tour"));
        toast(t("restarted"));
      }}
    >
      {t("restart")}
    </Button>
  );
}
