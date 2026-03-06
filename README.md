# Fintech AI Companion — Experiment Playground

Internal monorepo for building and testing experiments around a **financial AI companion** for Indian retail investors. Everything from AI agent personas and knowledge pipelines to portfolio analysis and daily briefings lives here.

> **Status:** Active experimentation — folder structure and service boundaries are evolving.

---

## Monorepo Structure

```
playground-mono/
├── services/               # Independent experiment services (Python/Node)
│   ├── companions/         # AI agent system — personas, prompts, knowledge pipelines
│   ├── email-parser/       # Gmail → structured financial transactions pipeline
│   ├── market-briefing/    # Daily personalized market briefing generator
│   ├── wealth-insights/    # CAMS/CAS parsing → mutual fund portfolio analysis
│   ├── knowledge-skills/   # (placeholder) skill & knowledge management
│   └── other-data/         # Static datasets (loan products, etc.)
├── apps/
│   ├── playground/         # React SPA — dashboard, mandates, MF insights UI
│   └── server/             # Express API — auth, NPCI, credit score, integrations
├── packages/
│   ├── schema/             # Shared Mongoose schemas (@playground/schema)
│   └── types/              # Shared TypeScript types & enums (@playground/types)
├── turbo.json              # Turborepo pipeline config
├── pnpm-workspace.yaml     # Workspace definition
└── package.json            # Root — pnpm 9.12, Turbo, TypeScript 5
```

---

## Services

### `companions` — AI Agent System

The core conversational AI experiment. 6 distinct financial advisor personas (Arjun, Vikram, Ace, Siddharth, Samir, Coach Raj) with modular prompt architecture for rapid A/B testing.

**What's inside:**
- **Agent personas** — Each has 5 custom prompt modules (identity, voice, context, knowledge, examples) + 4 shared modules (behavioral rules, cohort calibration, emotional handling, response format)
- **Knowledge pipelines** — Reddit scraper + processor, YouTube transcript fetcher + processor. Extracts structured QA pairs, generates embeddings (text-embedding-3-small), stores in vector-searchable knowledge base
- **Situational skills** — 10+ dynamically-loaded .md expertise modules (scam awareness, market crash, tax season, debt crisis, etc.)
- **RAG search** — Cosine similarity retrieval over community-sourced knowledge (2,276 QA pairs from 699 Reddit posts + YouTube transcripts from 6 channels)
- **Plugins** — Reddit (snoowrap), YouTube (googleapis), Account Aggregator (Finfactor), Credit Score (CRIF), Gmail, Instagram, NPCI/UPI

**Stack:** Node/TypeScript, Vercel AI SDK, OpenAI (gpt-5-mini), MongoDB, BullMQ, Puppeteer

---

### `email-parser` — Email-to-Transactions Pipeline

5-stage pipeline that turns Gmail emails into clean, deduplicated financial records.

**Pipeline stages:**
1. **Sync** — Search Gmail with 30+ configurable queries, fetch full messages + attachments
2. **Classify** — Match emails to parser configs by sender domain + subject patterns
3. **Parse** — Extract structured data via CSS selectors (template), LLM (OpenAI), or PDF parsing
4. **Reconcile** — Create transactions/invoices/statements, deduplicate, normalize merchants
5. **Finalize** — Track metrics, log LLM costs

**What it parses:** Swiggy/Uber/Amazon receipts, bank statement PDFs (SBI, HDFC, ICICI), credit card statements, investment confirmations, insurance documents

**Config-driven:** Extraction logic lives in YAML files, not code — add new email sources without touching TypeScript.

**Stack:** Node/TypeScript, Cheerio (HTML), pdf-parse, OpenAI, Gmail API, MongoDB

---

### `market-briefing` — Daily Financial Briefing Generator

Generates personalized 10-minute daily briefings for Indian investors by aggregating market data, news, and creator content.

**Pipeline (4 stages):**
1. **Aggregate demand** — Collect user holdings (stocks + MFs), interests, demographics
2. **Fetch data** — 8 parallel sources: Yahoo Finance (quotes/indices), MFAPI (NAVs), RSS feeds (ET/NDTV/Business Standard), SerpAPI (Google News), NSE flows (FII/DII), YouTube (6 creator channels), Instagram (finance reels)
3. **Generate content** — Signal detection (market mood, big movers, sector patterns, creator buzz) → LLM generates 8 story types (Big Story, Portfolio Impact, Sleeper Story, Creator Buzz, Your Move, etc.)
4. **Personalize** — Score each content piece per user (holdings match +10, MF match +8, interest match +5) → assemble top 7 pieces in briefing flow order

