-- =============================================================================
-- Chrono: RLS and database-rule check
--
-- Run in the Supabase SQL Editor after 0001_init.sql. It creates two throwaway
-- auth users, does everything a real client would do as each of them, and
-- prints one row per check. Every row must read ok = true.
--
-- The two users are deleted at the end. If a check crashes the script, the
-- whole thing rolls back and nothing is left behind.
--
-- Safe to re-run. Do not run it against a database that holds real data you
-- care about: it writes rows (inside its own users) before cleaning up.
-- =============================================================================

create temporary table if not exists rls_results (
  n          serial primary key,
  area       text,
  check_name text,
  ok         boolean,
  detail     text
);
truncate rls_results restart identity;
-- The script records its findings while impersonating each role, so every role
-- it switches into needs to be able to write to this table. anon included: the
-- signed-out checks record their result from inside an exception handler, which
-- still runs as anon.
grant all on rls_results to authenticated, anon;
grant usage, select on sequence rls_results_n_seq to authenticated, anon;

do $$
declare
  ua        uuid := gen_random_uuid();   -- user A, the owner
  ub        uuid := gen_random_uuid();   -- user B, the intruder
  v_client  uuid;
  v_project uuid;
  v_board   uuid;
  v_col     uuid;
  v_task    uuid;
  v_entry   uuid;
  v_entry2  uuid;
  v_inv     uuid;
  v_inv2    uuid;
  v_line    uuid;
  v_n       int;
  v_txt     text;
  v_num     text;
  v_total   numeric;
  v_year    int := extract(year from current_date)::int;

  v_buyer   text;
