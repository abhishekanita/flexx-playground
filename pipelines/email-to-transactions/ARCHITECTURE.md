# Email-to-Transactions Pipeline — Architecture & Implementation Notes

## Overview

This pipeline turns raw financial data (emails, bank statements, UPI statements) into enriched, reconciled transactions with a spending dashboard. It's a multi-stage ETL pipeline with signal-based enrichment.

```
Gmail Inbox ─→ Email Sync ─→ Parser Matching ─→ Normalizer ─→ Enrichment/Matcher ─→ Transaction DB
                                                                                          │
PDF Statements ─→ Manual Import ─→ Parser ─→ Normalizer ────────────────────────────────→─┘
                                                                                          │
                                                                                          ↓
                                                                              Dashboard Data Generator
                                                                                          │
                                                                                          ↓
                                                                              spending-dashboard.html
```

---

## Pipeline Stages

### Stage 1: Email Sync (`src/pipelines/email-sync/`)

**What it does:** Fetches emails from Gmail via API, stores raw content in MongoDB.

- Entry: `email-sync.stage.ts`
- Uses `GmailPlugin` (`src/plugins/gmail.plugin.ts`) for API access
- Stores emails in `raw_emails` collection via `rawEmailsService`
- Each email gets: `fromAddress`, `subject`, `bodyText`, `bodyHtml`, `attachments[]`, `receivedAt`, `gmailMessageId`
- Attachments are NOT downloaded at this stage — only metadata (filename, mimeType, gmailAttachmentId)
- Status: `fetched` (new email stored)

### Stage 2: Parser Matching (`src/pipelines/parsers/`)

**What it does:** Matches each raw email to a parser config, extracts structured data.

#### Parser Registry (`src/pipelines/parsers/helpers/parser-registry.ts`)

Central registry of all parser configs. Each config has:
```typescript
{
    id: 'swiggy_food',           // unique slug
    name: 'Swiggy Food Order',   // human label
    filter: {
        fromAddress: /no-?reply@swiggy\.in/i,
        subject: /^(?!.*instamart).*order was.*delivered/i, // negative lookahead!
    },
    pdf: {                        // only for PDF-based parsers
        pickAttachment: att => att.mimeType === 'application/pdf',
        passwords: ['password1', 'password2'],
    },
    parse: text => parseSwiggyFood(text),
}
```

**IMPORTANT — Config Matching Order:**
Configs are stored in MongoDB (`parser_configs` collection) and loaded via `parserConfigService.getActiveConfigs()`. They're returned in `_id` order (insertion order), NOT the order they appear in the registry file. If two configs can match the same email, the one inserted first wins. To fix priority conflicts, use regex exclusions (e.g., negative lookahead `(?!.*instamart)`) rather than relying on config order.

#### Parser Types

**PDF-based parsers** (bank statements, some invoices):
- Attachment downloaded via Gmail API at parse time
- PDF extracted with `pdf-parse` v2: `new PDFParse({ data: new Uint8Array(buffer), password })` → `.getText()` → `.destroy()`
- Password-protected PDFs try multiple passwords from config

**Body-text parsers** (email invoices, alerts):
- Parse `bodyText` or `bodyHtml` directly
- Used for: Swiggy orders, Uber trips, PhonePe alerts, Apple invoices

**Declarative parsers** (simple regex):
- Config specifies a regex pattern + field names
- Matches are auto-extracted without a custom parser function
- Used for: PhonePe transaction alerts

#### Existing Parsers

| Parser | Type | Source | Key Fields |
|--------|------|--------|------------|
| `sbi-statement` | PDF | SBI bank statement | account_no, transactions[], balances |
| `kotak-statement` | PDF | Kotak bank statement | account_no, transactions[], balances |
| `phonepe-statement` | PDF | PhonePe UPI statement | transactions[] with txnId, utrNo, direction |
| `paytm-statement` | PDF | Paytm UPI history | transactions[] |
| `swiggy-food` | Body | Swiggy delivery email | orderId, items[], total, fees |
| `swiggy-instamart` | Body | Swiggy Instamart email | orderId, items[], total |
| `uber-trip` | Body | Uber receipt email | tripId, fare breakdown, route |
| `makemytrip-flight` | Body | MMT booking email | pnr, route, travel_date, passengers |
| `apple-invoice` | Body | Apple receipt | items[], total |

