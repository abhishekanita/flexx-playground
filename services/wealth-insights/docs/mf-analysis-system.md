# MF Analysis System — Complete Reference

> Last updated: 2026-03-02 | Branch: `feature/improvment`

---

## System Overview

**Pipeline**: CAMS PDF → Parser → `MFDetailedStatementData` → Analysis Engine (16 modules + 7 enrichment providers + 8 what-if scenarios + insights) → `PortfolioAnalysis` + `DashboardData` + `InsightCards`

**Storage**: 6 MongoDB collections — `mfs.user.folios`, `mfs.user.transactions`, `mfs.user.snapshot`, `mfs.user.insights`, `mfs.enriched.cache`, `mfs.market.schemes`

**External Data**: Yahoo Finance (benchmarks, market caps), MFAPI.in (NAV history), AMFI (scheme master), Kuvera (fund metadata), Groww (holdings, risk stats), OpenAI (LLM insights)

```
CAMS PDF
    ↓
[Statement Parser] → MFDetailedStatementData
    ↓
[Analysis Engine]
    ├─ Phase 1: Pure Computation (6 modules) ─────────── always runs
    ├─ Phase 2: Enrichment (7 providers, parallel) ──── async, external APIs
    ├─ Phase 3: Enrichment-Dependent (9 modules) ────── depends on Phase 2
    ├─ Phase 4: What-If + Dashboard ──────────────────── runs on completed analysis
    └─ Phase 5: LLM Insights (optional, separate call)
```

---

## 1. Analysis Modules (16 total)

All modules live in `src/core/analyse/modules/`. Each is a static class with an `analyse()` method.

### Phase 1 — Pure Computation (no external calls)

| # | Module | File | Output Type | Key Metrics |
|---|--------|------|-------------|-------------|
| 1 | **Portfolio Summary** | `portfolio-summary.analyser.ts` | `PortfolioSummaryResult` | Total cost/market value, unrealised gain, lifetime P&L, fund house breakdown, folio counts |
| 2 | **XIRR Calculator** | `xirr.calculator.ts` | `XIRRAnalysisResult` | Portfolio XIRR (with/without charges), per-scheme XIRR with reliability tiers (High/Medium/Low/Insufficient) |
| 3 | **Transaction Timeline** | `transaction-timeline.analyser.ts` | `TransactionTimelineResult` | Daily invested/withdrawn timeline, per-fund entries, annual cashflows |
| 4 | **Cashflow Analyser** | `cashflow.analyser.ts` | `CashflowAnalysisResult` | Total invested/withdrawn/stamp duty, annual + monthly breakdowns |
| 5 | **SIP Analyser** | `sip.analyser.ts` | `SIPAnalysisResult` | SIP pattern detection (3+ txns, 25-35d interval, ±20% amount), frequency (Weekly/Monthly/Quarterly/Irregular), regularity score (0-100), missed months, `isLumpsumOnly` flag |
| 6 | **Tax Harvesting** | `tax-harvesting.analyser.ts` | `TaxHarvestingResult` | FIFO lot tracking, STCG/LTCG classification (365d boundary), per-folio unrealised gain, estimated tax (LTCG 12.5%, STCG 20%), ₹1.25L exemption tracking, `daysToLTCG` |

### Phase 2 — Enrichment-Dependent

| # | Module | File | Output Type | Needs |
|---|--------|------|-------------|-------|
| 7 | **Benchmark Comparison** | `benchmark.analyser.ts` | `BenchmarkComparisonResult` | Benchmarks (Yahoo Finance) |
| 8 | **TER Analyser** | `ter.analyser.ts` | `TERAnalysisResult` | Fund metadata (Kuvera) |
| 9 | **Sector Analyser** | `sector.analyser.ts` | `SectorAnalysisResult` | Holdings data |
| 10 | **Company Exposure** | `company-exposure.analyser.ts` | `CompanyExposureResult` | Holdings data |
| 11 | **Asset Allocation** | `asset-allocation.analyser.ts` | `AssetAllocationResult` | Holdings data |
| 12 | **Market Cap Allocation** | `marketcap.analyser.ts` | `MarketCapAllocationResult` | Holdings + market caps |
| 13 | **Coverage Analyser** | `coverage.analyser.ts` | `CoverageResult` | Holdings data |
| 14 | **Overlap Analyser** | `overlap.analyser.ts` | `OverlapResult` | Holdings data |
| 15 | **Risk Metrics** *(async)* | `risk-metrics.analyser.ts` | `RiskMetricsResult` | Groww stats OR NAV history |

