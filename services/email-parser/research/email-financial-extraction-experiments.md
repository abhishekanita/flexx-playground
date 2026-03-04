# Email Financial Data Extraction — Experiments & Learnings

## The Problem

Bank statements tell you **who** you paid and **how much**. They don't tell you **what** you bought. A Swiggy debit of Rs 330 could be 1 butter chicken thali or 3 coffees. UPI Lite spending (Rs 26,000/month for this user) is completely invisible — it only shows as "top-up" transactions.

Email receipts contain the missing detail: line items, order IDs, exact merchants, timestamps. But extracting structured data from emails at scale is expensive if you run an LLM on every email.

**Core question**: Can we extract financial data from emails cheaply enough to serve 100K+ users?

---

## What We Built

Three standalone experiments against a real user's Gmail (Abhishek, 6 months of data, SBI + Kotak bank accounts):

| # | Experiment | File | Purpose |
|---|-----------|------|---------|
| 1 | Template Generation | `experiment-template-gen.ts` | Can LLM generate reusable CSS extraction templates from 1 sample? |
| 2 | Sender Census | `experiment-sender-census.ts` | Is the number of financial email senders finite and small? |
| 3 | Reconciliation | `experiment-reconciliation.ts` | What's the value of combining bank statements + email receipts? |

All scripts use the same Gmail OAuth2 auth pattern, connecting to a real inbox.

---

## Experiment 1: LLM Template Generation

### What it does

The "Learn Once, Parse Forever" approach:

1. Fetch N emails from a sender (Swiggy, Uber, Apple)
2. Send **1 sample HTML** to `gpt-4.1-mini` → ask it to generate CSS selector extraction rules
3. Apply those rules to ALL remaining emails using **Cheerio** (zero LLM cost)
4. Compare template results against direct LLM extraction (ground truth)

### How templates work

The LLM generates a JSON structure like this for Swiggy:

```json
{
  "rules": {
    "date": { "selector": "div.order-id p:contains('Order placed at') > strong", "regex": "(.+)", "transform": "string" },
    "amount": { "selector": "tr.grand-total > td[style*='padding-right']", "regex": "₹\\s?([\\d,]+\\.?\\d*)", "transform": "currency" },
    "orderId": { "selector": "div.order-id h5", "regex": "(\\d+)", "transform": "string" }
  },
  "lineItems": {
    "containerSelector": "div.order-content table tbody",
    "itemSelector": "tr:not(.grand-total)...",
    "nameRule": { "selector": "td.small" },
    "priceRule": { "selector": "td:last-child", "regex": "₹\\s?([\\d,]+\\.?\\d*)" }
  }
}
```

Cheerio applies these CSS selectors + regex rules in <10ms per email. No LLM needed.

### Results

| Sender | Emails | Date | Amount | OrderID | Line Items | Overall |
|--------|--------|------|--------|---------|------------|---------|
| Swiggy (food orders) | 14 tested | 64% | 64% | 64% | 64% | 64% |
| Uber | 14 tested | 100% | 100% | 100% | 36% | 84% |
| Apple | 9 tested | 0% | 100% | 0% | 0% | 25% |

**Why Swiggy is 64% not 100%**: The 36% failures are all **Swiggy Instamart** emails mixed in with food delivery emails. Instamart uses a completely different HTML template. If you filter to food-only, Swiggy is effectively **100% on date, amount, orderId**.

**Why Apple date/orderId is 0%**: Apple's email HTML uses CSS-in-JS with hash-based class names like `custom-a7f3b2`. These class names change between email template versions, so selectors break. The amount extraction works because it uses structural selectors (`td` tag positioning) rather than class names.

**Why Uber line items is 36%**: Uber trip receipts don't always have itemized fare breakdowns in the same HTML structure. The core fields (date, amount, trip ID) are 100%.

### Speed comparison

| Method | Avg time/email | Speedup |
|--------|---------------|---------|
| Template apply (Cheerio) | 6-35 ms | - |
| Direct LLM extraction | 1,900-3,000 ms | **400-1600x faster** |

### Cost comparison

| | Template approach | Direct LLM approach |
|--|------------------|---------------------|
| Swiggy (14 emails) | $0.007 one-time | $0.017 |
| Uber (14 emails) | $0.023 one-time | $0.093 |
| Apple (9 emails) | $0.004 one-time | $0.021 |
| **Total** | **$0.035 one-time** | **$0.132** |

