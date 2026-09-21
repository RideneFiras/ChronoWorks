/**
 * Fills an account with a realistic freelancer's history.
 *
 *   npm run seed                      the only account, or --email to pick one
 *   npm run seed -- --reset           clear that account's rows first
 *   npm run seed -- --email a@b.com
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY, because it writes rows on behalf of a user
 * who is not signed in here. The key is server-side only and is never imported
 * by app code.
 *
 * Data: a Tunis-based freelancer billing in TND and EUR, with a project that
 * really was paused for two months, leave including public holidays in both
 * countries, a board with tasks, one issued invoice and one draft.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const reset = args.includes("--reset");
const emailArg = (() => {
  const i = args.indexOf("--email");
  return i >= 0 ? args[i + 1] : null;
})();

if (!url || !service) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local.\n" +
      "The service role key is under Project Settings > API Keys. Never prefix it with NEXT_PUBLIC_.",
  );
  process.exit(1);
}

const headers = {
  apikey: service,
  Authorization: `Bearer ${service}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, Prefer: "return=representation", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

/**
 * PostgREST refuses a bulk insert whose objects have different key sets
 * ("All object keys must match"), so every row is padded to the union of the
 * keys.
 *
 * Padding with null only works for nullable columns. For a NOT NULL column
 * with a default, an explicit null is a constraint violation rather than
 * "use the default", so those keys must be given a real value here.
 */
function sameShape(rows, defaults = {}) {
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  return rows.map((row) =>
    Object.fromEntries(
      keys.map((k) => [k, row[k] ?? (k in defaults ? defaults[k] : null)]),
    ),
  );
}

const insert = (table, rows, defaults) =>
  rest(table, { method: "POST", body: JSON.stringify(sameShape(rows, defaults)) });

// ---------------------------------------------------------------- the account
const admin = await fetch(`${url}/auth/v1/admin/users?per_page=200`, { headers });
const { users = [] } = await admin.json();

if (users.length === 0) {
  console.error("No account yet. Sign in with Google once, then run this again.");
  process.exit(1);
}

const user = emailArg
  ? users.find((u) => u.email?.toLowerCase() === emailArg.toLowerCase())
  : users.length === 1
    ? users[0]
    : null;

if (!user) {
  console.error(
    emailArg
      ? `No account for ${emailArg}.`
      : `Several accounts exist. Choose one with --email:\n` +
        users.map((u) => `  ${u.email}`).join("\n"),
  );
  process.exit(1);
}

const uid = user.id;
console.log(`\nSeeding ${user.email}\n`);

// ------------------------------------------------------------------- dates
const day = 24 * 60 * 60 * 1000;
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const ago = (n) => iso(new Date(today.getTime() - n * day));
const ahead = (n) => iso(new Date(today.getTime() + n * day));
const year = today.getFullYear();

// ------------------------------------------------------------------- reset
if (reset) {
  // Children first. Issued invoices are deliberately left alone: the database
  // refuses to delete them, which is the whole point of the lock.
  for (const table of [
    "time_entries",
    "tasks",
    "board_columns",
    "boards",
    "invoice_lines",
    "project_status_history",
    "leaves",
  ]) {
    await rest(`${table}?user_id=eq.${uid}`, { method: "DELETE" });
  }

  await rest(`invoices?user_id=eq.${uid}&status=eq.draft`, { method: "DELETE" });
  await rest(`projects?user_id=eq.${uid}`, { method: "DELETE" });

  // A client still referenced by a surviving invoice cannot go either, so keep
  // those and delete the rest.
  const surviving = await rest(`invoices?user_id=eq.${uid}&select=number,client_id`);
  const keep = new Set(surviving.map((i) => i.client_id));

  const clientRows = await rest(`clients?user_id=eq.${uid}&select=id`);
  for (const c of clientRows) {
    if (keep.has(c.id)) continue;
    await rest(`clients?id=eq.${c.id}`, { method: "DELETE" });
  }

  if (surviving.length) {
    console.log(
      `  kept ${surviving.length} issued invoice(s) and their client(s): ` +
        surviving.map((i) => i.number ?? "(no number)").join(", "),
    );
    console.log("  the database will not delete an issued invoice. See README, Seed data.");
  }
  console.log("  reset done");
}