### Standalone

| # | Module | File | Output Type | Notes |
|---|--------|------|-------------|-------|
| 16 | **Dashboard Data** | `dashboard-data.computer.ts` | `DashboardData` | Pure computation on completed `PortfolioAnalysis`. Produces hero stats, fund race, heatmap, benchmark bars, fund cards, sector/asset/market-cap charts, real-world equivalents |

### Module Detail Notes

**XIRR Reliability Tiers:**
- `Insufficient`: <30 days OR <₹500
- `Low Sample`: <90 days OR <₹1,000
- `Medium Sample`: <180 days OR <₹10,000
- `High`: ≥180 days AND ≥₹10,000

**SIP Detection Algorithm:**
1. Collect Purchase/SIP transactions sorted by date
2. Compute intervals between consecutive purchases
3. SIP pattern = 3+ txns with median interval 25-35d AND amounts within 20% of median
4. Classify: Monthly (25-35d), Weekly (5-9d), Quarterly (80-100d), Irregular
5. `regularityScore = (1 - missedMonths / expectedMonths) × 100`

**Tax Harvesting (FIFO):**
- Purchase types that create lots: Purchase, SIP, Switch In, STP In, NFO Allotment, Dividend Reinvestment
- Zero-cost lots: Bonus, Merger
- Redemptions consume lots FIFO (oldest first)
- Tax: LTCG 12.5% (≥365d), STCG 20% (<365d), ₹1.25L annual LTCG exemption

**Risk Metrics — Hybrid Data Path:**
1. **Preferred**: Pre-computed Groww `riskStats.sharpe`, `riskStats.sortino`, `riskStats.stdDev`
2. **Fallback**: AMFI scheme code → MFAPI.in NAV history → compute from prices
3. Portfolio-level: market-value-weighted averages of per-scheme metrics
4. Risk-free rate: 6.5% (Indian T-Bill proxy)

**Overlap Detection:**
- Normalizes company names across fund holdings
- Pairwise: `overlapPct = commonCompanies / unionSize × 100`
- `commonWeight = Σ min(weight_A, weight_B)` for shared holdings
- Warning threshold: >40% overlap

---

## 2. Enrichment Providers (7 total)

All live in `src/core/analyse/enrichment/`. Each has a 2-3 level cache strategy.

| Provider | File | Source | Cache TTL | Data Returned |
|----------|------|--------|-----------|---------------|
| **AMFI Master** | `amfi-master.provider.ts` | amfiindia.com/NAVAll.txt | 24h | Complete scheme index (code, ISIN, name, category, fund house). Lookup by ISIN, code, or fuzzy name match |
| **NAV Provider** | `nav.provider.ts` | api.mfapi.in | 24h | Daily NAV history per scheme. Dates in DD-MM-YYYY, stored oldest-first |
| **Benchmark Provider** | `benchmark.provider.ts` | Yahoo Finance | 24h | Historical prices + computed CAGR, volatility, max drawdown. Default: Nifty 50, Nifty 500, Nifty Midcap 150 |
| **Fund Metadata** | `fund-metadata.provider.ts` | Kuvera (mf.captnemo.in) + AMFI fallback | 24h | TER, returns, AUM, fund manager, CRISIL rating, peer comparisons. Category-based TER estimation when Kuvera unavailable |
| **Holdings Provider** | `holdings.provider.ts` | AMC Excel files or MongoDB cache | 30d | Per-scheme equity/debt/others holdings with % of NAV |
| **Groww Data** | `groww-data.provider.ts` | MongoDB `mfs.market.schemes` | — | Holdings (converted to `FundHoldingsSource`), risk stats, expense ratio, category rank. Populated by Groww scraper |
| **Market Cap Resolver** | `marketcap.resolver.ts` | Yahoo Finance | — | Market cap classification: Large/Mid/Small/Global/Unclassified |

### Cache Strategy (all providers)

```
Level 1: In-memory Map (per-process, instant)
Level 2: MongoDB mfs.enriched.cache (persistent, TTL-based)
Level 3: External API (cold fetch)
```

