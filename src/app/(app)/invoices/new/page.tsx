import { getTranslations } from "next-intl/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/page";
import { createClient } from "@/lib/supabase/server";
import { toColumnDate } from "@/lib/week";
import { InvoiceBuilder } from "./builder";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const t = await getTranslations("invoices");
  const tc = await getTranslations("clients");
  const { client } = await searchParams;

  const supabase = await createClient();
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .is("archived_at", null)
    .order("name");

  // Default period: the month to date, which is how most freelancers bill.
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);

  return (
    <>
      <PageHeader title={t("new")} />
      {(clients ?? []).length === 0 ? (
        <EmptyState
          message={tc("empty")}
          action={
            <ButtonLink href="/clients/new" variant="primary">
              {tc("new")}
            </ButtonLink>
          }
        />
      ) : (
        <InvoiceBuilder
          clients={clients ?? []}
          defaultFrom={toColumnDate(first)}
          defaultTo={toColumnDate(now)}
          defaultClientId={client}
        />
      )}
    </>
  );
}
