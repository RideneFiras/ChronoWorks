import type { InvoiceStatus } from "@/lib/database.types";
import type { PillTone } from "@/components/ui/status-pill";

/**
 * DESIGN.md section 5 and 10: a pill always carries the word, never colour
 * alone. So the tone and the label are decided together. An issued or sent
 * invoice past its due date is overdue and says so; a paid one never is.
 */
export function invoicePill(
  status: InvoiceStatus,
  dueDate: string,
  today: string,
): { tone: PillTone; key: string } {
  if ((status === "issued" || status === "sent") && dueDate < today) {
    return { tone: "overdue", key: "statusOverdue" };
  }
  switch (status) {
    case "draft":
      return { tone: "draft", key: "statusDraft" };
    case "issued":
      return { tone: "issued", key: "statusIssued" };
    case "sent":
      return { tone: "issued", key: "statusSent" };
    case "paid":
      return { tone: "paid", key: "statusPaid" };
    default:
      return { tone: "cancelled", key: "statusCancelled" };
  }
}
