/**
 * Types for the schema in supabase/migrations/0001_init.sql.
 * Written by hand and kept in step with the migrations: when you add a
 * 000N_*.sql, change this file in the same commit.
 *
 * Money columns are `numeric` in Postgres and arrive as strings over the wire.
 * They stay strings here on purpose (CLAUDE.md rule 5): never parse them into a
 * float. Use the helpers in src/lib/money.ts.
 */

export type ProjectStatus = "active" | "paused" | "done";
export type RateType = "daily" | "hourly" | "fixed";
export type LeaveType = "vacation" | "sick" | "other" | "public_holiday";
export type InvoiceStatus = "draft" | "issued" | "sent" | "paid" | "cancelled";
export type InvoiceKind = "invoice" | "credit_note";
export type TaxProfile = "tn" | "fr" | "eu_generic";
export type Currency = "TND" | "EUR" | "USD";
export type InvoiceUnit = "day" | "hour" | "unit";
export type AppLocale = "fr" | "en";

/** numeric(p,s) as returned by PostgREST */
type Numeric = string;

/** Declared as type aliases, not interfaces: PostgREST's GenericSchema needs an
 *  implicit index signature, which TypeScript only gives to type aliases. */
export type PartySnapshot = {
  legal_name?: string | null;
  name?: string | null;
  email?: string | null;
  address?: string | null;
  country?: string | null;
  tax_id?: string | null;
  vat_number?: string | null;
  iban?: string | null;
  logo_path?: string | null;
  legal_mentions?: string | null;
}

export type ProfileRow = {
  id: string;
  display_name: string | null;
  locale: AppLocale;
  country: string | null;
  default_currency: Currency;
  tax_profile: TaxProfile;
  legal_name: string | null;
  address: string | null;
  tax_id: string | null;
  vat_number: string | null;
  iban: string | null;
  logo_path: string | null;
  invoice_prefix: string;
  payment_terms_days: number;
  hours_per_day: Numeric;
  legal_mentions: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientRow = {
  id: string;
  user_id: string;
  name: string;
  email: string | null;
  address: string | null;
  country: string | null;
  tax_id: string | null;
  vat_number: string | null;
  currency: Currency;
  invoice_language: AppLocale;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectRow = {
  id: string;
  user_id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  rate_type: RateType;
  rate_amount: Numeric;
  currency: Currency;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectStatusHistoryRow = {
  id: string;
  user_id: string;
  project_id: string;
  status: ProjectStatus;
  changed_on: string;
  note: string | null;
  created_at: string;
}

export type BoardRow = {
  id: string;
  user_id: string;
  project_id: string;
  created_at: string;
}

export type BoardColumnRow = {
  id: string;
  user_id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
}

export type TaskRow = {
  id: string;
  user_id: string;
  project_id: string;
  column_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  estimate_minutes: number | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TimeEntryRow = {
  id: string;
  user_id: string;
  project_id: string;
  task_id: string | null;
  invoice_id: string | null;
  entry_date: string;
  duration_minutes: number;
  description: string | null;
  is_billable: boolean;
  created_at: string;
  updated_at: string;
}

export type LeaveRow = {
  id: string;
  user_id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  start_half: boolean;
  end_half: boolean;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceRow = {
  id: string;
  user_id: string;
  client_id: string;
  kind: InvoiceKind;
  credit_for_invoice_id: string | null;
  number: string | null;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: Currency;
  language: AppLocale;
  tax_profile: TaxProfile;
  subtotal: Numeric;
  tax_total: Numeric;
  stamp_duty: Numeric;
  withholding: Numeric;
  total: Numeric;
  notes: string | null;
  legal_mentions: string | null;
  pdf_path: string | null;
  seller_snapshot: PartySnapshot | null;
  buyer_snapshot: PartySnapshot | null;
  issued_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceLineRow = {
  id: string;
  user_id: string;
  invoice_id: string;
  project_id: string | null;
  position: number;
  description: string;
  quantity: Numeric;
  unit: InvoiceUnit;
  unit_price: Numeric;
  tax_rate: Numeric;
  line_total: Numeric;
  created_at: string;
}

export type InvoiceCounterRow = {
  user_id: string;
  year: number;
  last_number: number;
}

/** Columns the database always fills in for us. */
type Generated = "id" | "user_id" | "created_at" | "updated_at" | "line_total";

/** Any column that accepts null is optional on insert. */
type NullableKeys<T> = {
  [K in keyof T]-?: null extends T[K] ? K : never;
}[keyof T];

/**
 * Optional on insert = generated, nullable, or NOT NULL with a default.
 * `Defaults` lists the last group per table, taken from 0001_init.sql.
 */
type Insert<T, Defaults extends keyof T = never> = Omit<
  T,
  NullableKeys<T> | Extract<keyof T, Generated> | Defaults
> &
  Partial<Pick<T, NullableKeys<T> | Extract<keyof T, Generated> | Defaults>>;

type Table<Row, Defaults extends keyof Row = never> = {
  Row: Row;
  Insert: Insert<Row, Defaults>;
  Update: Partial<Insert<Row, Defaults>>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        | "locale"
        | "default_currency"
        | "tax_profile"
        | "invoice_prefix"
        | "payment_terms_days"
        | "hours_per_day"
      >;
      clients: Table<ClientRow, "currency" | "invoice_language">;
      projects: Table<ProjectRow, "status" | "rate_type" | "rate_amount" | "currency">;
      project_status_history: Table<ProjectStatusHistoryRow, "changed_on">;
      boards: Table<BoardRow>;
      board_columns: Table<BoardColumnRow, "position">;
      tasks: Table<TaskRow, "position">;
      time_entries: Table<TimeEntryRow, "entry_date" | "is_billable">;
      leaves: Table<LeaveRow, "type" | "start_half" | "end_half">;
      invoices: Table<
        InvoiceRow,
        | "kind"
        | "status"
        | "issue_date"
        | "due_date"
        | "currency"
        | "language"
        | "tax_profile"
        | "subtotal"
        | "tax_total"
        | "stamp_duty"
        | "withholding"
        | "total"
      >;
      invoice_lines: Table<InvoiceLineRow, "position" | "unit" | "tax_rate">;
      invoice_counters: Table<InvoiceCounterRow, "last_number">;
    };
    Views: Record<never, never>;
    Functions: {
      issue_invoice: {
        Args: { p_invoice_id: string };
        Returns: InvoiceRow;
      };
      delete_account: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      project_status: ProjectStatus;
      rate_type: RateType;
      leave_type: LeaveType;
      invoice_status: InvoiceStatus;
      invoice_kind: InvoiceKind;
      tax_profile: TaxProfile;
    };
    CompositeTypes: Record<never, never>;
  };
}