// ----------------------------------------------------------------- profile
await rest(`profiles?id=eq.${uid}`, {
  method: "PATCH",
  body: JSON.stringify({
    locale: "fr",
    country: "TN",
    default_currency: "TND",
    tax_profile: "tn",
    legal_name: "Ridene Consulting",
    address: "14 rue du Lac Turkana\nLes Berges du Lac\n1053 Tunis",
    tax_id: "1789456/K/A/M/000",
    vat_number: "",
    iban: "TN59 1002 6064 1523 8891 4477",
    invoice_prefix: "FA",
    payment_terms_days: 30,
    hours_per_day: 8,
    legal_mentions:
      "Retenue à la source de 3 % applicable conformément au Code de l'IRPP et de l'IS. " +
      "Timbre fiscal de 1,000 TND inclus.",
  }),
});
console.log("  profile");

// ----------------------------------------------------------------- clients
/**
 * Reuse a client that is already there under the same name rather than adding
 * a second one. A client kept back by --reset (because an issued invoice still
 * points at it) would otherwise be duplicated on every run.
 */
async function upsertClients(rows) {
  const existing = await rest(`clients?user_id=eq.${uid}&select=id,name`);
  const byExistingName = new Map(existing.map((c) => [c.name, c.id]));
  const fresh = rows.filter((r) => !byExistingName.has(r.name));
  const updated = rows.filter((r) => byExistingName.has(r.name));

  for (const row of updated) {
    // user_id is fixed by ownership and must not be part of an update
    const patch = Object.fromEntries(
      Object.entries(row).filter(([k]) => k !== "user_id"),
    );
    await rest(`clients?id=eq.${byExistingName.get(row.name)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  }

  const inserted = fresh.length ? await insert("clients", fresh) : [];
  return [
    ...inserted,
    ...updated.map((r) => ({ id: byExistingName.get(r.name), name: r.name })),
  ];
}

const clients = await upsertClients([
  {
    user_id: uid,
    name: "Studio Kahena",
    email: "contact@studiokahena.tn",
    address: "6 rue d'Alger\n1000 Tunis",
    country: "TN",
    tax_id: "1204558/B/N/000",
    currency: "TND",
    invoice_language: "fr",
    notes: "Agence de design. Interlocuteur : Nadia, direction artistique.",
  },
  {
    user_id: uid,
    name: "Coopérative oléicole de Sfax",
    email: "administration@oleicole-sfax.tn",
    address: "Route de Gabès km 4\n3052 Sfax",
    country: "TN",
    tax_id: "0876321/D/C/000",
    currency: "TND",
    invoice_language: "fr",
    notes: "Paiement par virement, délai réel plutôt 45 jours.",
  },
  {
    user_id: uid,
    name: "Atelier Beaumont",
    email: "compta@atelier-beaumont.fr",
    address: "27 rue de la Charité\n69002 Lyon",
    country: "FR",
    tax_id: "84219637400028",
    vat_number: "FR64842196374",
    currency: "EUR",
    invoice_language: "fr",
  },
  {
    user_id: uid,
    name: "Nordwind Labs GmbH",
    email: "invoices@nordwindlabs.de",
    address: "Prinzessinnenstraße 20\n10969 Berlin",
    country: "DE",
    vat_number: "DE311047255",
    currency: "EUR",
    invoice_language: "en",
    notes: "Reverse charge: VAT accounted for by the customer.",
  },
]);
const byName = Object.fromEntries(clients.map((c) => [c.name, c.id]));
console.log(`  ${clients.length} clients`);

// ---------------------------------------------------------------- projects
const projects = await insert("projects", [
  {
    user_id: uid,
    client_id: byName["Studio Kahena"],
    name: "Refonte du site vitrine",
    description: "Nouvelle identité, 8 pages, intégration et mise en ligne.",
    status: "active",
    rate_type: "daily",
    rate_amount: "650.000",
    currency: "TND",
    start_date: ago(96),
  },
  {
    user_id: uid,
    client_id: byName["Coopérative oléicole de Sfax"],
    name: "Plateforme de suivi des récoltes",
    description: "Saisie terrain, tableau de bord, export comptable.",
    status: "active",
    rate_type: "daily",
    rate_amount: "700.000",
    currency: "TND",
    start_date: ago(172),
  },
  {
    user_id: uid,
    client_id: byName["Atelier Beaumont"],
    name: "Boutique en ligne",
    description: "Catalogue, panier, paiement, back-office.",
    status: "active",
    rate_type: "daily",
    rate_amount: "480.000",
    currency: "EUR",
    start_date: ago(54),
  },
  {
    user_id: uid,
    client_id: byName["Atelier Beaumont"],
    name: "Maintenance mensuelle",
    status: "active",
    rate_type: "hourly",
    rate_amount: "65.000",
    currency: "EUR",
    start_date: ago(400),
  },
  {
    user_id: uid,
    client_id: byName["Nordwind Labs GmbH"],
    name: "Design system audit",
    description: "Component inventory, accessibility review, written report.",
    status: "done",
    rate_type: "fixed",
    rate_amount: "4200.000",
    currency: "EUR",
    start_date: ago(250),
    end_date: ago(210),
  },
]);
const proj = Object.fromEntries(projects.map((p) => [p.name, p]));
console.log(`  ${projects.length} projects`);

/**
 * A real paused period. The trigger writes a history row on each status
 * change; we then backdate those rows so the project reads as paused from one
 * date to another rather than all today.
 */
async function backdate(projectId, plan) {
  for (const step of plan) {
    if (step.status) {
      await rest(`projects?id=eq.${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: step.status }),
      });
    }
  }
  const rows = await rest(
    `project_status_history?project_id=eq.${projectId}&select=id,status&order=created_at.asc`,
  );
  for (let i = 0; i < rows.length && i < plan.length; i++) {
    await rest(`project_status_history?id=eq.${rows[i].id}`, {
      method: "PATCH",
      body: JSON.stringify({ changed_on: plan[i].on, note: plan[i].note ?? null }),
    });
  }
}

