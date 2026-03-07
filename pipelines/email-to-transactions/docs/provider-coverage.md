# Provider Coverage & Roadmap

Last updated: 2026-03-07

## Active Parsers (9 providers)

| Provider | Config ID | Source | Emails Parsed |
|----------|-----------|--------|---------------|
| Kotak Bank Statement | `kotak_savings_statement` | PDF (encrypted) | ~2 |
| SBI e-Account Statement | `sbi_savings_statement` | PDF (encrypted) | ~1 |
| Swiggy Food/Gourmet | `swiggy_food_delivery` | HTML body | ~70 |
| Swiggy Instamart | `swiggy_instamart` | HTML body | ~18 |
| Uber Trip Receipt | `uber_trip` | HTML body | ~80 |
| Apple Invoice | `apple_invoice` | HTML body | ~7 |
| MakeMyTrip Flight | `makemytrip_flight` | HTML body | ~2 |
| Paytm Statement | `paytm_statement` | XLSX attachment | 3 |
| PhonePe Statement | `phonepe_statement` | PDF (encrypted, pw: phone number) | 2 |

## Priority Targets (from Gmail Updates tab scan, last 6 months)

Sorted by email count. These are consumer transaction senders NOT yet covered.

| Priority | Sender | Email | Count | Category | Notes |
|----------|--------|-------|-------|----------|-------|
| 1 | Myntra | updates@myntra.com | 17 | Shopping | Order updates, likely HTML |
| 2 | LazyPay | noreply@lazypay.in | 14 | BNPL | Payment confirmations |
| 3 | Uber (account) | uber@uber.com | 12 | Ride hailing | Different from noreply@ receipts — may be payment failures, account updates |
| 4 | MSG91 | no-reply@msg91.com | 9 | SaaS | Invoice/billing emails |
| 5 | Razorpay | subscriptions@razorpay.com | 5 | Subscriptions | Subscription payment receipts |
| 6 | Grab | no-reply@grab.com | 4 | Ride hailing | Trip receipts (international) |
| 7 | Anthropic | billing@mail.anthropic.com | 4 | SaaS billing | API billing |
| 8 | Amazon | order-update@amazon.in | 4 | Shopping | Delivery updates — need "order"/"invoice" emails for price data |
| 9 | Google Play | googleplay-noreply@google.com | 4 | Subscriptions | Purchase receipts |
| 10 | Airbnb | automated@airbnb.com | 3 | Travel | Booking confirmations |
| 11 | Cleartrip | no-reply@cleartrip.com | 3 | Travel | Flight/hotel bookings |
| 12 | Chaayos | receipt@chaayos.com | 3 | F&B | Order receipts |
| 13 | Zomato | noreply@zomato.com | 2 | Food delivery | Only marketing in DB — need order receipts |
| 14 | YouTube | yt-noreply@google.com | 2 | Subscriptions | Premium billing |
| 15 | Steam | noreply@steampowered.com | 2 | Gaming | Purchase receipts |
| 16 | OpenAI | noreply@notify.openai.com | 2 | SaaS | Billing |

## Providers With No Emails in DB

These need email sync first (expand search queries or request statements from apps).

| Provider | Why Missing |
|----------|-------------|
| Blinkit | 0 emails from blinkit.com in Gmail |
| Zepto | 0 emails from zeptonow.com |
| Flipkart | 0 order emails (only marketing) |
| Zomato | Only marketing emails — no order receipts |
| Amazon | Only "delivered" emails — no invoices with prices |

## Implementation Notes

### How to add a new parser

1. Check emails exist in DB: query `RawEmailsModel` by `fromAddress` and `subject`
2. If not in DB, add a search query to `src/pipelines/email-sync/queries.ts` and run targeted sync
3. Inspect email content (HTML body or PDF attachment) to understand structure
4. Create parser in `src/pipelines/parsers/providers/<name>.parser.ts`
5. Register in `src/pipelines/parsers/provider-configs.ts`
6. Run pipeline — previously unmatched emails will be re-processed automatically

### Source types
- `body_html` — most consumer emails (Swiggy, Uber, Apple, etc.)
- `body_text` — rare, most emails have empty bodyText
- `pdf` — bank statements, PhonePe (supports encrypted PDFs with password list)
- `xlsx` — Paytm statements (two sheets: Summary + Passbook Payment History)

### Key gotchas
- `hasPdf` flag in DB is unreliable — don't filter by it
- SBI has two sender domains: `alerts.sbi.co.in` and `alerts.sbi.bank.in`
- Uber emails use `data-testid` attributes — prefer these over regex
- Apple uses `img[alt]` from `is1-ssl.mzstatic.com` for app names
- PhonePe PDFs are encrypted with user's phone number as password
- Paytm XLSX has mimeType `application/zip` despite being .xlsx