### Enrichment Flow in Analysis Engine

```
1. Load AMFI Master (needed as fallback)
2. Parallel:
   ├─ Fetch benchmarks (Yahoo Finance)
   └─ Fetch fund metadata (Kuvera + AMFI fallback)
3. Load holdings (Excel dir → MongoDB cache → Groww fallback)
4. Fetch Groww data for all active ISINs
5. Fill gaps: Groww → holdingsLookup, Groww → metadata augmentation
6. Resolve market caps for equity holdings
```

---

## 3. What-If Scenarios (8 total)

All live in `src/core/analyse/what-if/`. Orchestrated by `WhatIfEngine` which runs all, scores by relevance (0-100), returns top 4.

| # | Scenario | File | Sync/Async | Relevance | Data Needed |
|---|----------|------|------------|-----------|-------------|
| 1 | **FD vs Mutual Fund** | `fd-vs-mf.scenario.ts` | Sync | 90 (always) | Cashflows only |
| 2 | **Direct vs Regular** | `direct-vs-regular.scenario.ts` | Sync | 95 (Regular) / 70 (Direct) | None |
| 3 | **Worst Fund Removed** | `worst-fund-removed.scenario.ts` | Sync | 50-100 | XIRR data |
| 4 | **SIP vs Lumpsum** | `sip-vs-lumpsum.scenario.ts` | Async | 55-75 | NAV history (MFAPI) |
| 5 | **Started 12mo Earlier** | `started-earlier.scenario.ts` | Async | 75 | NAV history (MFAPI) |
| 6 | **Top Fund in Category** | `top-fund-in-category.scenario.ts` | Sync | 55-80 | Fund metadata (comparisons) |
| 7 | **Index Fund Alternative** | `index-fund-alt.scenario.ts` | Sync | 50-80 | Benchmark prices |
| 8 | **If Bought Stocks** | `if-bought-stocks.scenario.ts` | Async | 55 | Company exposure + Nifty data |

### Scenario Output Shape (all)

```ts
WhatIfScenario {
    id: string;              // e.g. 'FD_VS_MF'
    name: string;            // Display name
    description: string;     // What-if question
    relevanceScore: number;  // 0-100
    actual:        { totalInvested, currentValue, xirr }
    hypothetical:  { totalInvested, hypotheticalValue, hypotheticalXirr }
    difference:    { absoluteAmount, percentageDifference, userDidBetter }
    dataPointsForNarrative: Record<string, any>  // for LLM narrative
}
```

### Key Assumptions

- **FD**: 7% annual (quarterly compounding), 30% TDS on interest >₹40k/year
- **TER Spreads**: Equity 0.8%, Debt 0.3%, Index 0.3%, Gold 0.4%
- **SIP Split**: Lumpsums >₹10k split into 6 monthly SIPs
- **Started Earlier**: All transactions shifted back 12 months
- **Index Fund Alt**: Only compares actively-managed funds (excludes index/ETF)
- **Stocks Proxy**: Uses Nifty 50 CAGR as stock performance proxy

---

## 4. Insights System

Lives in `src/core/analyse/insights/`.

### 4.1 LLM-Based (Narrative Generator)

| Component | File | Purpose |
|-----------|------|---------|
| **LLM Insights Engine** | `llm-insights.engine.ts` | Orchestrates all LLM insight generation |
| **Narrative Generator** | `narrative.generator.ts` | Produces `InsightCardsResult` via `generateObject()` (Vercel AI SDK + Zod) |
| **Behavioral Analyser** | `behavioral.analyser.ts` | Pre-computes behavioral signals (no LLM): investment cadence, amount patterns, timing signals, emotional signals (panic selling, FOMO, loss aversion), diversification |
| **Anomaly Detector** | `anomaly.detector.ts` | 14 rule-based checks: no nominees, too many funds, all Regular, micro holdings, concentration risk, dormant holdings, category duplicates, high unrealised loss, etc. |

**LLM Models**: `gpt-5-mini` via Vercel AI SDK
**Voice**: Friendly, plain English, lead with impact, bold key numbers, max 2 sentences per field

### 4.2 Rule-Based (Recurring Insights Engine)