await backdate(proj["Plateforme de suivi des récoltes"].id, [
  { on: ago(172) },
  { status: "paused", on: ago(118), note: "Budget gelé jusqu'à la fin de la récolte." },
  { status: "active", on: ago(57), note: "Reprise, périmètre réduit." },
]);
await backdate(proj["Design system audit"].id, [
  { on: ago(250) },
  { status: "done", on: ago(210), note: "Report delivered and accepted." },
]);
console.log("  status history backdated (one real paused period)");

// --------------------------------------------------------- board and tasks
const board = (
  await rest(`boards?project_id=eq.${proj["Refonte du site vitrine"].id}&select=id`)
)[0];
const columns = await rest(
  `board_columns?board_id=eq.${board.id}&select=id,name&order=position.asc`,
);
const col = Object.fromEntries(columns.map((c) => [c.name, c.id]));

const tasks = await insert(
  "tasks",
  [
    ["Maquette de la page d'accueil", "Done", 480, ago(30)],
    ["Intégration des gabarits", "Done", 960, ago(18)],
    ["Formulaire de contact", "In progress", 240, ahead(3)],
    ["Optimisation des images", "In progress", 180, ahead(6)],
    ["Rédaction des mentions légales", "To do", 120, ahead(11)],
    ["Recette avant mise en ligne", "To do", 300, ahead(16)],
  ].map(([title, column, estimate, due], i) => ({
    user_id: uid,
    project_id: proj["Refonte du site vitrine"].id,
    column_id: col[column],
    title,
    estimate_minutes: estimate,
    due_date: due,
    position: i + 1,
    completed_at: column === "Done" ? new Date().toISOString() : null,
  })),
);
console.log(`  ${tasks.length} tasks on one board`);

// ------------------------------------------------------------ time entries
const entries = [];
const push = (project, daysAgo, minutes, description, taskId = null) => {
  const d = new Date(today.getTime() - daysAgo * day);
  const weekday = d.getDay();
  if (weekday === 0 || weekday === 6) return; // freelancers rest too
  entries.push({
    user_id: uid,
    project_id: project.id,
    task_id: taskId,
    entry_date: iso(d),
    duration_minutes: minutes,
    description,
    is_billable: true,
  });
};

