import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import fs from "node:fs";
import path from "node:path";
import { formatAmount, fromColumn, percentOf } from "@/lib/money";
import type {
  AppLocale,
  Currency,
  InvoiceLineRow,
  InvoiceRow,
  PartySnapshot,
  TaxProfile,
} from "@/lib/database.types";

/**
 * DESIGN.md section 9. Invoices are printed and sent to clients, so they do not
 * use the dark theme: A4, white paper, text #12132A, one 1px #C8A04A rule under
 * the header and no other colour. Spectral 600 for the word Facture or Invoice
 * only; Hanken Grotesk everywhere else.
 */
const FONT_DIR = path.join(process.cwd(), "src", "fonts");

/**
 * TTF, not the woff2 the app uses: @react-pdf/renderer cannot parse woff2.
 *
 * The bytes are read here and handed over directly. Giving it a file path
 * works under plain Node but fails with "Unknown font format" inside the
 * Next.js server runtime, which resolves the src differently.
 */
let registered = false;
function registerFonts() {
  if (registered) return;
  // A base64 data URI: a string, which is what the types want, and it carries
  // the bytes so nothing has to resolve a path at render time.
  const read = (file: string) =>
    `data:font/ttf;base64,${fs.readFileSync(path.join(FONT_DIR, file)).toString("base64")}`;

  // Two static instances cut from the variable font. Registering the variable
  // file twice does not work: react-pdf ignores fontWeight on it and embeds
  // only the regular, so nothing renders semibold.
  Font.register({
    family: "Hanken",
    fonts: [
      { src: read("HankenGrotesk-Regular.ttf"), fontWeight: 400 },
      { src: read("HankenGrotesk-SemiBold.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Spectral",
    fonts: [{ src: read("Spectral-SemiBold.ttf"), fontWeight: 600 }],
  });
  registered = true;
}

/** Quantities are counts, not money: never the currency's decimals, or 8 days
 *  in TND would read as "8,000". */
function formatQuantity(value: bigint, locale: AppLocale): string {
  const whole = value / 1000n;
  const fraction = Number(value % 1000n) / 1000;
  const n = Number(whole) + fraction;
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    maximumFractionDigits: 2,
  }).format(n);
}

const INK = "#12132A";
const RULE = "#C8A04A";
const HAIRLINE = "#DCDCE6";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: INK,
    fontFamily: "Hanken",
    fontSize: 9,
    lineHeight: 1.5,
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 40,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between" },
  sellerBlock: { width: "55%" },
  logo: { height: 36, maxWidth: 160, objectFit: "contain", marginBottom: 8 },
  titleBlock: { width: "40%", alignItems: "flex-end" },
  title: { fontFamily: "Spectral", fontWeight: 600, fontSize: 20, lineHeight: 1.2, marginBottom: 4 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginTop: 14, marginBottom: 18 },
  label: { fontSize: 8 },
  strong: { fontWeight: 600 },
  buyerBlock: { marginBottom: 18 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingBottom: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
    paddingVertical: 5,
  },
  cDesc: { width: "36%", paddingRight: 8 },
  cQty: { width: "9%", textAlign: "right", paddingRight: 6 },
  cUnit: { width: "9%", textAlign: "right", paddingRight: 6 },
  cPrice: { width: "18%", textAlign: "right", paddingRight: 6 },
  cVat: { width: "7%", textAlign: "right", paddingRight: 6 },
  cAmount: { width: "21%", textAlign: "right" },
  totals: { marginTop: 14, alignSelf: "flex-end", width: "48%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
  },
  // Flows after the totals rather than being pinned absolutely: an absolute,
  // fixed footer rendered nothing here, and DESIGN.md only asks for the block
  // to be in the footer, not glued to the page edge.
  footer: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    fontSize: 8,
  },
  mention: { marginTop: 2 },
});

interface Strings {
  invoice: string;
  number: string;
  issueDate: string;
  dueDate: string;
  seller: string;
  buyer: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vat: string;
  amount: string;
  subtotal: string;
  stampDuty: string;
  withholding: string;
  total: string;
  netToPay: string;
  taxId: string;
  vatNumber: string;
  iban: string;
  paymentTerms: string;
  page: string;
  units: Record<string, string>;
}

function line(party: PartySnapshot | null, key: keyof PartySnapshot): string | null {
  const value = party?.[key];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function formatDate(value: string, locale: AppLocale): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(y, (m ?? 1) - 1, d ?? 1));
}