| Component | File | Frequency | Triggers |
|-----------|------|-----------|----------|
| **Recurring Engine** | `recurring-insights.engine.ts` | daily/weekly/monthly | Orchestrates all triggers below |
| **NAV Milestone** | `triggers/nav-milestone.trigger.ts` | Daily | Fires when scheme NAV hits all-time high |
| **Tax Boundary** | `triggers/tax-boundary.trigger.ts` | Daily | Fires when STCG lot is <30 days from LTCG boundary |
| **Market Event** | `triggers/market-event.trigger.ts` | Daily | Fires when benchmark drops >5% in 5 trading days |
| **Fund Change** | `triggers/fund-change.trigger.ts` | Weekly | Fires on expense ratio or fund manager changes |

**Weekly also checks**: SIP consistency (missed months, low regularity score)
**Monthly also checks**: Fund overlap warnings from `overlapAnalysis`

---

## 5. Helper Utilities

All in `src/core/analyse/helpers/`.

| Helper | File | Key Functions |
|--------|------|--------------|
| **Financial Math** | `financial-math.ts` | `xirr()`, `xnpv()`, `cagr()`, `volatility()`, `sharpeRatio()`, `sortinoRatio()`, `maxDrawdown()`, `drawdownRecoveryDays()`, `dailyReturns()`, `parseDate()`, `daysBetween()` |
| **Cashflow Builder** | `cashflow-builder.ts` | `buildPortfolioCashflows()`, `buildFolioCashflows()`, `transactionToCashflow()`, `getTotalInvested()`, `getTotalWithdrawn()`, `getNetInvested()` |
| **Benchmark Mapper** | `benchmark-mapper.ts` | `mapSchemeToBenchmark()` — maps scheme name/category to Yahoo Finance ticker. Priority: name keywords > AMFI category > fallback (Nifty 500) |
| **Sector Classifier** | `sector-classifier.ts` | `classifySector()` — 11 broad sectors via keyword matching |
| **Normalization** | `normalization.ts` | `normalizeCompany()`, `normalizeText()`, `isValidISIN()`, `isinCountry()`, `cleanSchemeName()`, `formatINR()` |

### Cashflow Sign Convention

```
Purchase/SIP/Switch In/STP In    → negative (money OUT from investor)
Redemption/SWP/Switch Out/STP Out → positive (money IN to investor)
Stamp Duty / STT                  → negative (charge)
Dividend Reinvest / Bonus / Merger → 0 (internal, no real cashflow)
```

---

## 6. Storage Layer

### MongoDB Collections

| Collection | Schema Location | Purpose |
|-----------|----------------|---------|
| `mfs.user.folios` | `src/schema/` | User fund holdings with transactions |
| `mfs.user.transactions` | `src/schema/` | Deduplicated transactions (MD5 hash on pan\|folio\|date\|type\|units\|amount) |
| `mfs.user.snapshot` | `src/schema/` | Full analysis snapshots |
| `mfs.user.insights` | `src/schema/` | Historical insight cards log |
| `mfs.enriched.cache` | `src/schema/` | Enrichment data cache (TTL-based) |
| `mfs.market.schemes` | `src/schema/market/` | Groww market data (populated by scraper) |

### Service Layer

- `src/services/base-service.ts` — Abstract `BaseService<T>` with CRUD operations
- `src/services/enrichment-cache.service.ts` — get/set/getMany/setMany for `mfs.enriched.cache`
- `src/services/user/sync.service.ts` — Sync orchestrator (parse → store → analyse)
- `src/services/market/` — Market data services

---

## 7. Input Data Shape

**`MFDetailedStatementData`** (from `src/types/statements/mf-statements.type.ts`):

```
investor: { name, email, address, mobile, pan }
statementPeriod: { from, to }
totalCostValue, totalMarketValue: number
folios[]: {
    fundHouse, folioNumber: string
    scheme: { schemeName, scheme_code, isin, current_name, plan, option, registrar }
    investor: { nominees[], kycOk, panOk }
    openingUnitBalance, closingUnitBalance: number
    snapshot: { navDate, nav, totalCostValue, marketValue }
    transactions[]: {
        date: string          // "YYYY-MM-DD"
        type: TransactionType  // 14 types
        amount: number | null
        nav: number | null
        units: number
        unitBalanceAfter: number
    }
}
```

**Transaction Types** (14): Purchase, Redemption, SIP, SIP Redemption, Switch In, Switch Out, STP In, STP Out, SWP, Dividend Reinvestment, Dividend Payout, NFO Allotment, Bonus, Merger, Stamp Duty

