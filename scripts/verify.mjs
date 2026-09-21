/**
 * Checks the live Supabase project named in your env file.
 *
 *   npm run verify
 *
 * It answers the questions you cannot see from the code: is Google sign-in
 * actually enabled, is `anon` really locked out of every table, did the
 * migration apply, are the buckets private. Read-only apart from nothing: it
 * writes no rows.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  "profiles", "clients", "projects", "project_status_history", "boards",
  "board_columns", "tasks", "time_entries", "leaves", "invoices",
  "invoice_lines", "invoice_counters",
];

let failures = 0;

function report(ok, label, detail = "") {
  if (!ok) failures++;
  const mark = ok ? "  ok  " : " FAIL ";
  console.log(`${mark} ${label.padEnd(48)} ${detail}`);
}

if (!url || !anon) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set.\n" +
    "Copy .env.example to .env.local and fill it in (see README.md).",
  );
  process.exit(1);
}

console.log(`\nProject ${url}\n`);

// --- Auth providers ---------------------------------------------------------
try {
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anon } });
  const settings = await res.json();
  const external = settings?.external ?? {};

  report(
    external.google === true,
    "Google sign-in is enabled",
    external.google === true
      ? ""
      : "turn it on: Authentication > Providers > Google",
  );

  const extras = Object.entries(external)
    .filter(([name, on]) => on === true && name !== "google")
    .map(([name]) => name);
  report(
    extras.length === 0,
    "no other sign-in provider is enabled",
    extras.length ? `also on: ${extras.join(", ")}` : "",
  );
} catch (error) {
  report(false, "auth settings readable", error.message);
}

// --- anon must be refused everywhere ---------------------------------------
// Send both headers so PostgREST authenticates as `anon`: a refusal then means
// privileges were revoked, not that a header was missing.
const anonHeaders = { apikey: anon, Authorization: `Bearer ${anon}` };
const reachable = [];

for (const table of TABLES) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers: anonHeaders });
  const body = await res.text();
  if (res.ok || !/permission denied/i.test(body)) {
    reachable.push(`${table} (HTTP ${res.status})`);
  }
}
report(
  reachable.length === 0,
  `anon is refused on all ${TABLES.length} tables`,
  reachable.length ? `REACHABLE: ${reachable.join(", ")}` : `${TABLES.length}/${TABLES.length} refused`,
);

{
  const res = await fetch(`${url}/rest/v1/rpc/issue_invoice`, {
    method: "POST",
    headers: { ...anonHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ p_invoice_id: "00000000-0000-0000-0000-000000000000" }),
  });
  const body = await res.text();
  report(/permission denied/i.test(body), "anon cannot call issue_invoice()", `HTTP ${res.status}`);
}

// --- did the migration apply? ----------------------------------------------
if (service) {
  const serviceHeaders = { apikey: service, Authorization: `Bearer ${service}` };
  const missing = [];

  for (const table of TABLES) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, { headers: serviceHeaders });
    if (!res.ok) missing.push(table);
  }
  report(
    missing.length === 0,
    `all ${TABLES.length} tables exist`,
    missing.length ? `MISSING: ${missing.join(", ")}` : `${TABLES.length}/${TABLES.length} present`,
  );

  for (const [fn, args] of [
    ["issue_invoice", { p_invoice_id: "00000000-0000-0000-0000-000000000000" }],
    ["delete_account", {}],
  ]) {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { ...serviceHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    const body = await res.text();
    // Both are expected to fail. What matters is that PostgREST found them.
    const installed = !/PGRST202|Could not find the function/i.test(body);
    report(installed, `${fn}() is installed`, installed ? "" : body.slice(0, 100));
  }

  const res = await fetch(`${url}/storage/v1/bucket`, { headers: serviceHeaders });
  const buckets = res.ok ? await res.json() : [];
  const wanted = ["invoices", "logos"];
  const ok = wanted.every((n) => buckets.some((b) => b.name === n && b.public === false));
  const pub = buckets.filter((b) => b.public).map((b) => b.name);
  report(
    ok && pub.length === 0,
    "buckets invoices and logos exist and are private",
    pub.length ? `PUBLIC: ${pub.join(", ")}` : buckets.map((b) => b.name).join(", "),
  );
} else {
  console.log("  --   SUPABASE_SERVICE_ROLE_KEY not set, skipping the schema checks");
}

console.log(
  failures === 0
    ? "\nEverything checks out.\n"
    : `\n${failures} check${failures === 1 ? "" : "s"} failed.\n`,
);
process.exit(failures === 0 ? 0 : 1);
