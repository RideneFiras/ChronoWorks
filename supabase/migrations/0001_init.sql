-- =============================================================================
-- Chrono: initial schema
-- Paste into the Supabase SQL Editor and run ONCE on a fresh project.
-- Never edit this file after it has been applied: further changes go in
-- 0002_*.sql, 0003_*.sql, etc.
--
-- Requires Postgres 15 or newer (uses ON DELETE SET NULL (column) on composite
-- foreign keys). Every Supabase project created today satisfies this.
-- =============================================================================

-- ---------- Enums ------------------------------------------------------------
create type public.project_status as enum ('active', 'paused', 'done');
create type public.rate_type      as enum ('daily', 'hourly', 'fixed');
create type public.leave_type     as enum ('vacation', 'sick', 'other', 'public_holiday');
create type public.invoice_status as enum ('draft', 'issued', 'sent', 'paid', 'cancelled');
create type public.invoice_kind   as enum ('invoice', 'credit_note');
create type public.tax_profile    as enum ('tn', 'fr', 'eu_generic');

-- ---------- Shared helper ----------------------------------------------------
create function public.tg_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- profiles (one row per auth user) --------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  display_name       text,
  locale             text not null default 'fr' check (locale in ('fr', 'en')),
  country            text,
  default_currency   text not null default 'EUR' check (default_currency in ('TND', 'EUR', 'USD')),
  tax_profile        public.tax_profile not null default 'fr',
  legal_name         text,
  address            text,
  tax_id             text,          -- matricule fiscal (TN) / SIRET (FR)
  vat_number         text,
  iban               text,
  logo_path          text,
  invoice_prefix     text not null default 'INV' check (invoice_prefix ~ '^[A-Za-z0-9-]{1,12}$'),
  payment_terms_days int  not null default 30 check (payment_terms_days >= 0 and payment_terms_days <= 365),
  hours_per_day      numeric(4,2) not null default 8 check (hours_per_day > 0 and hours_per_day <= 24),
  legal_mentions     text,          -- free text printed in the invoice footer
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The profile row is created by a trigger, so the app never has to.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name',
             split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- clients ----------------------------------------------------------
create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name             text not null check (length(trim(name)) > 0),
  email            text,
  address          text,
  country          text,
  tax_id           text,
  vat_number       text,
  currency         text not null default 'EUR' check (currency in ('TND', 'EUR', 'USD')),
  invoice_language text not null default 'fr' check (invoice_language in ('fr', 'en')),
  notes            text,
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- the composite target every child table points at, so a row can never
  -- reference another user's data
  unique (user_id, id)
);

-- ---------- projects ---------------------------------------------------------
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id   uuid not null,
  name        text not null check (length(trim(name)) > 0),
  description text,
  status      public.project_status not null default 'active',
  rate_type   public.rate_type not null default 'daily',
  rate_amount numeric(12,3) not null default 0 check (rate_amount >= 0),
  currency    text not null default 'EUR' check (currency in ('TND', 'EUR', 'USD')),
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, id),
  check (end_date is null or start_date is null or end_date >= start_date),
  foreign key (user_id, client_id) references public.clients (user_id, id)
);

create table public.project_status_history (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  status     public.project_status not null,
  changed_on date not null default current_date,
  note       text,
  created_at timestamptz not null default now(),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

-- ---------- boards, columns, tasks ------------------------------------------
create table public.boards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null unique,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade
);

create table public.board_columns (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  board_id   uuid not null,
  name       text not null check (length(trim(name)) > 0),
  position   double precision not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, board_id) references public.boards (user_id, id) on delete cascade
);

create table public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id       uuid not null,
  column_id        uuid not null,
  title            text not null check (length(trim(title)) > 0),
  description      text,
  position         double precision not null default 0,
  due_date         date,
  estimate_minutes int check (estimate_minutes is null or estimate_minutes > 0),
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete cascade,
  foreign key (user_id, column_id)  references public.board_columns (user_id, id) on delete cascade
);