---

## 8. Output Data Shape

**`PortfolioAnalysis`** (from `src/types/analysis/analysis.type.ts`):

```
analysisId, requestId: string
investor: { name, email, pan }
statementPeriod: { from, to }
analysedAt: Date
asOfDate: string

// Phase 1 (always present)
portfolioSummary:      PortfolioSummaryResult
activeHoldings:        ActiveHolding[]
xirrAnalysis:          XIRRAnalysisResult
transactionTimeline:   TransactionTimelineResult
cashflowAnalysis:      CashflowAnalysisResult
sipAnalysis:           SIPAnalysisResult | null
taxHarvesting:         TaxHarvestingResult | null

// Phase 2 (nullable — depends on enrichment)
benchmarkComparison:   BenchmarkComparisonResult | null
sectorAnalysis:        SectorAnalysisResult | null
companyExposure:       CompanyExposureResult | null
marketCapAllocation:   MarketCapAllocationResult | null
assetAllocation:       AssetAllocationResult | null
terAnalysis:           TERAnalysisResult | null
coverageAnalysis:      CoverageResult | null
overlapAnalysis:       OverlapResult | null
riskMetrics:           RiskMetricsResult | null

// Not yet implemented
rebalanceAnalysis:     RebalanceResult | null

// Computed
whatIfScenarios:       WhatIfResult | null
dashboardData:         DashboardData | null
insightCards:          InsightCardsResult | null
insights:              LLMInsightsResult | null

// Meta
enrichmentMeta: {
    holdingsCoverage, marketCapCoverage: number
    benchmarkDataAvailable, fundMetadataAvailable, inflationDataAvailable: boolean
    dataSourcesUsed: string[]
}
```

---

## 9. Scripts & Workflows

| Script | File | Purpose |
|--------|------|---------|
| **Run Scripts** | `src/scripts/run-scripts.ts` | Master orchestrator for analysis tasks |
| **Run Sync** | `src/scripts/run-sync.ts` | Full sync: parse CAMS PDF → store → analyse |
| **Run Groww Scraper** | `src/scripts/run-groww-scraper.ts` | Fetch/update Groww market data |

**Statement Acquisition Workflow**: `src/jobs/statements.workflow.ts`
**Groww Scraper**: `src/core/scraper/` — Scrapes scheme data from Groww (holdings, risk stats, expense ratios, category rankings)

---

## 10. Configuration

**Config** (`src/config/config.ts`):

| Key | Purpose |
|-----|---------|
| `db.uri` | MongoDB connection string |
| `openai.apiKey` | OpenAI API key (for LLM insights) |
| `google.*` | Gmail OAuth (for PDF download) |
| `capsolver.apiKey` | CAPTCHA solving (for CAMS automation) |
| `scraperApi.apiKey` | Scraper API key |
| `groww.baseUrl` | Groww API base URL |
| `dataimpulse.*` | Proxy config for scraping |

---

## 11. What's NOT Yet Built

| Module | Type | Status |
|--------|------|--------|
| **Rebalance Analyser** | Advanced Analytics | Types defined, not implemented |
| **Inflation-Adjusted Returns** | What-If | ID exists in type, not implemented |
| **If Rebalanced** | What-If | ID exists in type, not implemented |
| **SIP Consistency Trigger** | Recurring Insight | Inline in weekly insights (no separate trigger file) |

---

## 12. Key Conventions

- **Path aliases**: `@/` → `src/`
- **Module pattern**: Static class with `analyse()` method
- **Mongoose**: `I{Model}Doc extends Document`, collection naming `mfs.{domain}.{plural}`
- **Services**: Extend `BaseService<T>`
- **Transaction dedup**: MD5 hash of `pan|folioNumber|date|type|units|amount`
- **LLM calls**: Vercel AI SDK (`generateObject` + Zod schemas)
- **Folio display name**: `scheme.current_name` (not `scheme.schemeName`)
- **Date format**: ISO `YYYY-MM-DD` internally; MFAPI returns `DD-MM-YYYY`
- **Money**: All amounts in INR (₹). Market values in lakhs in some enrichment sources
- **Returns**: Percentages as numbers (12.5 = 12.5%, not 0.125) in output types; decimals (0.125) in financial-math internals