**Email status flow:** `fetched` → `parsed` (parser matched, data extracted) → `inserted` (transaction created in DB). Both `parsed` and `inserted` emails have `parsedData.rawExtracted`.

### Stage 3: Enrichment (`src/pipelines/enrichment/`)

**What it does:** Converts parsed data into normalized transaction signals, then matches/merges them into the canonical transaction.

#### Normalizers (`src/pipelines/enrichment/normalizers/`)

Each normalizer converts parser-specific output into a `NormalizedSignal`:

```typescript
interface NormalizedSignal {
    userId: string;
    amount: number;
    type: 'debit' | 'credit';
    txDate: Date;
    channel: TransactionChannel;
    category: TransactionCategory;
    merchantName?: string;
    accountLast4?: string;
    upiRef?: string;
    neftUtr?: string;
    impsRef?: string;
    merchantOrderId?: string;
    rawNarration?: string;
    context?: Record<string, any>;
    enrichmentScoreDelta: number;
}
```

**Normalizer types:**
- `bank-statement.normalizer.ts` — SBI/Kotak statements → narration parsing, channel detection from narration prefixes (UPI/, NEFT/, IMPS/)
- `invoice.normalizer.ts` — Swiggy, Uber, MMT invoices → merchant + order details + item-level context
- `upi-statement.normalizer.ts` — PhonePe/Paytm UPI statements → UPI ref matching, UPI Lite classification

#### UPI Lite Classification

PhonePe statement transactions are classified into UPI vs UPI Lite:

```
txnId starts with 'W'          → wallet_load (UPI Lite load from bank)
amount ≤ 1000 && acct == 4051  → UPI Lite spend (off-bank micro-payment)
everything else                 → regular UPI
```

UPI Lite wallet loads: `channel: UPI_LITE`, `category: transfer`, `subCategory: upi_lite_load`
UPI Lite spends: `channel: UPI_LITE`, higher `enrichmentScoreDelta: 22` (vs 19 for regular UPI)

UPI Lite is a wallet feature where transactions ≤Rs.1000 don't hit the bank account. Banks only see the wallet top-ups (Rs.2000 each), not individual spends. This means these transactions are invisible to bank statement parsing — they only appear in PhonePe UPI statement data.

#### Matcher (`src/pipelines/enrichment/matcher.ts`)

7-pass matching algorithm to find or create the canonical transaction:

1. **UPI Reference** — exact match on UPI transaction reference (confidence: 1.0)
2. **NEFT UTR** — exact match on NEFT UTR number (confidence: 1.0)
3. **IMPS Reference** — exact match on IMPS reference (confidence: 0.98)
4. **Merchant Order ID** — Swiggy/Uber order ID match (confidence: 0.97)
5. **Fingerprint** — SHA256 of `userId|amount|dateHour|accountLast4` (dedup check)
6. **Amount + Date Window** — fuzzy match: same amount ±Rs.1, within ±12 hours, same account (confidence: 0.85)
7. **Create New** — no match found, create fresh transaction

Each signal that matches an existing transaction ENRICHES it (adds context, bumps enrichment score, potentially reconciles). A transaction with bank statement + email invoice + UPI statement signals is fully reconciled.

#### Enrichment Score

Each signal source contributes a score delta:
- Bank statement: ~19 points
- UPI statement: ~19 points (22 for UPI Lite)
- Email invoice: ~44 points (highest — richest data)

Higher scores = more enriched transactions. Multi-signal transactions have scores like 38-66+.

#### Uber Fuzzy Matching

Uber rides often have tips/roundups where the UPI payment is higher than the invoice amount. Special fuzzy matching:
- Invoice amount ≤ bank amount ≤ invoice × 1.35
- Within ±4 hours
- Matched against ALL bank/UPI debit transactions, not just unmatched ones

### Stage 4: Dashboard (`src/scripts/scripts/generate-dashboard-data.ts`)

**What it does:** Queries the enriched `transactions` collection, computes aggregates, outputs `spending-dashboard-data.json` which gets embedded into `spending-dashboard.html`.

#### Source Label Logic

The `getSourceLabel()` function maps transactions to display labels:

```
channel === 'UPI_LITE'     → 'PhonePe UPI Lite'
account_last4 === '4051'   → 'SBI A/c 4051'
account_last4 === '9778'   → 'Kotak A/c 9778'
account_last4 === '7214'   → 'SBI A/c 7214'
channel === 'NACH'         → 'Auto-Debit (NACH)'
upi_app === 'PhonePe'      → 'PhonePe UPI'
upi_app === 'Paytm'        → 'Paytm UPI'
no account_last4            → 'Email Invoices'  (invoice-only transactions)
```

#### Spending vs Non-Spending

Categories excluded from "spending" analysis (they're transfers/financial, not consumption):
`transfer`, `atm_withdrawal`, `investment`, `salary`, `credit_card_bill`, `rent`

UPI Lite wallet loads (`sub_category: upi_lite_load`) should also be excluded — they're wallet top-ups, not actual spending.

#### Dashboard Tabs

1. **Overall** — aggregate metrics, category donut, monthly trend, source/merchant tables
2. **Monthly tabs** (Mar 2026, Feb 2026, ...) — per-month drilldown with daily timeline, full transaction table (sortable/filterable), category breakdown
3. **Folders** — custom transaction groupings with rules-based matching
4. **Insights** — health score, personality, merchant leaderboard, weekday/hourly heatmaps, top items, what-if scenarios
5. **Lifestyle** — actionable optimization opportunities (see below)

#### Lifestyle Optimization Tab

Computes potential savings from smarter subscriptions and timing:

| Insight | Method | Key Assumptions |
|---------|--------|-----------------|
| Late booking premium | `60 - leadDays` / 10 × 10% multiplier | Flights 60 days early = baseline; each 10 days closer = +10% cost |
| Swiggy HDFC Card | 10% cashback on total Swiggy spend | Rs.500/year fee |
| Swiggy One | Saved delivery + 50% platform fees vs Rs.1,499/year | Only counts orders with fee data in context |
| Uber Pass | 15% savings on rides - Rs.149/month | Worth it if savings > cost |
| Netflix Annual | 17% discount vs monthly | Assumes current monthly price continues |
| Bulk Buying | 25% savings on items bought 10+ times | Conservative estimate; varies by product |
| Small Order Tax | Batch 2 orders → save Rs.20 platform fee | Rs.200 threshold for "small" |

Data note: Flight lead days currently unreliable because `booked_on` date is often missing from email parser — falls back to `tx_date` which IS the booking date, and `travel_date` parsing can be off. Needs verification against actual email content.

---

## Data Model

### Transaction (MongoDB: `transactions`)

```typescript
{
    _id: ObjectId,
    user_id: string,
    amount: number,
    type: 'debit' | 'credit',
    tx_date: Date,
    channel: TransactionChannel,       // UPI, NEFT, IMPS, UPI_LITE, etc.
    category: TransactionCategory,     // food_delivery, cab_ride, etc.
    sub_category?: string,             // e.g. 'upi_lite_load'
    merchant_name?: string,
    raw_narration?: string,
    account_last4?: string,            // bank account last 4 digits
    upi_ref?: string,                  // UPI transaction reference
    neft_utr?: string,
    imps_ref?: string,
    merchant_order_id?: string,        // Swiggy/Uber order ID
    upi_app?: UpiApp,                  // PhonePe, GooglePay, etc.
    fingerprint: string,               // dedup hash
    signal_count: number,              // how many signals contributed
    enrichment_score: number,          // quality score (higher = better)
    reconciled: boolean,               // confirmed by bank statement
    context?: {                        // rich data from email parsers
        swiggy?: { items, fees, restaurant, ... },
        uber?: { route, distance, surge, ... },
        flight?: { pnr, route, travel_date, ... },
        phonepe?: { txnId, utrNo, ... },
    },
}
```

### Transaction Signal (MongoDB: `transaction_signals`)

```typescript
{
    _id: ObjectId,
    transaction_id: ObjectId,
    user_id: string,
    source_type: SignalSourceType,     // bank_statement, merchant_invoice, upi_statement
    source_email_id?: ObjectId,
    raw_data: any,                     // original parsed data
    created_at: Date,
}
```

### Raw Email (MongoDB: `raw_emails`)

```typescript
{
    _id: ObjectId,
    user_id: string,
    gmailMessageId: string,
    fromAddress: string,
    subject: string,
    bodyText?: string,
    bodyHtml?: string,
    receivedAt: Date,
    hasPdf: boolean,
    hasAttachments: boolean,
    attachments?: [{ filename, mimeType, gmailAttachmentId }],
    status: 'fetched' | 'parsed' | 'inserted' | 'skipped',
    parsedData?: {
        parserId: string,              // which parser config matched
        rawExtracted: any,             // parser output
    },
}
```

---

## File Structure

```
src/
├── loaders/
│   ├── logger.ts                      # Global logger init (must be imported first)
│   └── database.ts                    # MongoDB connection
├── plugins/
│   └── gmail.plugin.ts                # Gmail API wrapper
├── schema/                            # Mongoose schemas
│   ├── raw-emails.schema.ts
│   ├── transaction.schema.ts
│   ├── transaction-signal.schema.ts
│   ├── transaction-folder.schema.ts
│   ├── parser-configs.schema.ts
│   └── ...
├── services/
│   ├── emails/emails.service.ts       # CRUD for raw_emails
│   ├── transactions/transaction.service.ts  # Find/create/enrich transactions
│   ├── parsers/parser-config.service.ts     # Load parser configs from DB
│   └── users/gmail-connection.service.ts    # OAuth tokens
├── types/
│   └── financial-data/
│       ├── transactions.enums.ts      # TransactionChannel, TransactionCategory, etc.
│       ├── transactions.type.ts       # ITransaction interface
│       ├── context.type.ts            # Per-merchant context shapes
│       └── signals.type.ts            # Signal types
├── pipelines/
│   ├── email-pipeline.ts             # Orchestrator (runs all stages)
│   ├── email-sync/
│   │   └── email-sync.stage.ts       # Stage 1: Gmail → MongoDB
│   ├── parsers/
│   │   ├── parsers.stage.ts          # Stage 2 orchestrator
│   │   ├── helpers/
│   │   │   └── parser-registry.ts    # Config registry (filter → parser mapping)
│   │   └── providers/
│   │       ├── banks/                # Bank statement parsers (PDF)
│   │       ├── invoices/             # Email invoice parsers (body text)
│   │       ├── subscriptions/        # (empty — future)
│   │       └── upi/                  # UPI statement parsers (PDF)
│   └── enrichment/
│       ├── enrichment.stage.ts       # Stage 3 orchestrator
│       ├── matcher.ts                # 7-pass matching algorithm
│       ├── enricher.ts               # Applies signal to transaction
│       └── normalizers/
│           ├── normalizer.registry.ts # parser_id → normalizer mapping
│           ├── normalizer.types.ts    # NormalizedSignal interface
│           ├── bank-statement.normalizer.ts
│           ├── invoice.normalizer.ts
│           └── upi-statement.normalizer.ts
└── scripts/
    └── scripts/
        ├── generate-dashboard-data.ts # Dashboard JSON generator
        └── ...

spending-dashboard.html               # Single-file dashboard (CSS + JS + embedded JSON)
spending-dashboard-data.json           # Generated data (gitignored)
output/                                # Parsed PDF text samples (gitignored)
```

---

## Known Issues & Gaps

### Data Quality

1. **69% "unknown" category** — Bank statement debits (the majority of transactions) have no category. Only email-matched transactions get categorized. Need merchant name → category mapping for bank statement narrations.

2. **UPI Lite wallet loads in spending** — 90 wallet loads of Rs.2000 each show as spending totals. Should be filtered (they're balance loads, not actual spends). The `sub_category: upi_lite_load` field exists but the dashboard's spending filter needs to check it.

3. **Flight lead days unreliable** — The `booked_on` date is often missing; `travel_date` parsing from MMT emails can produce invalid dates (e.g., dates in 2002 instead of 2026). Late booking premium calculations are directionally correct but specific numbers need verification.

4. **BluSmart vs Uber comparison unfair** — Different route lengths make avg ride cost comparison meaningless. Would need same-route matching to compare meaningfully.

5. **Email thread parsing** — Gmail threads with multiple emails sometimes only parse the latest email in the thread, missing earlier transaction emails.

6. **Duplicate transactions** — Fingerprint dedup uses hour-level truncation. Two transactions with the same amount to the same account in the same hour could collide. The ±12 hour fuzzy match (pass 6) can also create false merges for repeat small amounts (e.g., daily Rs.49 subscriptions).

### Architecture

7. **Parser config ordering** — Configs in `parser-registry.ts` don't control match priority. DB insertion order does. This caused the Swiggy Food parser matching Instamart emails. Fixed with regex negative lookahead, but it's a landmine for future parsers.

8. **No email body-text parser for PhonePe** — PhonePe PDF statement was manually downloaded and imported via a one-off script. Not in the email pipeline flow. Need to either:
   - Add PhonePe as an email-based source (if they send statements via email)
   - Build a file-upload flow for PDF statements

9. **Dashboard JSON embedding** — The HTML file has the JSON data inlined as `window.__DASHBOARD_DATA__`. Every data refresh requires re-embedding the JSON into the HTML. This is fragile — syntax errors in the embedding (extra braces, double script tags) have broken the dashboard multiple times. Consider loading from external JSON file instead.

10. **No incremental pipeline** — Everything runs as full batch. Re-parsing all emails on every run. Should track what's been processed and only handle new/changed data.

11. **Enrichment score is additive but unbounded** — A transaction matched by 5 signals could have score 100+. The score doesn't normalize, making cross-transaction comparison less meaningful.

---

## Running Things

### Full pipeline
```bash
npm run dev
```

### Individual stages
```bash
# Generate dashboard data
npx ts-node --files -r tsconfig-paths/register src/scripts/scripts/generate-dashboard-data.ts

# Run enrichment only
npx ts-node --files -r tsconfig-paths/register src/pipelines/enrichment/enrichment.stage.ts

# Run parsers only
npx ts-node --files -r tsconfig-paths/register src/pipelines/parsers/parsers.stage.ts
```

### Ad-hoc DB queries
```bash
npx ts-node --files -r tsconfig-paths/register -e "
require('./src/loaders/logger');
const { databaseLoader } = require('./src/loaders/database');
(async () => {
    await databaseLoader();
    // ... your query
    process.exit(0);
})();
"
```

**Shell gotcha:** Avoid `!` in inline `-e` code — bash interprets `!` as history expansion even in single quotes with some shells. Write to a file instead for complex scripts.

### Dashboard
1. Run `generate-dashboard-data.ts` to produce JSON
2. JSON gets embedded into `spending-dashboard.html` (currently manual — the data block starts with `window.__DASHBOARD_DATA__ = {`)
3. Open HTML in browser

---

## Conventions

- **Logger is global** — `import '@/loaders/logger'` must be first import
- **Database must connect** — `await databaseLoader()` before any DB queries
- **Parsers are pure functions** — no DB/network calls. Take text, return structured data
- **Normalizers produce NormalizedSignal** — no DB writes. Pure transform
- **Matcher owns the write path** — only place transactions are created/updated
- **Context is merchant-specific** — `context.swiggy`, `context.uber`, etc. Each has its own shape
- **PDF parsing uses pdf-parse v2** — `new PDFParse({ data, password })` → `.getText()` → must call `.destroy()`
- **Path aliases** — `@/` maps to `src/`. Needs `tsconfig-paths/register` at runtime

---

## Future Work (Rebuild Priorities)

1. **Auto-categorization** — Map bank statement merchant names/narrations to categories. This would fix the 69% unknown problem. Could be rule-based (regex on narration) or ML-based.

2. **External JSON loading for dashboard** — Stop embedding JSON into HTML. Load `spending-dashboard-data.json` via fetch. Simpler, more reliable.

3. **Incremental processing** — Track email sync cursors, only parse new emails, only re-enrich changed transactions.

4. **PhonePe/Paytm as first-class sources** — File upload for PDF statements, not one-off scripts.

5. **Better matcher for repeat transactions** — Daily subscriptions (Rs.49 Netflix, Rs.3 Google storage) currently have dedup issues. Need a "known recurring" pattern that expects duplicates.

6. **Transaction folders** — Already have schema + basic rendering. Need UI for creating/editing folder rules.

7. **Alerts/anomalies** — Detect unusual spending patterns, large transactions, new merchants.