-- ---------- invoices ---------------------------------------------------------
create table public.invoices (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id             uuid not null,
  kind                  public.invoice_kind not null default 'invoice',
  credit_for_invoice_id uuid,                      -- reserved for credit notes (v1.5)
  number                text,                      -- assigned by issue_invoice(), gapless per user and year
  status                public.invoice_status not null default 'draft',
  issue_date            date not null default current_date,
  due_date              date not null default (current_date + 30),
  currency              text not null default 'EUR' check (currency in ('TND', 'EUR', 'USD')),
  language              text not null default 'fr' check (language in ('fr', 'en')),
  tax_profile           public.tax_profile not null default 'fr',
  subtotal              numeric(14,3) not null default 0,
  tax_total             numeric(14,3) not null default 0,
  stamp_duty            numeric(14,3) not null default 0 check (stamp_duty >= 0),
  withholding           numeric(14,3) not null default 0 check (withholding >= 0),
  total                 numeric(14,3) not null default 0,
  notes                 text,
  legal_mentions        text,
  pdf_path              text,
  seller_snapshot       jsonb,                     -- frozen at issue time
  buyer_snapshot        jsonb,                     -- frozen at issue time
  issued_at             timestamptz,
  sent_at               timestamptz,
  paid_at               timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (user_id, id),
  check (due_date >= issue_date),
  check (status = 'draft' or number is not null),
  foreign key (user_id, client_id) references public.clients (user_id, id),
  foreign key (user_id, credit_for_invoice_id) references public.invoices (user_id, id)
);
create unique index invoices_number_unique
  on public.invoices (user_id, number) where number is not null;

create table public.invoice_lines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_id  uuid not null,
  project_id  uuid,
  position    int not null default 0,
  description text not null check (length(trim(description)) > 0),
  quantity    numeric(12,3) not null,
  unit        text not null default 'day' check (unit in ('day', 'hour', 'unit')),
  unit_price  numeric(14,3) not null,
  tax_rate    numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  line_total  numeric(14,3) generated always as (round(quantity * unit_price, 3)) stored,
  created_at  timestamptz not null default now(),
  foreign key (user_id, invoice_id) references public.invoices (user_id, id) on delete cascade,
  foreign key (user_id, project_id) references public.projects (user_id, id) on delete set null (project_id)
);

create table public.invoice_counters (
  user_id     uuid not null references auth.users (id) on delete cascade,
  year        int  not null,
  last_number int  not null default 0,
  primary key (user_id, year)
);

-- ---------- time entries and leave ------------------------------------------
create table public.time_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id       uuid not null,
  task_id          uuid,
  invoice_id       uuid,
  entry_date       date not null default current_date,
  duration_minutes int not null check (duration_minutes > 0 and duration_minutes <= 1440),
  description      text,
  is_billable      boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, project_id) references public.projects (user_id, id),
  foreign key (user_id, task_id)    references public.tasks (user_id, id)    on delete set null (task_id),
  foreign key (user_id, invoice_id) references public.invoices (user_id, id) on delete set null (invoice_id)
);

create table public.leaves (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type       public.leave_type not null default 'vacation',
  start_date date not null,
  end_date   date not null,
  start_half boolean not null default false,
  end_half   boolean not null default false,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- ---------- Indexes ----------------------------------------------------------
create index projects_client_idx        on public.projects (user_id, client_id);
create index status_history_project_idx on public.project_status_history (project_id, changed_on);
create index columns_board_idx          on public.board_columns (board_id, position);
create index tasks_column_idx           on public.tasks (column_id, position);
create index tasks_project_idx          on public.tasks (project_id);
create index time_entries_date_idx      on public.time_entries (user_id, entry_date);
create index time_entries_project_idx   on public.time_entries (project_id);
create index time_entries_unbilled_idx  on public.time_entries (user_id, project_id, entry_date)
  where invoice_id is null and is_billable;
create index time_entries_invoice_idx   on public.time_entries (invoice_id) where invoice_id is not null;
create index leaves_dates_idx           on public.leaves (user_id, start_date, end_date);
create index invoices_status_idx        on public.invoices (user_id, status);
create index invoices_issue_date_idx    on public.invoices (user_id, issue_date desc);
create index invoices_client_idx        on public.invoices (client_id);
create index invoice_lines_invoice_idx  on public.invoice_lines (invoice_id, position);

-- ---------- updated_at triggers ---------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','clients','projects','tasks','time_entries','leaves','invoices'] loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.tg_set_updated_at()',
      t || '_updated_at', t);
  end loop;