**Uses Reddit/YouTube from companions:** YouTube plugin fetches from same 6 finance channels; creator topic detection feeds into content generation. Reddit integration planned.

**Stack:** Node/TypeScript, OpenAI (GPT-4), Yahoo Finance 2, googleapis, Apify (Instagram), SerpAPI, MongoDB

---

### `wealth-insights` — Mutual Fund Portfolio Analyzer

End-to-end pipeline from CAMS PDF statements to deep portfolio analysis with 16 analysis modules.

**What it does:**
- **CAS parsing** — Puppeteer automates CAMS statement request → Gmail polling → PDF extraction → structured portfolio data
- **Analysis engine (5 phases, 16 modules):**
  - Phase 1 (pure math): Portfolio summary, XIRR, transaction timeline, cashflow analysis, SIP pattern detection, tax harvesting (FIFO lots, STCG/LTCG)
  - Phase 2-3 (enriched): Benchmark comparison (vs Nifty), TER analysis, sector/company exposure, asset allocation, market cap breakdown, fund overlap detection, risk metrics (Sharpe, max drawdown)
  - Phase 4: What-if scenarios (FD vs MF, Direct vs Regular, SIP vs Lumpsum, worst fund removed, started earlier, index alternative)
  - Phase 5: LLM insights (narrative cards, behavioral analysis, 14-rule anomaly detection)
- **Dashboard data** — Hero stats, fund race, investment heatmap, benchmark bars, fund personality cards
- **Advisory system** — Journey-based actionables (fund switches, nominee registration, tax harvesting triggers)

**Data enrichment (7 providers):** AMFI master, MFAPI (NAV history), Yahoo Finance (benchmarks), Kuvera (fund metadata), Groww (holdings/risk), AMC Excel files — all with 3-level caching.

**Stack:** Node/TypeScript, Puppeteer, pdf-parse, OpenAI, Yahoo Finance, MongoDB, Agenda (jobs)

---

### `other-data` — Static Datasets

Reference data files used across services:
- `laons-products.json` — Loan product catalog (lenders, rates, tenure, eligibility)

---

## Apps

### `apps/playground` — Frontend Dashboard
React 19 + Vite SPA with shadcn/ui components. Features: auth (Google OAuth + OTP), UPI mandate management, MF insights dashboard, real-time collaboration (Liveblocks).

### `apps/server` — Backend API
Express.js REST API. Handles: authentication (JWT), NPCI/UPI integration, CRIF credit scoring, Gmail integration, MF insights endpoints. MongoDB + Redis + BullMQ.

---

## Shared Packages

| Package | Export | Purpose |
|---------|--------|---------|
| `packages/schema` | `@playground/schema` | Mongoose model definitions (users, mandates, subscriptions) |
| `packages/types` | `@playground/types` | Shared TypeScript interfaces and enums |

---

## Development

```bash
# Install dependencies
pnpm install

# Run all services in dev mode
pnpm dev

# Build everything
pnpm build

# Type check
pnpm check-types

# Run a specific service
cd services/market-briefing && npm run dev
```

Each service runs independently with its own `.env.*` files and can be started in isolation.

---

## Tech Stack

| Layer | Tools |
|-------|-------|
| **Monorepo** | pnpm workspaces, Turborepo |
| **Frontend** | React 19, Vite, Tailwind, shadcn/ui, Zustand, TanStack Query |
| **Backend** | Express.js, MongoDB/Mongoose, Redis, BullMQ |
| **AI/LLM** | Vercel AI SDK, OpenAI (GPT-4/5-mini), text-embedding-3-small |
| **Scraping** | Puppeteer, Apify, snoowrap, googleapis |
| **Finance APIs** | Yahoo Finance, MFAPI, AMFI, NSE, Kuvera, Groww |
| **External** | NPCI (UPI), CRIF (credit), Finfactor (AA), Gmail API |
| **Infra** | AWS (S3, SES, SQS), Sentry, Cloudinary |