begin
  -- ------------------------------------------------------------------ setup
  insert into auth.users
    (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', ua, 'authenticated', 'authenticated',
     'rls-a-' || left(ua::text, 8) || '@chrono.test',
     '{"provider":"google"}'::jsonb, '{"full_name":"Salma Ben Youssef"}'::jsonb, now(), now()),
    ('00000000-0000-0000-0000-000000000000', ub, 'authenticated', 'authenticated',
     'rls-b-' || left(ub::text, 8) || '@chrono.test',
     '{"provider":"google"}'::jsonb, '{"full_name":"Marc Lefevre"}'::jsonb, now(), now());

  -- 1. the profile trigger
  select count(*) into v_n from public.profiles where id in (ua, ub);
  insert into rls_results (area, check_name, ok, detail)
  values ('triggers', 'signing up creates a profile row', v_n = 2, v_n || ' of 2 profiles');

  select display_name into v_txt from public.profiles where id = ua;
  insert into rls_results (area, check_name, ok, detail)
  values ('triggers', 'profile takes display_name from the Google metadata',
          v_txt = 'Salma Ben Youssef', coalesce(v_txt, 'null'));

  update public.profiles set invoice_prefix = 'FA', payment_terms_days = 30,
         legal_name = 'Salma Ben Youssef', address = '12 rue de Marseille, Tunis',
         tax_id = '1234567/A/M/000', country = 'TN', tax_profile = 'tn',
         iban = 'TN59 1000 6035 1835 9847 8831'
  where id = ua;

  -- =======================================================================
  -- as user A
  -- =======================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', ua::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.clients (name, email, country, currency, tax_id)
  values ('Studio Kahena', 'contact@studiokahena.tn', 'TN', 'TND', '9876543/B/N/000')
  returning id into v_client;

  insert into rls_results (area, check_name, ok, detail)
  values ('ownership', 'insert fills user_id from auth.uid()',
          (select user_id from public.clients where id = v_client) = ua, 'clients.user_id');

  insert into public.projects (client_id, name, rate_type, rate_amount, currency, start_date)
  values (v_client, 'Refonte du site vitrine', 'daily', 600, 'TND', current_date - 40)
  returning id into v_project;

  -- 2. project side effects
  select count(*) into v_n from public.project_status_history where project_id = v_project;
  insert into rls_results (area, check_name, ok, detail)
  values ('triggers', 'creating a project writes a status history row', v_n = 1, v_n || ' rows');

  select id into v_board from public.boards where project_id = v_project;
  select count(*) into v_n from public.board_columns where board_id = v_board;
  insert into rls_results (area, check_name, ok, detail)
  values ('triggers', 'creating a project creates a board with three columns',
          v_board is not null and v_n = 3, coalesce(v_n, 0) || ' columns');

  update public.projects set status = 'paused' where id = v_project;
  update public.projects set status = 'active' where id = v_project;
  select count(*) into v_n from public.project_status_history where project_id = v_project;
  insert into rls_results (area, check_name, ok, detail)
  values ('triggers', 'each status change appends to the history', v_n = 3, v_n || ' rows');

  -- 3. a task must live in a column of its own project
  select id into v_col from public.board_columns where board_id = v_board and name = 'To do';
  insert into public.tasks (project_id, column_id, title, estimate_minutes)
  values (v_project, v_col, 'Maquette de la page d''accueil', 480)
  returning id into v_task;

  insert into public.time_entries (project_id, task_id, entry_date, duration_minutes, description)
  values (v_project, v_task, current_date - 7, 480, 'Maquette et intégration')
  returning id into v_entry;

  insert into public.time_entries (project_id, entry_date, duration_minutes, description)
  values (v_project, current_date - 6, 240, 'Retours client')
  returning id into v_entry2;

  insert into public.leaves (type, start_date, end_date)
  values ('vacation', current_date + 10, current_date + 14);

  -- 4. invoice: draft, lines, attached time
  insert into public.invoices (client_id, currency, language, tax_profile, issue_date, due_date, stamp_duty)
  values (v_client, 'TND', 'fr', 'tn', current_date, current_date + 30, 1.000)
  returning id into v_inv;

  insert into public.invoice_lines (invoice_id, project_id, description, quantity, unit, unit_price, tax_rate)
  values (v_inv, v_project, 'Refonte du site vitrine', 1.5, 'day', 600, 19)
  returning id into v_line;

  update public.time_entries set invoice_id = v_inv where id in (v_entry, v_entry2);

  select line_total into v_total from public.invoice_lines where id = v_line;
  insert into rls_results (area, check_name, ok, detail)
  values ('money', 'line_total is computed by the database', v_total = 900.000, v_total::text);

  -- 5. a draft cannot be promoted by hand
  begin
    update public.invoices set status = 'issued' where id = v_inv;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'issuing by hand is refused', false, 'the update went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'issuing by hand is refused', true, sqlerrm);
  end;

  -- 6. issue_invoice()
  perform public.issue_invoice(v_inv);
  select number, total, status into v_num, v_total, v_txt
    from public.invoices where id = v_inv;

  insert into rls_results (area, check_name, ok, detail)
  values ('issue', 'number follows {prefix}-{year}-{0001}',
          v_num = 'FA-' || v_year || '-0001', coalesce(v_num, 'null'));

  insert into rls_results (area, check_name, ok, detail)
  values ('issue', 'status is issued', v_txt = 'issued', coalesce(v_txt, 'null'));

  -- 900 + 19% VAT (171) + 1 stamp duty = 1072.000
  insert into rls_results (area, check_name, ok, detail)
  values ('issue', 'totals are recomputed from the lines', v_total = 1072.000, v_total::text);

  select seller_snapshot ->> 'tax_id', buyer_snapshot ->> 'name'
    into v_txt, v_buyer from public.invoices where id = v_inv;
  insert into rls_results (area, check_name, ok, detail)
  values ('issue', 'seller and buyer are snapshotted',
          v_txt = '1234567/A/M/000' and v_buyer = 'Studio Kahena',
          coalesce(v_txt, 'null') || ' / ' || coalesce(v_buyer, 'null'));

  -- 7. gapless numbering
  insert into public.invoices (client_id, currency, language, tax_profile)
  values (v_client, 'TND', 'fr', 'tn') returning id into v_inv2;
  insert into public.invoice_lines (invoice_id, description, quantity, unit, unit_price, tax_rate)
  values (v_inv2, 'Maintenance mensuelle', 1, 'unit', 450, 19);
  perform public.issue_invoice(v_inv2);
  select number into v_num from public.invoices where id = v_inv2;
  insert into rls_results (area, check_name, ok, detail)
  values ('issue', 'the next invoice gets the next number, no gap',
          v_num = 'FA-' || v_year || '-0002', coalesce(v_num, 'null'));

  -- 8. the issued invoice is frozen
  begin
    update public.invoices set total = 1 where id = v_inv;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'editing an issued invoice is refused', false, 'the update went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'editing an issued invoice is refused', true, sqlerrm);
  end;

  begin
    delete from public.invoices where id = v_inv;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'deleting an issued invoice is refused', false, 'the delete went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'deleting an issued invoice is refused', true, sqlerrm);
  end;

  begin
    update public.invoice_lines set unit_price = 1 where id = v_line;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'editing a line of an issued invoice is refused', false, 'the update went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'editing a line of an issued invoice is refused', true, sqlerrm);
  end;

  begin
    insert into public.invoice_lines (invoice_id, description, quantity, unit, unit_price)
    values (v_inv, 'Ligne ajoutée après coup', 1, 'unit', 100);
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'adding a line to an issued invoice is refused', false, 'the insert went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'adding a line to an issued invoice is refused', true, sqlerrm);
  end;

  begin
    update public.time_entries set duration_minutes = 60 where id = v_entry;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'editing billed time is refused', false, 'the update went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'editing billed time is refused', true, sqlerrm);
  end;

  begin
    delete from public.time_entries where id = v_entry2;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'deleting billed time is refused', false, 'the delete went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'deleting billed time is refused', true, sqlerrm);
  end;

  -- 9. status only moves forward
  begin
    update public.invoices set status = 'draft' where id = v_inv;
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'an issued invoice cannot go back to draft', false, 'the update went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('invoice lock', 'an issued invoice cannot go back to draft', true, sqlerrm);
  end;

  update public.invoices set status = 'sent', sent_at = now() where id = v_inv;
  update public.invoices set status = 'paid', paid_at = now() where id = v_inv;
  select status into v_txt from public.invoices where id = v_inv;
  insert into rls_results (area, check_name, ok, detail)
  values ('invoice lock', 'issued to sent to paid is allowed', v_txt = 'paid', coalesce(v_txt, 'null'));

  -- 10. a task from another project cannot be attached to an entry
  begin
    insert into public.time_entries (project_id, task_id, entry_date, duration_minutes)
    values (v_project, gen_random_uuid(), current_date, 60);
    insert into rls_results (area, check_name, ok, detail)
    values ('consistency', 'a time entry cannot point at an unknown task', false, 'the insert went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('consistency', 'a time entry cannot point at an unknown task', true, sqlerrm);
  end;

  -- 11. storage paths
  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('invoices', ua::text || '/' || v_inv::text || '.pdf', ua);
    insert into rls_results (area, check_name, ok, detail)
    values ('storage', 'a user can write in their own folder', true, 'invoices/{uid}/...');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('storage', 'a user can write in their own folder', false, sqlerrm);
  end;

  begin
    insert into storage.objects (bucket_id, name, owner)
    values ('invoices', ub::text || '/stolen.pdf', ua);
    insert into rls_results (area, check_name, ok, detail)
    values ('storage', 'writing in another user''s folder is refused', false, 'the insert went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('storage', 'writing in another user''s folder is refused', true, sqlerrm);
  end;

  -- =======================================================================
  -- as user B: none of A's data exists
  -- =======================================================================
  perform set_config('request.jwt.claims',
    json_build_object('sub', ub::text, 'role', 'authenticated')::text, true);

  select count(*) into v_n from public.clients;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no clients', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.projects;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no projects', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.time_entries;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no time entries', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.leaves;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no leave', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.invoices;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no invoices', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.invoice_lines;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no invoice lines', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.tasks;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no tasks', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.invoice_counters;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'another user sees no invoice counters', v_n = 0, v_n || ' rows');

  select count(*) into v_n from public.profiles;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'a user sees only their own profile', v_n = 1, v_n || ' rows');

  -- writes by id are no-ops, not errors: the row is invisible
  update public.clients set name = 'Taken over' where id = v_client;
  get diagnostics v_n = row_count;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'updating another user''s client changes nothing', v_n = 0, v_n || ' rows');

  delete from public.projects where id = v_project;
  get diagnostics v_n = row_count;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'deleting another user''s project changes nothing', v_n = 0, v_n || ' rows');

  delete from public.time_entries where id = v_entry;
  get diagnostics v_n = row_count;
  insert into rls_results (area, check_name, ok, detail)
  values ('rls', 'deleting another user''s time entry changes nothing', v_n = 0, v_n || ' rows');

  -- the composite foreign key stops a cross-user reference
  begin
    insert into public.projects (client_id, name) values (v_client, 'Projet volé');
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'a project cannot point at another user''s client', false, 'the insert went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'a project cannot point at another user''s client', true, sqlerrm);
  end;

  -- forging user_id is refused by the with-check
  begin
    insert into public.leaves (user_id, type, start_date, end_date)
    values (ua, 'sick', current_date, current_date);
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'writing a row under another user_id is refused', false, 'the insert went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'writing a row under another user_id is refused', true, sqlerrm);
  end;

  -- issue_invoice is scoped to the caller even though it is security definer
  begin
    perform public.issue_invoice(v_inv2);
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'issue_invoice refuses another user''s invoice', false, 'the call went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'issue_invoice refuses another user''s invoice', true, sqlerrm);
  end;

  begin
    insert into public.invoice_counters (user_id, year, last_number) values (ub, v_year, 500);
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'the invoice counter is not writable from the app', false, 'the insert went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('rls', 'the invoice counter is not writable from the app', true, sqlerrm);
  end;

  begin
    select name into v_txt from storage.objects
    where bucket_id = 'invoices' and name like ua::text || '%' limit 1;
    insert into rls_results (area, check_name, ok, detail)
    values ('storage', 'another user cannot list your files', v_txt is null, coalesce(v_txt, 'nothing visible'));
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('storage', 'another user cannot list your files', true, sqlerrm);
  end;

  -- =======================================================================
  -- as anon: nothing at all
  -- =======================================================================
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';

  begin
    select count(*) into v_n from public.clients;
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor reads no clients', v_n = 0, v_n || ' rows');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor reads no clients', true, sqlerrm);
  end;

  begin
    select count(*) into v_n from public.invoices;
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor reads no invoices', v_n = 0, v_n || ' rows');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor reads no invoices', true, sqlerrm);
  end;

  begin
    perform public.issue_invoice(v_inv2);
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor cannot call issue_invoice', false, 'the call went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor cannot call issue_invoice', true, sqlerrm);
  end;

  begin
    perform public.delete_account();
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor cannot call delete_account', false, 'the call went through');
  exception when others then
    insert into rls_results (area, check_name, ok, detail)
    values ('anon', 'a signed-out visitor cannot call delete_account', true, sqlerrm);
  end;

  -- ---------------------------------------------------------------- cleanup
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  perform set_config('app.allow_locked_changes', 'on', true);
  delete from storage.objects where name like ua::text || '%' or name like ub::text || '%';
  delete from auth.users where id in (ua, ub);
  perform set_config('app.allow_locked_changes', 'off', true);

  select count(*) into v_n from public.invoices where user_id in (ua, ub);
  insert into rls_results (area, check_name, ok, detail)
  values ('cleanup', 'deleting the account removes the data', v_n = 0, v_n || ' rows left');
end $$;

select n, area, check_name, ok, detail from rls_results order by n;

select
  count(*) filter (where ok)       as passed,
  count(*) filter (where not ok)   as failed,
  case when count(*) filter (where not ok) = 0
       then 'RLS check passed'
       else 'RLS CHECK FAILED - read the rows above' end as verdict
from rls_results;