end $$;

-- ---------- Project automation: status history and default board ------------
create function public.tg_project_after_insert() returns trigger
language plpgsql set search_path = '' as $$
declare v_board uuid;
begin
  insert into public.project_status_history (user_id, project_id, status, changed_on)
  values (new.user_id, new.id, new.status, coalesce(new.start_date, current_date));

  insert into public.boards (user_id, project_id)
  values (new.user_id, new.id)
  returning id into v_board;

  insert into public.board_columns (user_id, board_id, name, position) values
    (new.user_id, v_board, 'To do', 1),
    (new.user_id, v_board, 'In progress', 2),
    (new.user_id, v_board, 'Done', 3);
  return new;
end $$;

create trigger projects_after_insert
  after insert on public.projects
  for each row execute function public.tg_project_after_insert();

create function public.tg_project_status_change() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.project_status_history (user_id, project_id, status)
    values (new.user_id, new.id, new.status);
  end if;
  return new;
end $$;

create trigger projects_status_change
  after update of status on public.projects
  for each row execute function public.tg_project_status_change();

-- ---------- Consistency: a task's column must belong to its project ---------
create function public.tg_tasks_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1
    from public.board_columns bc
    join public.boards b on b.id = bc.board_id
    where bc.id = new.column_id and b.project_id = new.project_id
  ) then
    raise exception 'This column does not belong to the task''s project' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger tasks_guard
  before insert or update of project_id, column_id on public.tasks
  for each row execute function public.tg_tasks_guard();

-- =============================================================================
-- Invoice locking
--
-- Once an invoice leaves 'draft' it is frozen: its financial fields, its lines
-- and the time entries attached to it cannot change. Status may only move
-- forward (issued -> sent -> paid).
--
-- app.issuing and app.allow_locked_changes are transaction-local flags set only
-- by the SECURITY DEFINER functions below. PostgREST runs each request in its
-- own transaction, so a client cannot set them and have them survive into
-- a later statement.
-- =============================================================================
create function public.tg_invoices_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_override boolean := coalesce(current_setting('app.allow_locked_changes', true), '') = 'on';
  v_issuing  boolean := coalesce(current_setting('app.issuing', true), '') = 'on';
  -- columns that stay editable after issue
  v_free     text[]  := array['status', 'sent_at', 'paid_at', 'pdf_path', 'updated_at'];
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' and not v_override then
      raise exception 'Issued invoices cannot be deleted' using errcode = '23514';
    end if;
    return old;
  end if;

  if old.status = 'draft' then
    if new.status <> 'draft' and not v_issuing then
      raise exception 'Use issue_invoice() to issue an invoice' using errcode = '23514';
    end if;
    if new.status = 'draft' and new.number is not null then
      raise exception 'The invoice number is assigned when the invoice is issued' using errcode = '23514';
    end if;
    return new;
  end if;

  if v_override then
    return new;
  end if;

  if new.status is distinct from old.status
     and not ((old.status = 'issued' and new.status in ('sent', 'paid'))
           or (old.status = 'sent'   and new.status = 'paid')) then
    raise exception 'Invalid invoice status change: % to %', old.status, new.status using errcode = '23514';
  end if;

  if (to_jsonb(new) - v_free) is distinct from (to_jsonb(old) - v_free) then
    raise exception 'Issued invoices cannot be edited' using errcode = '23514';
  end if;

  if old.pdf_path is not null and new.pdf_path is distinct from old.pdf_path then
    raise exception 'The invoice PDF cannot be replaced once saved' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger invoices_guard
  before update or delete on public.invoices
  for each row execute function public.tg_invoices_guard();