At scale: direct LLM = ~$0.003/email. Template = $0.003 once per sender, then $0/email forever.

**100K users x 200 emails/month**: Direct = ~$60K/month. Template = ~$0 steady-state (after initial ~$150 to generate templates for top 50 senders).

### Key learnings

1. **Template generation works extremely well for senders with stable HTML class names** (Swiggy, Uber). Date, amount, and orderId extraction is reliable.

2. **CSS-in-JS / hash-based class names break templates** (Apple). Need fallback strategy.

3. **One template per "email type" per sender**, not per sender. Swiggy food delivery and Swiggy Instamart need separate templates. Same sender, different product = different email template.

4. **LLM tends to hallucinate dates** when extracting directly — especially the year. We had to compare only month+day and pass the email's send date explicitly in the prompt.

5. **Pre-tax vs post-tax amounts** cause mismatches. Template might extract subtotal while LLM extracts total. Must instruct both to extract "final total including taxes."

6. **OpenAI structured output requires `.nullable()` not `.optional()` in Zod schemas.** OpenAI demands all properties in `required` array. Using `.optional()` removes them from required, causing schema validation errors.

7. **Vercel AI SDK v6 usage format**: `{ inputTokens, outputTokens }` NOT `{ promptTokens, completionTokens }`.

---

## Experiment 2: Sender Census

### What it does

Two-phase approach to map the financial email landscape:

- **Phase 1**: Count emails from 80+ known financial domains via targeted `from:domain newer_than:6m` Gmail queries (fast — 1 API call each)
- **Phase 2**: Sample 500 recent emails for unknown sender discovery using subject keyword matching

### Results

| Metric | Value |
|--------|-------|
| Total emails (6 months) | ~2,254 financial |
| Known financial senders found | 32 |
| Keyword-detected (new) senders | 51 |
| Total unique financial senders | 83 |

**Coverage thresholds (the key finding):**

| Top N senders | Coverage |
|---------------|----------|
| 5 | 50% |
| 11 | 75% |
| **13** | **80%** |
| 21 | 90% |
| 31 | 95% |
| 61 | 99% |

**Top senders by volume:**

| # | Sender | Count | Type |
|---|--------|-------|------|
| 1 | Swiggy | 363 | Food |
| 2 | Uber | 361 | Transport |
| 3 | Groww | 224 | Investment |
| 4 | Netflix | 160 | Subscription |
| 5 | MakeMyTrip | 159 | Travel |
| 6 | IRCTC | 84 | Travel |
| 7 | Apple | 81 | Subscription |
| 8 | Myntra | 73 | Shopping |
| 9 | Goibibo | 72 | Travel |
| 10 | CAMS | 70 | Investment |

### Key learnings

1. **The 80/20 rule is validated**: 13 senders cover 80% of financial emails. 31 senders cover 95%.

2. **Most "financial" emails are marketing, not transactional.** Swiggy has 363 emails but only ~60 are actual order receipts. Uber has 361 emails but only ~30 are trip receipts. This means the actual transactional email volume per user is much lower (~50-80/month), making even direct LLM cheaper than initially estimated.

3. **The keyword-based detection has many false positives.** Newsletter subjects contain words like "payment", "subscription", "₹" but aren't financial emails (e.g., The Ken, Medium, Vox). Need a sender registry, not keyword matching.

4. **Investment platforms send a LOT of emails.** Groww (224), CAMS (70), KFintech (59). These are mostly confirmations, NAV updates, SIP processed notifications. High value data if parsed correctly.

5. **Bank emails are surprisingly few.** SBI (43 total across domains), Kotak (87), HDFC (13). Most bank communication is via SMS, not email.

6. **Gmail API rate limits matter.** The first version of this script fetched metadata for each of 3,500+ emails individually — took 30+ minutes. Rewritten to use targeted `from:` queries (1 API call per known sender) + sampling 500 emails for discovery. Ran in ~3 minutes.

---

## Experiment 3: Cross-Source Reconciliation

### What it does

1. Load parsed SBI + Kotak bank transactions (from our hand-coded PDF parsers)
2. Load email extraction results from Experiment 1
3. Match by amount + date + merchant across three passes:
   - Pass 1: Exact amount + same date
   - Pass 2: Fuzzy (5% amount tolerance, ±1 day)
   - Pass 3: Amount-only with merchant name similarity