export function InvoiceDocument({
  invoice,
  lines,
  strings,
  locale,
  mentions,
  logo,
}: {
  invoice: InvoiceRow;
  lines: InvoiceLineRow[];
  strings: Strings;
  locale: AppLocale;
  mentions: string[];
  /** The user's own logo, as bytes. DESIGN.md section 9: theirs, never ours. */
  logo?: Buffer | null;
}) {
  registerFonts();

  const currency = invoice.currency as Currency;
  const money = (value: bigint) => formatAmount(value, currency, locale);

  const seller = invoice.seller_snapshot;
  const buyer = invoice.buyer_snapshot;

  // VAT grouped by rate: Tunisia allows several rates on one invoice.
  const vatByRate = new Map<string, bigint>();
  let subtotal = 0n;
  for (const row of lines) {
    const amount = fromColumn(row.line_total);
    subtotal += amount;
    const rate = row.tax_rate;
    vatByRate.set(rate, (vatByRate.get(rate) ?? 0n) + percentOf(amount, fromColumn(rate) / 10n));
  }

  const taxTotal = [...vatByRate.values()].reduce((a, b) => a + b, 0n);
  const stamp = fromColumn(invoice.stamp_duty);
  const withholding = fromColumn(invoice.withholding);
  const total = subtotal + taxTotal + stamp - withholding;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.sellerBlock}>
            {/* react-pdf's Image, not an HTML img: a PDF image has no alt
                attribute, so the a11y rule does not apply here. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <Text style={styles.strong}>{line(seller, "legal_name") ?? ""}</Text>
            {line(seller, "address")
              ?.split("\n")
              .map((part, i) => <Text key={i}>{part}</Text>)}
            {line(seller, "tax_id") ? (
              <Text>
                {strings.taxId}: {line(seller, "tax_id")}
              </Text>
            ) : null}
            {line(seller, "vat_number") ? (
              <Text>
                {strings.vatNumber}: {line(seller, "vat_number")}
              </Text>
            ) : null}
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>{strings.invoice}</Text>
            <Text style={styles.strong}>{invoice.number ?? ""}</Text>
            <Text>
              {strings.issueDate}: {formatDate(invoice.issue_date, locale)}
            </Text>
            <Text>
              {strings.dueDate}: {formatDate(invoice.due_date, locale)}
            </Text>
          </View>
        </View>

        <View style={styles.rule} />

        <View style={styles.buyerBlock}>
          <Text style={styles.label}>{strings.buyer}</Text>
          <Text style={styles.strong}>{line(buyer, "name") ?? ""}</Text>
          {line(buyer, "address")
            ?.split("\n")
            .map((part, i) => <Text key={i}>{part}</Text>)}
          {line(buyer, "tax_id") ? (
            <Text>
              {strings.taxId}: {line(buyer, "tax_id")}
            </Text>
          ) : null}
          {line(buyer, "vat_number") ? (
            <Text>
              {strings.vatNumber}: {line(buyer, "vat_number")}
            </Text>
          ) : null}
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.cDesc, styles.label]}>{strings.description}</Text>
          <Text style={[styles.cQty, styles.label]}>{strings.quantity}</Text>
          <Text style={[styles.cUnit, styles.label]}>{strings.unit}</Text>
          <Text style={[styles.cPrice, styles.label]}>{strings.unitPrice}</Text>
          <Text style={[styles.cVat, styles.label]}>{strings.vat}</Text>
          <Text style={[styles.cAmount, styles.label]}>{strings.amount}</Text>
        </View>

        {lines.map((row) => (
          <View key={row.id} style={styles.row} wrap={false}>
            <Text style={styles.cDesc}>{row.description}</Text>
            <Text style={styles.cQty}>{formatQuantity(fromColumn(row.quantity), locale)}</Text>
            <Text style={styles.cUnit}>{strings.units[row.unit] ?? row.unit}</Text>
            <Text style={styles.cPrice}>{money(fromColumn(row.unit_price))}</Text>
            <Text style={styles.cVat}>{fromColumn(row.tax_rate) === 0n ? "—" : row.tax_rate}</Text>
            <Text style={styles.cAmount}>{money(fromColumn(row.line_total))}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>{strings.subtotal}</Text>
            <Text>{money(subtotal)}</Text>
          </View>

          {[...vatByRate.entries()]
            .filter(([, amount]) => amount > 0n)
            .map(([rate, amount]) => (
              <View key={rate} style={styles.totalRow}>
                <Text>
                  {strings.vat} {rate}%
                </Text>
                <Text>{money(amount)}</Text>
              </View>
            ))}

          {stamp > 0n ? (
            <View style={styles.totalRow}>
              <Text>{strings.stampDuty}</Text>
              <Text>{money(stamp)}</Text>
            </View>
          ) : null}

          {withholding > 0n ? (
            <View style={styles.totalRow}>
              <Text>{strings.withholding}</Text>
              <Text>-{money(withholding)}</Text>
            </View>
          ) : null}

          <View style={styles.grandTotal}>
            <Text style={styles.strong}>
              {withholding > 0n ? strings.netToPay : strings.total}
            </Text>
            <Text style={styles.strong}>
              {money(total)} {currency}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          {line(seller, "iban") ? (
            <Text>
              {strings.iban}: {line(seller, "iban")}
            </Text>
          ) : null}
          <Text>
            {strings.paymentTerms}: {formatDate(invoice.due_date, locale)}
          </Text>
          {mentions.map((mention, i) => (
            <Text key={i} style={styles.mention}>
              {mention}
            </Text>
          ))}
          {/* `fixed` is what gives a render callback the page numbers. */}
          <Text
            style={styles.mention}
            fixed
            render={({ pageNumber, totalPages }) =>
              `${strings.page} ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/** The legal mentions the tax profile requires, plus the user's own text. */
export function mentionsFor(
  taxProfile: TaxProfile,
  sellerCountry: string | null,
  buyerCountry: string | null,
  buyerVat: string | null,
  own: string | null,
  strings: { reverseCharge: string; latePenalty: string },
): string[] {
  const out: string[] = [];
  const crossBorderEu =
    taxProfile !== "tn" &&
    sellerCountry &&
    buyerCountry &&
    sellerCountry !== buyerCountry &&
    Boolean(buyerVat);

  if (crossBorderEu) out.push(strings.reverseCharge);
  if (taxProfile === "fr") out.push(strings.latePenalty);
  if (own && own.trim() !== "") out.push(own.trim());
  return out;
}
