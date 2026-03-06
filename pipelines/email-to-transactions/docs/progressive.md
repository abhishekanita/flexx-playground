# Progressive Transaction Enrichment

How a skeleton bank narration becomes a fully contextualised financial record as more data sources arrive — without ever creating duplicates or losing the original signal.

`entity resolution` `progressive enrichment` `multi-source merge` `confidence scoring`

---

## 00 — The Mental Model

**One transaction, many signals**

> Core principle: Every real-world financial event creates multiple digital signals — a bank debit, a merchant receipt, a UPI confirmation, a monthly statement row. These are all the same transaction. The job is to recognise them as the same thing and merge their information into one increasingly rich record.

Think of each transaction as a canonical record with a fixed identity and a growing body of context. The record is created the first time any signal for that transaction arrives. Every subsequent signal either creates a new record (if it's genuinely new) or enriches the existing one.

**The three layers of any transaction record:**

1. **Identity** — what uniquely identifies this event (amount + date + account + ref no.)
2. **Base** — what the bank told us (narration, channel, balance)
3. **Context** — what merchants and apps told us (items ordered, restaurant, platform, delivery address)

---

## 01 — Enrichment Lifecycle

**A Swiggy transaction, step by step**

### Signal 01 — Bank alert email

**Source:** `alerts@hdfcbank.net` — arrives in seconds

| Field | Value | Status |
|-------|-------|--------|
| id | `txn_9f3a...uuid` | GENERATED |
| amount | ₹349.00 | PARSED |
| type | debit | PARSED |
| date | 2026-03-05 13:22:07 | PARSED |
| account_last4 | 7333 | PARSED |
| channel | UPI | PARSED |
| upi_ref | 340303762891 | PARSED |
| raw_narration | SWIGGY ORDER 4831-SWIG@ICICI | PARSED |
| merchant_name | Swiggy | INFERRED |
| category | food_delivery | CLASSIFIED |
| balance_after | ₹42,180.50 | PARSED |
| merchant_order_id | null — awaiting invoice | EMPTY |
| merchant_items | null — awaiting invoice | EMPTY |
| restaurant_name | null — awaiting invoice | EMPTY |
| upi_app | null — awaiting UPI stmt | EMPTY |
| statement_row_id | null — awaiting statement | EMPTY |
| **enrichment_score** | **30 / 100** | PARTIAL |

### Signal 02 — Swiggy invoice email

**Source:** `noreply@swiggy.in` — arrives ~5 min after order

| Field | Value | Status |
|-------|-------|--------|
| id | `txn_9f3a...` (same) | UNCHANGED |
| amount | ₹349.00 ✓ | CONFIRMED |
| merchant_order_id | SW-483192847 | ENRICHED |
| restaurant_name | Behrouz Biryani, Koramangala | ENRICHED |
| restaurant_id | RES_98231 | ENRICHED |
| merchant_items | Chicken Dum Biryani ×1 (₹289), Raita ×1 (₹49), Delivery ₹0, GST ₹11 | ENRICHED |
| delivery_address | Home, Koramangala 5th Block | ENRICHED |
| payment_method_merchant | UPI | ENRICHED |
| cuisine_type | Mughlai, Biryani | ENRICHED |
| sub_category | restaurant_delivery → biryani | ENRICHED |
| tax_amount | ₹11.00 GST | ENRICHED |
| discount_applied | ₹0 (no coupon) | ENRICHED |
| upi_app | null — awaiting UPI stmt | EMPTY |
| **enrichment_score** | **72 / 100** | ENRICHED |

### Signal 03 — PhonePe PDF statement

**Source:** `noreply@phonepe.com` — monthly export

| Field | Value | Status |
|-------|-------|--------|
| id | `txn_9f3a...` (same) | UNCHANGED |
| upi_app | PhonePe | ENRICHED |
| upi_ref | 340303762891 ✓ | CONFIRMED |
| upi_sender_vpa | user@ybl | ENRICHED |
| upi_receiver_vpa | swiggyin@icici | ENRICHED |
| upi_status | SUCCESS | ENRICHED |
| bank_reference | HDFC00340303762891 | ENRICHED |
| **enrichment_score** | **91 / 100** | RICH |

### Signal 04 — Monthly bank e-statement

**Source:** `alerts@hdfcbank.net` — 1st of next month

| Field | Value | Status |
|-------|-------|--------|
| id | `txn_9f3a...` (same) | UNCHANGED |
| statement_row_id | HDFC_STMT_MAR26_ROW_47 | ENRICHED |
| statement_narration | UPI/340303762891/SWIGGY ORDER 4831/SWIG@ICICI | ENRICHED |
| value_date | 2026-03-05 | ENRICHED |
| amount | ₹349.00 ✓ triple confirmed | CONFIRMED |
| closing_balance_row | ₹42,180.50 ✓ | CONFIRMED |
| reconciled | true | COMPLETE |
| **enrichment_score** | **100 / 100** | COMPLETE |

---

## 02 — Data Model

**The schema that makes this possible**

> Design principle: One canonical `transactions` table holds the identity + core fields. A separate `transaction_signals` table logs every raw source that contributed. A `transaction_context` JSONB column absorbs all merchant-specific enrichments without schema changes per new app.

### `transactions` — The canonical record. One row per real-world financial event.

**IDENTITY (immutable once set)**

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| id | uuid | PK | Generated on first signal |
| user_id | uuid | FK | Owning user |
| fingerprint | text | unique | `hash(user_id, amount, date_trunc_hour, account_last4)` — dedup key |
| upi_ref | varchar(20) | idx | 12-digit UPI RRN — strongest match key across all UPI signals |
| neft_utr | varchar(20) | idx | 16-char NEFT UTR — unique per NEFT |
| imps_ref | varchar(15) | idx | IMPS reference number |

**BASE (from first signal — usually bank alert)**

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| amount | numeric(15,2) | | Always in INR. Exact decimal. |
| type | enum | | `debit \| credit \| reversal \| refund` |
| channel | text | idx | `UPI \| NEFT \| IMPS \| RTGS \| ATM \| POS \| NACH \| CHEQUE` |
| tx_date | timestamptz | idx | From bank alert. Most precise timestamp available. |
| value_date | date | | Settlement/value date from statement (may differ by 1 day for NEFT) |
| account_last4 | varchar(4) | idx | Masked bank account identifier |
| balance_after | numeric(15,2) | | Available balance post-transaction (from bank alert) |
| raw_narration | text | | Verbatim bank narration: `"UPI/340303762891/SWIGGY ORDER 4831/SWIG@ICICI"` |

**MERCHANT (progressively enriched)**

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| merchant_name | text | idx | Normalised name: "Swiggy" (inferred from narration, confirmed by invoice) |
| merchant_id | uuid | FK→merchants | Links to global merchants table once confirmed |
| category | text | idx | `food_delivery \| groceries \| fuel \| emi \| investment \| rent…` |
| sub_category | text | | `restaurant_delivery \| biryani` (from invoice) |
| merchant_order_id | text | idx | SW-483192847 — from Swiggy invoice. Cross-ref key. |

**UPI LAYER (from UPI app signals)**

| Column | Type | Notes |
|--------|------|-------|
| upi_app | text | PhonePe \| GPay \| Paytm \| BHIM \| CRED — from UPI statement |
| upi_sender_vpa | text | user@ybl |
| upi_receiver_vpa | text | swiggyin@icici |

**CONTEXT (merchant-specific, extensible JSONB)**

| Column | Type | Notes |
|--------|------|-------|
| context | jsonb | All merchant-specific fields. Schema-free. See below. |

**ENRICHMENT STATE**

| Column | Type | Notes |
|--------|------|-------|
| enrichment_score | smallint | 0–100. Drives prioritisation of which txns to show AI insights on. |
| signal_count | smallint | How many independent sources confirmed this transaction |
| reconciled | boolean | true when seen in bank statement — the gold standard confirmation |
| statement_row_id | text | Row identifier from bank statement PDF for audit trail |
| created_at | timestamptz | When record was first created |
| last_enriched_at | timestamptz | Last time a new signal enriched this record |

### `transaction_signals` — Every raw source that contributed. Full audit trail.

| Column | Type | Constraint | Notes |
|--------|------|------------|-------|
| id | uuid | PK | |
| transaction_id | uuid | FK | Links to canonical transaction |
| source_type | text | idx | `bank_alert \| bank_statement \| merchant_invoice \| upi_statement \| sms` |
| source_id | text | | Gmail message ID / SMS ID / statement row ID |
| raw_email_id | uuid | FK→raw_emails | Link to full raw email for re-parsing |
| parsed_data | jsonb | | Full parsed output from this signal — never discarded |
| confidence | float | | 0–1 parsing confidence for this specific signal |
| fields_contributed | text[] | | Which fields on the canonical record this signal set/enriched |
| received_at | timestamptz | idx | When email arrived in inbox |

### The `context` JSONB column — merchant-specific, no schema needed

```jsonc
// transactions.context for a Swiggy food order
{
  "swiggy": {
    "order_id": "SW-483192847",
    "restaurant": { "name": "Behrouz Biryani", "id": "RES_98231", "area": "Koramangala" },
    "items": [
      { "name": "Chicken Dum Biryani", "qty": 1, "price": 289.00 },
      { "name": "Raita", "qty": 1, "price": 49.00 }
    ],
    "delivery_fee": 0, "tax": 11.00, "discount": 0,
    "delivery_address_label": "Home",
    "cuisine": ["Mughlai", "Biryani"]
  }
}

// transactions.context for a Zepto grocery order
{
  "zepto": {
    "order_id": "ZPT-9923812",
    "items": [
      { "name": "Amul Butter 500g", "qty": 1, "price": 275, "category": "dairy" },
      { "name": "Britannia Bread", "qty": 2, "price": 50, "category": "bakery" }
    ],
    "delivery_minutes": 12,
    "platform_fee": 5, "tax": 18
  }
}

// transactions.context for a movie ticket — BookMyShow
{
  "bookmyshow": {
    "booking_id": "BMS-KA92831",
    "movie": "Pushpa 2",
    "cinema": "PVR Cinemas, Forum Mall",
    "seats": ["G7", "G8"],
    "show_time": "2026-03-05T21:00:00+05:30",
    "convenience_fee": 46.00
  }
}
```

---

## 03 — Entity Resolution

**How we match signals to the same transaction**

> The hard problem: A Swiggy invoice email and an HDFC bank alert both describe the same ₹349 payment. They share no common field directly. You must match them using a combination of signals with weighted confidence.

### Strong match keys (use first)

| Key | Confidence |
|-----|------------|
| UPI RRN (12-digit) in both signals | 1.00 |
| NEFT UTR in both signals | 1.00 |
| Merchant order ID in bank narration | 0.97 |
| IMPS ref in both signals | 0.98 |

### Weak match keys (use when RRN absent)

| Key | Confidence |
|-----|------------|
| Exact amount match | 0.50 |
| Merchant name fuzzy match | 0.60 |
| Date within ±5 minutes | 0.70 |
| User + account_last4 | 0.55 |

### Time window rules

| Rule | Strictness |
|------|------------|
| Bank alert → Invoice: ±30 min | strict |
| Bank alert → UPI stmt row: exact RRN | strict |
| Bank statement → existing txn: ±1 day | loose |
| Statement fallback: amount+date+account | fuzzy |

### Composite scoring

| Score | Action |
|-------|--------|
| Score >= 0.90 → auto-merge | MERGE |
| Score 0.70–0.89 → merge + flag | REVIEW |
| Score < 0.70 → new record | NEW TXN |
| Amount mismatch → never merge | BLOCK |

### `src/enrichment/matcher.js` — Signal matching engine

```js
async function findOrCreateTransaction(userId, signal) {
  const { amount, txDate, accountLast4, upiRef, impsRef, neftUtr } = signal;

  // -- PASS 1: Strong match via payment reference --
  if (upiRef) {
    const existing = await db.transaction.findFirst({
      where: { user_id: userId, upi_ref: upiRef }
    });
    if (existing) return { txn: existing, action: 'enrich', confidence: 1.0 };
  }

  // -- PASS 2: Merchant order ID in narration --
  if (signal.merchantOrderId) {
    const existing = await db.transaction.findFirst({
      where: { user_id: userId, merchant_order_id: signal.merchantOrderId }
    });
    if (existing) return { txn: existing, action: 'enrich', confidence: 0.97 };
  }

  // -- PASS 3: Composite fuzzy match --
  const window = { gte: subMinutes(txDate, 30), lte: addMinutes(txDate, 30) };
  const candidates = await db.transaction.findMany({
    where: { user_id: userId, amount, account_last4: accountLast4, tx_date: window }
  });

  if (candidates.length === 1) {
    const score = compositeScore(candidates[0], signal);
    if (score >= 0.90) return { txn: candidates[0], action: 'enrich', confidence: score };
    if (score >= 0.70) return { txn: candidates[0], action: 'enrich_with_review', confidence: score };
  }

  // -- PASS 4: Create new canonical record --
  const newTxn = await db.transaction.create({
    data: {
      user_id: userId,
      fingerprint: buildFingerprint(userId, amount, txDate, accountLast4),
      ...signal.baseFields,
      enrichment_score: signal.initialScore,
      signal_count: 1,
    }
  });
  return { txn: newTxn, action: 'create', confidence: 1.0 };
}
```

---

## 04 — Enrichment Logic

**How each source enriches the record**

### `src/enrichment/enricher.js` — Applies enrichments without overwriting trusted data

```js
async function enrichTransaction(txnId, signal, sourceType) {
  const txn = await db.transaction.findUnique({ where: { id: txnId } });
  const updates = {};
  const fieldsContributed = [];

  // -- Source-specific enrichment maps --
  const enrichmentMap = {

    // From a Swiggy / Zomato / Zepto invoice email
    'merchant_invoice': () => {
      setIfEmpty(updates, txn, 'merchant_order_id', signal.orderId, fieldsContributed);
      setIfEmpty(updates, txn, 'sub_category', signal.subCategory, fieldsContributed);
      // Context is always merged (not replaced)
      updates.context = mergeContext(txn.context, { [signal.merchant]: signal.merchantContext });
      // If merchant name was inferred, confirm it
      if (txn.merchant_name !== signal.merchantName) {
        updates.merchant_name = signal.merchantName; // invoice is more trustworthy
        fieldsContributed.push('merchant_name');
      }
      updates.enrichment_score = Math.min(100, txn.enrichment_score + 42);
    },

    // From a PhonePe / GPay / Paytm monthly statement PDF
    'upi_statement': () => {
      setIfEmpty(updates, txn, 'upi_app', signal.upiApp, fieldsContributed);
      setIfEmpty(updates, txn, 'upi_sender_vpa', signal.senderVpa, fieldsContributed);
      setIfEmpty(updates, txn, 'upi_receiver_vpa', signal.receiverVpa, fieldsContributed);
      setIfEmpty(updates, txn, 'upi_ref', signal.upiRef, fieldsContributed);
      updates.enrichment_score = Math.min(100, txn.enrichment_score + 19);
    },

    // From the monthly bank e-statement PDF
    'bank_statement': () => {
      setIfEmpty(updates, txn, 'statement_row_id', signal.rowId, fieldsContributed);
      setIfEmpty(updates, txn, 'statement_narration', signal.narration, fieldsContributed);
      setIfEmpty(updates, txn, 'value_date', signal.valueDate, fieldsContributed);
      updates.reconciled = true;  // bank statement = gold standard
      fieldsContributed.push('reconciled');
      // NEVER overwrite amount or tx_date from statement — bank alert is more precise
      updates.enrichment_score = 100;
    },
  };

  await enrichmentMap[sourceType]?.();

  // -- Apply updates --
  await db.transaction.update({
    where: { id: txnId },
    data: { ...updates, signal_count: { increment: 1 }, last_enriched_at: new Date() }
  });

  // -- Log the signal for audit trail --
  await db.transactionSignal.create({
    data: {
      transaction_id: txnId,
      source_type: sourceType,
      source_id: signal.sourceId,
      raw_email_id: signal.rawEmailId,
      parsed_data: signal.rawParsed,
      confidence: signal.confidence,
      fields_contributed: fieldsContributed,
      received_at: signal.receivedAt,
    }
  });
}

// Helper: only set if the field is currently null (don't overwrite trusted data)
function setIfEmpty(updates, txn, field, value, fieldsContributed) {
  if (!txn[field] && value) {
    updates[field] = value;
    fieldsContributed.push(field);
  }
}
```

---

## 05 — Source Catalogue

**Every source and what it uniquely contributes**

| Source | Match Key | Unique Fields Added | enrichment_score delta |
|--------|-----------|--------------------|-----------------------|
| Bank real-time alert | Creates the record | amount, type, date, channel, account, balance, raw_narration, merchant (inferred), upi_ref | +30 (base) |
| Swiggy invoice | amount + date ±30min + "swiggy" in narration | order_id, restaurant, items ordered, cuisine, delivery fee, tax, discount, delivery address label | +42 |
| Zomato invoice | amount + date ±30min + "zomato" in narration | order_id, restaurant, items, pro discount, packaging fee, GST breakdown, delivery ETA | +42 |
| Amazon / Flipkart invoice | order_id embedded in bank narration | order_id, product names, categories (electronics/fashion), seller, return_by date, EMI plan | +38 |
| BookMyShow receipt | booking_id in narration or amount+date | movie_name, cinema, seats, show_time, genre, convenience_fee, screen_type (IMAX/4DX) | +35 |
| Zepto / Blinkit receipt | amount + date ±10min + merchant match | items, product categories (dairy/produce/snacks), delivery_time_minutes, platform_fee | +40 |
| Ola / Uber receipt | trip_id in narration or amount+date ±5min | pickup_location, drop_location, distance_km, ride_type, surge_applied, driver_rating | +44 |
| PhonePe / GPay statement PDF | UPI RRN (exact) | upi_app, sender_vpa, receiver_vpa, upi_status, bank_reference_no | +19 |
| CRED payment receipt | amount + date ±15min + card narration | upi_app: CRED, cashback_earned, coins_used, bill paid for (CC name) | +15 |
| Bank monthly e-statement PDF | amount + value_date + account | statement_row_id, full narration, value_date, reconciled=true, closing_balance | →100 (completes) |
| Credit card statement PDF | amount + billing_cycle + merchant | billing_cycle, statement_date, cashback_earned, reward_points_earned, cc_category_code | →100 (completes) |
| LPG / Electricity bill email | amount + biller name + date | biller (BESCOM/HP Gas), consumer_no, units_consumed, bill_month, due_date | +30 |
| Insurance premium receipt | amount + insurer + date ±1day | policy_no, plan_name, coverage_type, next_due_date, receipt_no | +35 |
| NACH/EMI deduction notice | NACH ref or amount + lender + date | loan_account, lender, emi_amount, principal_component, interest_component, outstanding_balance | +38 |

---

## 06 — The Payoff

**What the AI companion can do with enriched data**

> **Without enrichment:** "You spent ₹349 at Swiggy on March 5th." That's it. The bank told us that. An AI can do nothing more.

> **With enrichment:** The AI now knows you ordered biryani from Behrouz Biryani in Koramangala, paid via PhonePe, at lunchtime on a Wednesday, with no discount applied, and this is your 3rd biryani order this month totalling ₹1,047. It can say: *"You've spent ₹1,047 on biryani this month. You never use coupons on Swiggy — turning on Swiggy One saves ₹100+ monthly based on your order frequency."*

### Analysis unlocked by each enrichment layer

| Enrichment Layer | AI Insights Unlocked |
|-----------------|---------------------|
| **Items from invoices** | Track spend by food item category (biryani, sushi, coffee), not just "Swiggy". Detect diet patterns. Flag when grocery spend shifts to delivery. |
| **Location from receipts** | Know which city/area txns happen in. Travel detection. WFH vs office days (home delivery vs restaurant area). Multiple cities = travel expense tracking. |
| **UPI app from statements** | Which payment app is used for what. CRED users get cashback — is it being captured? PhonePe vs GPay split. |
| **Reconciled from bank stmt** | Find txns in invoices that have NO bank match = refunds not received. Find bank debits with NO invoice = unknown charges. Flag both proactively. |
| **Principal/interest from EMI** | True cost of a loan. How much of each EMI is interest (not principal reduction). Optimal pre-payment advice. |
| **Discount/cashback fields** | Actual vs potential savings. User never uses Swiggy coupons → AI recommends Swiggy One. User leaving CRED cashback unclaimed. |

---

*Progressive Transaction Enrichment Architecture — India FinMail · March 2026*