create function public.tg_invoice_lines_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_override boolean := coalesce(current_setting('app.allow_locked_changes', true), '') = 'on';
  v_status   public.invoice_status;
begin
  if not v_override then
    if tg_op in ('UPDATE', 'DELETE') then
      select status into v_status from public.invoices where id = old.invoice_id;
      if v_status is not null and v_status <> 'draft' then
        raise exception 'Lines of an issued invoice cannot be changed' using errcode = '23514';
      end if;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
      select status into v_status from public.invoices where id = new.invoice_id;
      if v_status is not null and v_status <> 'draft' then
        raise exception 'Lines of an issued invoice cannot be changed' using errcode = '23514';
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

create trigger invoice_lines_guard
  before insert or update or delete on public.invoice_lines
  for each row execute function public.tg_invoice_lines_guard();

create function public.tg_time_entries_guard() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_override     boolean := coalesce(current_setting('app.allow_locked_changes', true), '') = 'on';
  v_status       public.invoice_status;
  v_inv_client   uuid;
  v_proj_client  uuid;
  v_task_project uuid;
begin
  -- an entry already attached to a non-draft invoice is frozen
  if tg_op = 'DELETE' then
    if old.invoice_id is not null and not v_override then
      select status into v_status from public.invoices where id = old.invoice_id;
      if v_status is not null and v_status <> 'draft' then
        raise exception 'This time entry is locked by an issued invoice' using errcode = '23514';
      end if;
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.invoice_id is not null and not v_override then
    select status into v_status from public.invoices where id = old.invoice_id;
    if v_status is not null and v_status <> 'draft' then
      raise exception 'This time entry is locked by an issued invoice' using errcode = '23514';
    end if;
  end if;

  -- a task must belong to the same project as the entry
  if new.task_id is not null then
    select project_id into v_task_project from public.tasks where id = new.task_id;
    if v_task_project is distinct from new.project_id then
      raise exception 'This task does not belong to the selected project' using errcode = '23514';
    end if;
  end if;

  -- time can only be attached to a draft invoice of the same client
  if new.invoice_id is not null and (tg_op = 'INSERT' or new.invoice_id is distinct from old.invoice_id) then
    select status, client_id into v_status, v_inv_client from public.invoices where id = new.invoice_id;
    if v_status is distinct from 'draft' then
      raise exception 'Time can only be attached to a draft invoice' using errcode = '23514';
    end if;
    select client_id into v_proj_client from public.projects where id = new.project_id;
    if v_proj_client is distinct from v_inv_client then
      raise exception 'This time entry belongs to a different client than the invoice' using errcode = '23514';
    end if;
  end if;

  return new;
end $$;

create trigger time_entries_guard
  before insert or update or delete on public.time_entries
  for each row execute function public.tg_time_entries_guard();