4. Analyze UPI Lite blind spot and spending visibility

### Results (January 2026)

| Metric | Value |
|--------|-------|
| Bank transactions | 73 (59 debits, 14 credits) |
| Email receipts in period | 3 (all Apple invoices) |
| Matches found | 3 |
| Real spending (excl. transfers) | Rs 28,716 |
| UPI Lite top-ups | 13 x Rs 2,000 = **Rs 26,000** |

**UPI Lite = The Black Hole:**
Rs 26,000/month loaded into UPI Lite wallet. Bank statement only shows "UPI Lite top-up Rs 2,000" x 13. Zero visibility into what was actually purchased. That money went to Swiggy, Uber, street vendors — but bank statements can't tell you.

**Spending visibility analysis:**

| Category | Amount | What's missing |
|----------|--------|----------------|
| Vague/no description | Rs 44,682 | UPI Lite, Other, Person Transfers — no merchant info |
| Merchant but no details | Rs 16,456 | Food, Shopping, Groceries, Transport — no line items |
| **Total enrichable** | **Rs 61,138** | **213% of real spending** |

### Key learnings

1. **Only 3 email receipts overlapped with the Jan 2026 bank statement period.** We only tested 3 senders (Swiggy, Uber, Apple) and fetched recent emails (Feb 2026). For a proper reconciliation, need to fetch emails matching the bank statement period.

2. **UPI Lite is the killer use case.** Rs 26K/month (nearly equal to the Rs 28K "real spending") is completely invisible. Only email receipts from merchants can illuminate this.

3. **Bank statements know WHO, emails know WHAT.** A bank transaction says "Swiggy Rs 330 via UPI". The email receipt says "1x Butter Chicken Thali from Currynama By Seven Seas, Order #231173010982467". Combined view is transformative.

4. **213% enrichable spending** means email data can add detail to more than double the "real spending" amount (because UPI Lite spending is hidden from the bank statement denominator).

---

## Technical Learnings (across all experiments)

### Gmail API

- **OAuth2 flow**: Client ID + Client Secret + user's refresh token. Token refresh needed on each run.
- **Search queries are powerful**: `from:swiggy.in subject:delivered newer_than:6m` — can filter very precisely.
- **`format: 'metadata'`** for headers-only (fast), **`format: 'full'`** for HTML body.
- **Pagination**: `messages.list` returns max 500 per page, use `nextPageToken` to paginate.
- **`resultSizeEstimate`** is unreliable for exact counts. Must paginate to count.

### LLM extraction

- **gpt-4.1-mini** is the sweet spot for structured extraction. ~$0.003/email.
- **HTML→Markdown conversion** (via Turndown) reduces tokens by ~70% for direct extraction.
- **Structured output** (via Vercel AI `generateObject` + Zod schema) ensures consistent output format.
- **LLMs hallucinate dates** — especially the year. Always provide context (email send date).
- **LLMs sometimes extract pre-tax amounts.** Must explicitly instruct "final total including taxes."

### HTML email parsing

