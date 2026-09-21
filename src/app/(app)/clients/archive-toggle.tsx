"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setClientArchived } from "./actions";

export function ArchiveToggle({ id, archived }: { id: string; archived: boolean }) {
  const t = useTranslations("clients");
  const [pending, start] = useTransition();

  return (
    <Button
      variant={archived ? "secondary" : "destructive"}
      disabled={pending}
      onClick={() => start(() => setClientArchived(id, !archived))}
    >
      {archived ? t("unarchive") : t("archive")}
    </Button>
  );
}
