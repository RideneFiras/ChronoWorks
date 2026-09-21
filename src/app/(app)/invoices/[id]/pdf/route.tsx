import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { InvoiceDocument, mentionsFor } from "@/lib/invoice-pdf";

/**
 * Renders the invoice, stores it privately under {user_id}/{invoice_id}.pdf and
 * redirects to a short-lived signed URL (PRD section 10). The bucket is private,
 * so the PDF is never reachable without one.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Not signed in", { status: 401 });

  const [{ data: invoice }, { data: lines }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).maybeSingle(),
    supabase.from("invoice_lines").select("*").eq("invoice_id", id).order("position"),
  ]);

  if (!invoice) return new NextResponse("Not found", { status: 404 });
  if (invoice.status === "draft") {
    return new NextResponse("Issue the invoice before downloading it", { status: 409 });
  }

  // The PDF is written in the client's language, not the user's (DESIGN 9).
  const locale = invoice.language;
  const t = await getTranslations({ locale, namespace: "invoices" });
  const tc = await getTranslations({ locale, namespace: "clients" });
  const ts = await getTranslations({ locale, namespace: "settings" });

  const strings = {
    invoice: locale === "fr" ? "Facture" : "Invoice",
    number: t("number"),
    issueDate: t("issueDate"),
    dueDate: t("dueDate"),
    seller: t("seller"),
    buyer: t("buyer"),
    description: t("description"),
    quantity: t("quantity"),
    unit: t("unit"),
    unitPrice: t("unitPrice"),
    vat: t("taxTotal"),
    amount: t("lineTotal"),
    subtotal: t("subtotal"),
    stampDuty: t("stampDuty"),
    withholding: t("withholding"),
    total: t("total"),
    netToPay: t("netToPay"),
    taxId: tc("taxId"),
    vatNumber: tc("vatNumber"),
    iban: ts("iban"),
    paymentTerms: t("dueDate"),
    page: t("page"),
    units: { day: t("unitDay"), hour: t("unitHour"), unit: t("unitUnit") },
  };

  const mentions = mentionsFor(
    invoice.tax_profile,
    invoice.seller_snapshot?.country ?? null,
    invoice.buyer_snapshot?.country ?? null,
    invoice.buyer_snapshot?.vat_number ?? null,
    invoice.legal_mentions,
    { reverseCharge: t("reverseCharge"), latePenalty: t("latePenalty") },
  );

  const buffer = await renderToBuffer(
    <InvoiceDocument
      invoice={invoice}
      lines={lines ?? []}
      strings={strings}
      locale={locale}
      mentions={mentions}
    />,
  );

  const objectPath = `${user.id}/${id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(objectPath, buffer, { contentType: "application/pdf", upsert: true });

  if (uploadError && !/exists/i.test(uploadError.message)) {
    return new NextResponse(uploadError.message, { status: 500 });
  }

  // pdf_path can only be written once, so ignore the refusal on a re-download.
  if (!invoice.pdf_path) {
    await supabase.from("invoices").update({ pdf_path: objectPath }).eq("id", id);
  }

  const { data: signed } = await supabase.storage
    .from("invoices")
    .createSignedUrl(objectPath, 60, { download: `${invoice.number ?? id}.pdf` });

  if (!signed?.signedUrl) return new NextResponse("Could not sign the file", { status: 500 });
  return NextResponse.redirect(signed.signedUrl);
}