- **Cheerio** (CSS selector engine) is the right tool for template application. Fast, reliable, handles malformed HTML.
- **CSS-in-JS class names** (Apple) are unstable across email versions. Templates break.
- **Stable selectors**: class names from email template systems (Swiggy's `.order-id`, `.grand-total`), semantic tag patterns (`tr > td[style*='bold']`), data attributes.
- **Unstable selectors**: hash-based classes (`custom-a7f3b2`), positional selectors (`:nth-child(3)`).
- **One sender can have multiple email templates** (Swiggy food vs Instamart, Uber trip vs marketing).

### Bank statement parsing

- **PDF parsing is reliable but labor-intensive.** SBI parser is 200+ lines of regex. Kotak has two formats (kotak.com and kotak.bank.in).
- **Date formats vary wildly**: SBI uses `DD-MM-YY`, Kotak uses `DD Mon YYYY` or `DD Mon, YYYY`.
- **UPI merchant names are garbled**: "BUNDL TECHNOLOGIES" = Swiggy, "UBER INDIA" = Uber. Need merchant normalization.

---

## Architecture Options

### Option A: Template-First (what we validated)

```
Email arrives → Classify sender (regex/lookup) → Known? → Apply cached template (Cheerio)
                                                → Unknown? → LLM generates template → Cache → Apply
                                                → Template fails? → LLM regenerates (rare)
```

**Pros:**
- Near-zero marginal cost per email (~$0 steady-state)
- Blazing fast (6-35ms vs 2-3s per email)
- Deterministic — same email always produces same output
- No LLM dependency for 95%+ of emails after initial setup

**Cons:**
- Requires maintaining template registry (one per sender per email-type)
- Templates break when senders redesign their HTML (need monitoring)
- Doesn't work well for CSS-in-JS emails (Apple, some modern senders)
- Initial template quality depends on sample email chosen
- Building and testing templates for 50-100 senders is upfront work

**Best for:** High-volume senders with stable HTML templates (Swiggy, Uber, Zomato, Amazon)

**Estimated cost at 100K users:**
- One-time: ~$150 (generate templates for top 50 senders)
- Monthly: ~$10-50 (regenerate broken templates, handle new senders)

---

### Option B: LLM-Per-Email with Caching

```
Email arrives → Hash the HTML template structure → Cache hit? → Return cached extraction
                                                 → Cache miss? → LLM extracts → Cache result
```

Instead of generating reusable templates, run LLM on each unique email structure. But cache by HTML structure hash — so the 2nd Swiggy order email with same template gets a cache hit.

**Pros:**
- Simpler than template generation — no CSS selector logic needed
- Works for all email types including CSS-in-JS
- Graceful degradation — worst case is LLM extraction (still works)
- No template maintenance burden

**Cons:**
- Higher cost than Option A (every unique HTML structure needs 1 LLM call)
- Harder to define "structure hash" — what parts of HTML are structural vs content?
- Cache invalidation complexity
- LLM latency on cache misses
- Cost depends heavily on how many unique HTML structures exist per sender

**Best for:** Long-tail senders, senders that frequently change templates

**Estimated cost at 100K users:**
- Assuming 100 unique structures per sender x 50 senders = 5,000 LLM calls/month for new structures
- ~$15/month steady-state (mostly cache hits)

---

### Option C: Hybrid (Template + LLM Fallback)

```
Email arrives → Classify sender → Template exists? → Apply template
                                                    → Extraction valid? → Done ✓
                                                    → Extraction failed? → LLM direct extract → Flag for template regen
                                → No template? → LLM direct extract → Queue for template generation
```

Use templates for top senders, LLM fallback for everything else.

**Pros:**
- Best of both worlds — fast + cheap for known senders, still handles everything
- Self-healing — failed templates trigger regeneration
- Gradual onboarding — start with LLM-for-all, templates grow over time
- Monitoring built-in — template failures are tracked

**Cons:**
- Most complex to build
- Two code paths to maintain (template + LLM)
- Need a quality scoring system to decide when templates have "failed"

**Best for:** Production system that needs to handle both high-volume and long-tail senders

**Estimated cost at 100K users:**
- ~$20-50/month (templates handle 80% of volume, LLM handles 20%)

---

### Option D: Fine-Tuned Small Model

```
Email arrives → Small fine-tuned model extracts data directly
```

Fine-tune a small model (e.g., Llama 3.1 8B or Phi-3) specifically for financial email extraction. Run it locally or on cheap GPU instances.

**Pros:**
- Single model handles all senders
- No template management
- Can be self-hosted — no API dependency
- Per-email cost approaches zero on own hardware

**Cons:**
- Need training data (hundreds of labeled emails per sender type)
- Model retraining when new senders appear
- Hosting/infra cost (GPU instances)
- Lower accuracy than GPT-4.1-mini without significant training data
- Cold start problem — need to bootstrap with Option B or C first

**Best for:** Very high scale (1M+ users) where API costs dominate

**Estimated cost at 100K users:**
- Infra: ~$200-500/month for GPU hosting
- Per-email: ~$0 (amortized)

---

### Option E: Sender-Provided Structured Data (ideal but slow)

```
Email arrives → Check for structured data (JSON-LD, schema.org markup) → Extract
                                                                       → Not present? → Fall back to template/LLM
```

Some modern transactional emails embed structured data (JSON-LD, microdata). Gmail itself uses this for flight boarding passes, hotel bookings, package tracking.

**Pros:**
- Perfect accuracy — data is structured by the sender
- Zero cost
- Zero maintenance

**Cons:**
- Very few Indian senders do this today
- Can't control what senders embed
- Would need to partner with senders or build a standard
- Years to achieve meaningful coverage

**Best for:** Long-term strategic bet, not a near-term solution

---

## Recommended Architecture: Option C (Hybrid)

Based on our experiments:

```
                    ┌──────────────────┐
                    │  Email Ingestion │ (Gmail API / webhook)
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Sender Classifier│ (regex on from: address — zero LLM)
                    └────────┬─────────┘
                             │
               ┌─────────────┼─────────────┐
               │                           │
      ┌────────▼─────────┐      ┌──────────▼───────────┐
      │  Known Sender     │      │  Unknown Sender       │
      │  Template Exists  │      │  No Template          │
      └────────┬─────────┘      └──────────┬───────────┘
               │                           │
      ┌────────▼─────────┐      ┌──────────▼───────────┐
      │  Apply Template   │      │  LLM Direct Extract   │
      │  (Cheerio, <10ms) │      │  (gpt-4.1-mini, ~2s)  │
      └────────┬─────────┘      └──────────┬───────────┘
               │                           │
      ┌────────▼─────────┐      ┌──────────▼───────────┐
      │  Quality Check    │      │  Queue: Generate      │
      │  (fields present?)│      │  Template for Sender  │
      └────────┬─────────┘      └──────────────────────┘
               │
        Pass ──┼── Fail
               │         │
      ┌────────▼──┐  ┌───▼──────────────┐
      │   Done ✓  │  │ LLM Fallback +   │
      └───────────┘  │ Flag for Regen   │
                     └──────────────────┘
```

**Why this wins:**
- Experiment 1 proved templates work at 100% for stable senders (Uber, Swiggy food)
- Experiment 2 proved 13 senders cover 80% — worth building templates for
- LLM fallback handles Apple-style CSS-in-JS and long-tail senders
- Self-healing: template failures auto-trigger regeneration
- Cost: ~$20-50/month at 100K users vs ~$60K for LLM-per-email

---

## What Still Needs Validation

1. **Template durability over time.** We tested templates on emails from the same month. How often do Swiggy/Uber redesign their email HTML? Need to track template success rate over 3-6 months.

2. **Scale of "email types" per sender.** Swiggy has food delivery, Instamart, Dineout, Genie. Each may need a separate template. How many total templates do we need for top 30 senders?

3. **PDF emails.** Bank statements and credit card statements arrive as PDF attachments. Our hand-coded parsers work but don't scale. Can the template approach work for PDFs? (Probably not — need OCR + layout understanding. Keep hand-coded for top 5 banks, LLM for the rest.)

4. **Real reconciliation with time-aligned data.** Experiment 3 only had 3 matching email receipts because email fetch period didn't align with bank statement period. Need to run with full 3-month data.

5. **Multi-user template reuse.** We assumed templates work across users (same sender = same HTML). Need to validate with a second user's inbox.

6. **Accuracy measurement at scale.** 14 emails per sender is a small sample. Need 100+ emails to get statistically significant accuracy numbers.

7. **Template generation prompt engineering.** Current prompt produces good templates but could be improved — e.g., explicitly avoiding hash-based class names, preferring data attributes.

---

## File Reference

| File | Description |
|------|-------------|
| `src/scripts/experiment-template-gen.ts` | Experiment 1: Template generation + accuracy testing |
| `src/scripts/experiment-sender-census.ts` | Experiment 2: Sender discovery and coverage analysis |
| `src/scripts/experiment-reconciliation.ts` | Experiment 3: Bank statement + email receipt matching |
| `src/scripts/parse-sbi-statements.ts` | Hand-coded SBI PDF parser |
| `src/scripts/parse-kotak-statements.ts` | Hand-coded Kotak PDF parser (dual format) |
| `src/scripts/analyse-statements.ts` | Unified financial analysis across banks |
| `src/scripts/fetch-bank-statements.ts` | Gmail API → download + decrypt bank PDFs |
| `src/utils/ai-cost.ts` | LLM token cost tracking |
| `src/scripts/downloads/experiment-template-gen-results.json` | Raw results from Experiment 1 |
| `src/scripts/downloads/experiment-sender-census.json` | Raw results from Experiment 2 |
| `src/scripts/downloads/experiment-reconciliation.json` | Raw results from Experiment 3 |