const kahenaTask = tasks.find((t) => t.title === "Intégration des gabarits");
for (let d = 1; d <= 34; d++) {
  if (d % 3 === 0) push(proj["Refonte du site vitrine"], d, 480, "Intégration", kahenaTask?.id);
  if (d % 4 === 0) push(proj["Boutique en ligne"], d, 420, "Catalogue et panier");
  if (d % 7 === 0) push(proj["Maintenance mensuelle"], d, 120, "Correctifs et mises à jour");
  if (d % 5 === 0 && d > 10) {
    push(proj["Plateforme de suivi des récoltes"], d, 360, "Saisie terrain");
  }
}
await insert("time_entries", entries);
console.log(`  ${entries.length} time entries over the last five weeks`);

// -------------------------------------------------------------------- leave
await insert("leaves", [
  {
    user_id: uid,
    type: "vacation",
    start_date: ago(44),
    end_date: ago(37),
    note: "Congés d'été",
  },
  { user_id: uid, type: "sick", start_date: ago(23), end_date: ago(23) },
  {
    user_id: uid,
    type: "public_holiday",
    start_date: `${year}-03-20`,
    end_date: `${year}-03-20`,
    note: "Fête de l'Indépendance",
  },
  {
    user_id: uid,
    type: "public_holiday",
    start_date: `${year}-07-25`,
    end_date: `${year}-07-25`,
    note: "Fête de la République",
  },
  {
    user_id: uid,
    type: "other",
    start_date: ahead(9),
    end_date: ahead(9),
    start_half: true,
    end_half: true,
    note: "Rendez-vous comptable",
  },
  { user_id: uid, type: "vacation", start_date: ahead(26), end_date: ahead(33) },
], { start_half: false, end_half: false });
console.log("  leave, including public holidays and a half day");

// ----------------------------------------------------------------- invoices
// Drafts only, on purpose.
//
// An invoice can only become "issued" through issue_invoice(), which reads
// auth.uid() and so needs a signed-in user. The service role used here has no
// auth.uid(), and the triggers refuse every shortcut: a row inserted as issued
// has unwritable lines, and promoting a draft by hand raises "Use
// issue_invoice() to issue an invoice".
//
// That is the guarantee working as intended, so the seed stops at the draft
// and you issue it from the app. Doing it that way exercises the numbering,
// the recomputed totals and the seller and buyer snapshot for real.
const [draftTnd] = await insert("invoices", [
  {
    user_id: uid,
    client_id: byName["Studio Kahena"],
    currency: "TND",
    language: "fr",
    tax_profile: "tn",
    issue_date: iso(today),
    due_date: ahead(30),
    stamp_duty: "1.000",
    notes: "Merci de régler par virement.",
  },
]);

const [draftEur] = await insert("invoices", [
  {
    user_id: uid,
    client_id: byName["Atelier Beaumont"],
    currency: "EUR",
    language: "fr",
    tax_profile: "fr",
    issue_date: ago(38),
    due_date: ago(8),
  },
]);

await insert("invoice_lines", [
  {
    user_id: uid,
    invoice_id: draftTnd.id,
    project_id: proj["Refonte du site vitrine"].id,
    position: 1,
    description: "Refonte du site vitrine — intégration",
    quantity: "8.000",
    unit: "day",
    unit_price: "650.000",
    tax_rate: "19.00",
  },
  {
    user_id: uid,
    invoice_id: draftTnd.id,
    project_id: proj["Refonte du site vitrine"].id,
    position: 2,
    description: "Reprise des visuels",
    quantity: "2.500",
    unit: "day",
    unit_price: "650.000",
    tax_rate: "19.00",
  },
  {
    user_id: uid,
    invoice_id: draftEur.id,
    project_id: proj["Boutique en ligne"].id,
    position: 1,
    description: "Boutique en ligne — développement",
    quantity: "12.000",
    unit: "day",
    unit_price: "480.000",
    tax_rate: "20.00",
  },
]);
console.log("  2 draft invoices with lines, ready to issue from the app");

console.log("\nDone. Reload the app.\n");