-- =============================================================================
-- issue_invoice(): the only way to issue an invoice
-- Assigns a gapless number per user and year, recomputes totals from the lines,
-- snapshots seller and buyer details, then locks the invoice. One transaction,
-- so a rollback also rolls back the number.
-- =============================================================================
create function public.issue_invoice(p_invoice_id uuid) returns public.invoices
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := (select auth.uid());
  inv    public.invoices;
  prof   public.profiles;
  cli    public.clients;
  v_year int;
  v_n    int;
  v_sub  numeric(14,3);
  v_tax  numeric(14,3);
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select * into inv from public.invoices
  where id = p_invoice_id and user_id = v_uid
  for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if inv.status <> 'draft' then
    raise exception 'Only draft invoices can be issued' using errcode = '23514';
  end if;
  if not exists (select 1 from public.invoice_lines where invoice_id = inv.id) then
    raise exception 'Add at least one line before issuing' using errcode = '23514';
  end if;

  select * into prof from public.profiles where id = v_uid;
  select * into cli  from public.clients  where id = inv.client_id and user_id = v_uid;
  if cli.id is null then
    raise exception 'Invoice client not found' using errcode = 'P0002';
  end if;

  v_year := extract(year from inv.issue_date)::int;

  -- gapless: the counter is a row, not a sequence, so it rolls back with us
  insert into public.invoice_counters as c (user_id, year, last_number)
  values (v_uid, v_year, 1)
  on conflict (user_id, year) do update set last_number = c.last_number + 1
  returning c.last_number into v_n;

  select coalesce(sum(line_total), 0),
         coalesce(sum(round(line_total * tax_rate / 100, 3)), 0)
    into v_sub, v_tax
    from public.invoice_lines where invoice_id = inv.id;

  perform set_config('app.issuing', 'on', true);

  update public.invoices set
    number      = prof.invoice_prefix || '-' || v_year::text || '-' || lpad(v_n::text, 4, '0'),
    status      = 'issued',
    issued_at   = now(),
    subtotal    = v_sub,
    tax_total   = v_tax,
    total       = v_sub + v_tax + stamp_duty - withholding,
    seller_snapshot = jsonb_build_object(
      'legal_name',     coalesce(prof.legal_name, prof.display_name),
      'address',        prof.address,
      'tax_id',         prof.tax_id,
      'vat_number',     prof.vat_number,
      'iban',           prof.iban,
      'logo_path',      prof.logo_path,
      'country',        prof.country,
      'legal_mentions', prof.legal_mentions),
    buyer_snapshot = jsonb_build_object(
      'name',       cli.name,
      'email',      cli.email,
      'address',    cli.address,
      'country',    cli.country,
      'tax_id',     cli.tax_id,
      'vat_number', cli.vat_number)
  where id = inv.id
  returning * into inv;

  perform set_config('app.issuing', 'off', true);
  return inv;
end $$;

-- =============================================================================
-- delete_account(): GDPR erase
-- The app must export the user's data and empty their storage folders
-- (invoices/{uid}/ and logos/{uid}/) before calling this. Accounting law in
-- France and Tunisia requires keeping issued invoices for years, so the UI
-- warns before offering it.
-- =============================================================================
create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  -- let the cascade past the invoice locks
  perform set_config('app.allow_locked_changes', 'on', true);
  delete from auth.users where id = v_uid;
end $$;

-- ---------- Row Level Security ----------------------------------------------
alter table public.profiles                enable row level security;
alter table public.clients                 enable row level security;
alter table public.projects                enable row level security;
alter table public.project_status_history  enable row level security;
alter table public.boards                  enable row level security;
alter table public.board_columns           enable row level security;
alter table public.tasks                   enable row level security;
alter table public.time_entries            enable row level security;
alter table public.leaves                  enable row level security;
alter table public.invoices                enable row level security;
alter table public.invoice_lines           enable row level security;
alter table public.invoice_counters        enable row level security;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- read-only to the app; only issue_invoice() writes it
create policy invoice_counters_select on public.invoice_counters for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array[
    'clients','projects','project_status_history','boards','board_columns',
    'tasks','time_entries','leaves','invoices','invoice_lines'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end $$;

-- ---------- Privileges: nothing for anon ------------------------------------
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.invoice_counters from authenticated;
revoke delete on public.profiles from authenticated;

revoke execute on function public.issue_invoice(uuid) from public;
revoke execute on function public.delete_account()    from public;
grant  execute on function public.issue_invoice(uuid) to authenticated;
grant  execute on function public.delete_account()    to authenticated;

-- ---------- Storage: private buckets, one folder per user -------------------
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false),
       ('logos',    'logos',    false)
on conflict (id) do nothing;

create policy "chrono own files read" on storage.objects for select to authenticated
  using (bucket_id in ('invoices', 'logos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "chrono own files insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('invoices', 'logos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "chrono own files update" on storage.objects for update to authenticated
  using (bucket_id in ('invoices', 'logos')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('invoices', 'logos')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "chrono own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('invoices', 'logos')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
