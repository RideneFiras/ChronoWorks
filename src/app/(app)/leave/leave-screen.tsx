"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, PageHeader, Section } from "@/components/ui/page";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { parseDateColumn } from "@/lib/format";
import type { AppLocale, LeaveRow } from "@/lib/database.types";
import { deleteLeave } from "./actions";
import { LeaveCalendar } from "./leave-calendar";
import { LeaveForm } from "./leave-form";

const tone: Record<string, "active" | "overdue" | "issued" | "done"> = {
  vacation: "active",
  sick: "overdue",
  public_holiday: "issued",
  other: "done",
};

/** Working days in a leave, counting half days as 0.5 and skipping weekends. */
function workingDays(leave: LeaveRow): number {
  let count = 0;
  let d = parseDateColumn(leave.start_date);
  const end = parseDateColumn(leave.end_date);
  while (d <= end) {
    const weekday = d.getDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  }
  if (leave.start_half) count -= 0.5;
  if (leave.end_half && leave.end_date !== leave.start_date) count -= 0.5;
  return Math.max(count, 0.5);
}

export function LeaveScreen({
  leaves,
  locale,
}: {
  leaves: LeaveRow[];
  locale: AppLocale;
}) {
  const t = useTranslations("leave");
  const router = useRouter();
  const [editing, setEditing] = useState<LeaveRow | null>(null);
  const [creatingOn, setCreatingOn] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();

  function close() {
    setOpen(false);
    setEditing(null);
    setCreatingOn(null);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title={t("title")}
        action={
          <Button
            variant="primary"
            onClick={() => {
              setEditing(null);
              setCreatingOn(null);
              setOpen(true);
            }}
          >
            {t("new")}
          </Button>
        }
      />

      <div className="mb-8">
        <LeaveCalendar
          leaves={leaves}
          locale={locale}
          onPick={(date) => {
            const existing = leaves.find((l) => date >= l.start_date && date <= l.end_date);
            if (existing) {
              setEditing(existing);
              setCreatingOn(null);
            } else {
              setEditing(null);
              setCreatingOn(date);
            }
            setOpen(true);
          }}
        />
      </div>

      <Section title={t("list")}>
        {leaves.length === 0 ? (
          <EmptyState
            message={t("empty")}
            action={
              <Button variant="primary" onClick={() => setOpen(true)}>
                {t("new")}
              </Button>
            }
          />
        ) : (
          <Table>
            <THead>
              <TH>{t("type")}</TH>
              <TH>{t("startDate")}</TH>
              <TH>{t("endDate")}</TH>
              <TH>{t("note")}</TH>
              <TH align="end">{t("daysLabel")}</TH>
              <TH />
            </THead>
            <TBody>
              {leaves.map((leave) => (
                <TR key={leave.id}>
                  <TD>
                    <StatusPill tone={tone[leave.type]} label={t(`type_${leave.type}`)} />
                  </TD>
                  <TD className="text-ink-muted">{formatDate(leave.start_date, locale)}</TD>
                  <TD className="text-ink-muted">{formatDate(leave.end_date, locale)}</TD>
                  <TD className="text-ink-muted">{leave.note ?? "—"}</TD>
                  <TD numeric>{workingDays(leave)}</TD>
                  <TD align="end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="quiet"
                        onClick={() => {
                          setEditing(leave);
                          setCreatingOn(null);
                          setOpen(true);
                        }}
                      >
                        {t("edit")}
                      </Button>
                      <button
                        type="button"
                        aria-label={t("delete")}
                        onClick={() => start(async () => {
                          await deleteLeave(leave.id);
                          router.refresh();
                        })}
                        className="flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-red-tint hover:text-red"
                      >
                        <Trash2 size={16} strokeWidth={1.5} />
                      </button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Section>

      {open ? (
        <Dialog title={editing ? t("edit") : t("new")} onClose={close}>
          <LeaveForm leave={editing} defaultDate={creatingOn ?? undefined} onDone={close} />
        </Dialog>
      ) : null}
    </>
  );
}
