# Mutual Fund Analysis & Insights Engine - Implementation Plan

---

## 1. What We Have Today

### 1.1 Current Pipeline (Working)

The project currently handles **data acquisition** end-to-end:

1. **Statement Generator** (`src/core/generator/`) - Browser automation (Puppeteer + stealth) submits forms on CAMS website to request consolidated mutual fund statements. Uses AES-256 encryption, proxy rotation.

2. **Email Fetcher** (`src/core/parsing/fetch-report.ts`) - Polls user's Gmail via OAuth for the CAMS statement email, downloads the PDF attachment.

3. **Statement Parser** (`src/core/parsing/statement-parser.ts`) - Parses the CAMS PDF into structured JSON (`MFDetailedStatementData`) with investor info, portfolio summary, folio details, NAV snapshots, and full transaction history.

4. **Workflow Orchestrator** (`src/jobs/statements.workflow.ts`) - Ties together: request → poll email → parse PDF → store in MongoDB.

### 1.2 Parsed Data Shape (from `parsed.json` - real account)

```
Investor:
  - name, email, PAN, mobile, address

Portfolio Summary (10 fund houses):
  - Total cost: INR 18,68,000
  - Total market value: INR 22,91,999

18 Folios, each with:
  - Fund house, folio number
  - Scheme: name, ISIN, plan (Direct/Regular), option (Growth/Dividend), registrar (CAMS/KFINTECH)
  - NAV snapshot: nav, navDate, costValue, marketValue
  - Opening/closing unit balances
  - Transaction history: date, type, amount, nav, units, unitBalanceAfter, stampDuty
  - Transaction types: Purchase, SIP, Redemption, Switch In/Out, STP, SWP, Dividend, NFO, Bonus, Merger, Stamp Duty
```

### 1.3 Ashu's Python Analysis (Reference / Inspiration Only)

Ashu built `recompute_mf_analysis_v2.py` (1,565 lines) as a manual analysis script. We use his work **only as inspiration** for what analysis modules to build. **We do NOT use any of his CSV files, data files, or scraped Excel files.** All data fetching happens independently through our own enrichment providers hitting public APIs and AMC websites directly.

His outputs serve as a reference for what's possible:

| Output                                  | Description                                               |
| --------------------------------------- | --------------------------------------------------------- |
| `cas_portfolio_summary.csv`             | AMC-level cost and market values                          |
| `scheme_xirr.csv`                       | Per-scheme XIRR with reliability scoring                  |
| `fund_performance_vs_benchmark.csv`     | Funds vs Nifty 500 benchmark                              |
| `scheme_sector_distribution_broad.csv`  | 11 sector categories per fund                             |
| `company_exposure_weighted.csv`         | Top company holdings with ISINs                           |
| `allocation_marketcap_style.csv`        | Large/Mid/Small cap distribution                          |
| `ter_commission_analysis.csv`           | TER Regular vs Direct, commission risk                    |
| Markdown reports                        | Executive summary with all metrics                        |

---

## 2. What We're Building

A production-grade TypeScript analysis engine that:

- Takes `MFDetailedStatementData` (already parsed) as input
- Enriches it with public mutual fund data (AMC holdings, benchmarks, market cap, fund metadata)
- Runs **22+ analysis modules** across 4 categories:
  - **Core Analytics** (11 modules) - portfolio summary, XIRR, benchmarks, sectors, etc.
  - **Advanced Analytics** (5 modules) - overlap, risk metrics, tax harvesting, SIP analysis, rebalancing
  - **What-If Scenarios** (8+ scenarios) - alternate reality simulations with shock value
  - **LLM-Powered Insights** - narrative generation, behavioral analysis, anomaly explanation
- Exports a single `AnalysisEngine` class from `index.ts` that can be used anywhere
- Produces **recurring insights** (daily/weekly/monthly) from changing public data

**No API routes in this phase** - just a class you import and call. APIs come later.

---

## 3. Data Independence Declaration

**We fetch ALL data independently. Nothing from Ashu's work folder is used at runtime.**

| Data needed | Our source | NOT from Ashu |
|------------|-----------|--------------|
| Fund holdings (stocks per MF) | AMC websites, scraped fresh | Not `ashu-work/analysis_output/source_files/*.xlsx` |
| Benchmark prices | yahoo-finance2, NiftyIndices.com | Not Ashu's yfinance cache |
| Market cap data | yahoo-finance2 search + quoteSummary | Not `marketcap_lookup_cache.csv` |
| TER data | AMFI TER reports | Not `ter_commission_analysis.csv` |
| Sector classification | Our own keyword classifier | Not Ashu's Python function |
| Transaction data | `parsed.json` (from our parser) | Not Ashu's `extracted/*.json` |

Ashu's work is a **design reference** showing what analysis is valuable. Our implementation fetches everything fresh.

---

## 4. Architecture

```
MFDetailedStatementData (from parser)
        │
        ▼
┌─ AnalysisEngine ────────────────────────────────────────────┐
│                                                              │
│  ┌─ Enrichment Layer (parallel fetches, MongoDB cached) ──┐  │
│  │  BenchmarkProvider    → yahoo-finance2 + NiftyIndices   │  │
│  │  HoldingsProvider     → AMC website Excel downloads     │  │
│  │  MarketCapResolver    → yahoo-finance2                  │  │
│  │  NAVProvider          → mfapi.in (free API)             │  │
│  │  FundMetadataProvider → mf.captnemo.in (Kuvera data)    │  │
│  │  TERProvider          → AMFI website reports            │  │
│  │  InflationProvider    → RBI / data.gov.in               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Core Analytics (pure computation) ─────────────────────┐  │
│  │  PortfolioSummary  │  XIRR Calculator                   │  │
│  │  Benchmark Compare │  Sector Analyser                   │  │
│  │  Company Exposure  │  MarketCap Analyser                │  │
│  │  Asset Allocation  │  Transaction Timeline              │  │
│  │  Cashflow Analysis │  TER Analyser                      │  │
│  │  Coverage                                               │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Advanced Analytics ────────────────────────────────────┐  │
│  │  Overlap Analyser    │  Risk Metrics                    │  │
│  │  Tax Harvesting      │  SIP Analysis                    │  │
│  │  Rebalance Engine (deep, multi-dimensional)             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ What-If Scenarios Engine ──────────────────────────────┐  │
│  │  SIP vs Lumpsum      │  Direct vs Regular               │  │
│  │  Index Fund Alt      │  Top Fund in Category            │  │
│  │  Worst Fund Removed  │  Started 1 Year Earlier          │  │
│  │  If Rebalanced       │  If Bought Stocks Directly       │  │
│  │  → Picks top 3-4 relevant per user                      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ LLM Insights Layer ───────────────────────────────────┐  │
│  │  Narrative Generator   │  Behavioral Analyser           │  │
│  │  Anomaly Explainer     │  Risk Communicator             │  │
│  │  What-If Storyteller   │  Market Context Connector      │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Recurring Insights ───────────────────────────────────┐  │
│  │  Daily: NAV changes, market moves vs holdings           │  │
│  │  Weekly: category rank changes, AUM flow signals        │  │
│  │  Monthly: rebalance check, TER changes, new holdings    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                              │
│              ▼                                               │
│     PortfolioAnalysis (single composite result)              │
└──────────────────────────────────────────────────────────────┘
        │
        ▼
  export class AnalysisEngine { analyse(data): PortfolioAnalysis }
```

### 4.1 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Analysis modules are pure functions | No I/O inside modules | Testable, parallelizable, no side effects |
| Single composite output document | One `PortfolioAnalysis` object | Easy to store, query, pass around |
| Enrichment cached in MongoDB | TTL-indexed collections | Structured data with varying TTLs (24h to 30d) |
| No API routes now | Just export a class | You wire it into APIs when ready |
| What-If scenarios are selective | Show top 3-4 per user | Not all scenarios make sense for every portfolio |
| LLM calls are optional | Engine works without LLM | Statistical analysis is the foundation; LLM adds narrative layer on top |
| All data fetched independently | No files from Ashu's work | Production-grade, self-contained |

---

## 5. File Structure

```
src/
├── core/
│   └── analyse/
│       ├── index.ts                              # MAIN EXPORT: AnalysisEngine class
│       ├── analysis-engine.ts                    # Orchestrator implementation
│       │
│       ├── enrichment/
│       │   ├── index.ts
│       │   ├── benchmark.provider.ts             # yahoo-finance2 + NiftyIndices
│       │   ├── nav.provider.ts                   # mfapi.in NAV history
│       │   ├── holdings.provider.ts              # AMC portfolio Excel downloads
│       │   ├── holdings-config.ts                # AMC source URL + column mappings
│       │   ├── marketcap.resolver.ts             # yahoo-finance2 market cap
│       │   ├── fund-metadata.provider.ts         # mf.captnemo.in (TER, rating, AUM, manager)
│       │   ├── ter.provider.ts                   # AMFI TER reports
│       │   └── inflation.provider.ts             # RBI/data.gov.in CPI data
│       │
│       ├── modules/
│       │   ├── index.ts
│       │   ├── portfolio-summary.analyser.ts
│       │   ├── xirr.calculator.ts
│       │   ├── benchmark.analyser.ts
│       │   ├── sector.analyser.ts
│       │   ├── company-exposure.analyser.ts
│       │   ├── marketcap.analyser.ts
│       │   ├── asset-allocation.analyser.ts
│       │   ├── transaction-timeline.analyser.ts
│       │   ├── cashflow.analyser.ts
│       │   ├── ter.analyser.ts
│       │   ├── coverage.analyser.ts
│       │   ├── overlap.analyser.ts
│       │   ├── risk-metrics.analyser.ts
│       │   ├── tax-harvesting.analyser.ts
│       │   ├── sip-analysis.analyser.ts
│       │   └── rebalance.analyser.ts
│       │
│       ├── what-if/
│       │   ├── index.ts
│       │   ├── what-if-engine.ts                 # Picks top 3-4 relevant scenarios
│       │   ├── sip-vs-lumpsum.scenario.ts
│       │   ├── direct-vs-regular.scenario.ts
│       │   ├── index-fund-alt.scenario.ts
│       │   ├── top-fund-in-category.scenario.ts
│       │   ├── worst-fund-removed.scenario.ts
│       │   ├── started-earlier.scenario.ts
│       │   ├── if-rebalanced.scenario.ts
│       │   ├── if-bought-stocks.scenario.ts
│       │   └── fd-vs-mf.scenario.ts
│       │
│       ├── insights/
│       │   ├── index.ts
│       │   ├── llm-insights.engine.ts            # Orchestrates LLM calls
│       │   ├── narrative.generator.ts            # Portfolio stories
│       │   ├── behavioral.analyser.ts            # Investment pattern detection
│       │   ├── anomaly.explainer.ts              # Flags + explains anomalies
│       │   └── recurring-insights.engine.ts      # Daily/weekly/monthly triggers
│       │
│       └── helpers/
│           ├── financial-math.ts
│           ├── normalization.ts
│           ├── sector-classifier.ts
│           ├── benchmark-mapper.ts
│           └── cashflow-builder.ts
│
├── types/
│   └── analysis/
│       ├── index.ts
│       ├── analysis.type.ts                      # PortfolioAnalysis master type
│       ├── analysis-sections.type.ts             # Core + advanced section types
│       ├── what-if.type.ts                       # What-if scenario types
│       ├── insights.type.ts                      # LLM insight types
│       └── enrichment.type.ts                    # Enrichment data types
│
├── schema/
│   └── analysis/
│       ├── analysis-results.schema.ts
│       └── enrichment-cache.schema.ts
│
├── services/
│   └── analysis/
│       └── analysis.service.ts
│
└── scripts/
    └── run-analysis.ts
```

---

## 6. Data Enrichment Layer (Public Data Sources)

### 6.1 Benchmark Provider (`enrichment/benchmark.provider.ts`)

**Source**: `yahoo-finance2` (already installed) + NiftyIndices.com for TRI data

**Tickers**:
- Nifty 50: `^NSEI`
- Nifty 500: `^CRSLDX`
- Nifty Midcap 150: `^NSEMDCP50`
- Nifty Smallcap 250 (for small cap benchmarking)

**Also fetches**: Total Returns Index (TRI) data from NiftyIndices.com for accurate benchmark comparison (price index doesn't include dividends, TRI does).

**Computation**:
```
1. Fetch historical close prices
2. Total return = (endPrice / startPrice - 1) * 100
3. CAGR = ((endPrice / startPrice) ^ (1/years) - 1) * 100
4. Volatility = annualized stddev of daily returns * sqrt(252) * 100
5. Max drawdown = min of (cumulative / peak - 1) * 100
```

**Cache**: MongoDB `analysis.benchmarks`, TTL 24h

---

### 6.2 NAV Provider (`enrichment/nav.provider.ts`)

**Source**: [MFAPI.in](https://api.mfapi.in/) - free, no auth, all Indian mutual funds

**What it provides**:
- Daily NAV history for any scheme by AMFI code
- Scheme metadata (fund house, category, scheme type)
- ISIN mapping

**Endpoints**:
- `GET /mf/{amfiCode}` → full NAV history (with optional `startDate`, `endDate`)
- `GET /mf/{amfiCode}/latest` → latest NAV
- `GET /mf/search?q={query}` → search schemes

**Cache**: MongoDB `analysis.navHistory`, TTL 24h. AMFI master list cached 7 days.

---

### 6.3 Fund Metadata Provider (`enrichment/fund-metadata.provider.ts`) - NEW

**Source**: [mf.captnemo.in](https://mf.captnemo.in/) - unofficial Kuvera API, free, rich data

**What it provides per ISIN** (via `GET /kuvera/{isin}`):
- `expense_ratio` - current TER (more reliable than AMFI scraping)
- `fund_manager` - who manages the fund
- `fund_rating` - star rating
- `crisil_rating` - CRISIL rank (1-5, 1 = top 10%)
- `aum` - current AUM in crores
- `returns` - 1W, 1Y, 3Y, 5Y, since inception returns
- `volatility` - pre-computed volatility
- `lock_in_period` - for ELSS etc.
- `category`, `fund_type`, `plan` (direct/regular)
- `sip_min`, `lump_min` - minimum investment amounts

**Why this matters**: This single API gives us fund ratings, AUM, manager info, and pre-computed returns that would otherwise require scraping 5 different websites. Critical for shock-value insights like "your fund is rated 2 stars" or "your fund's AUM dropped 40%".

**Cache**: MongoDB `analysis.fundMetadata`, TTL 24h

---

### 6.4 Holdings Provider (`enrichment/holdings.provider.ts`)

**Source**: AMC websites (monthly portfolio disclosure - SEBI mandated)

**Strategy (3 tiers)**:

| Tier | Source | Method |
|------|--------|--------|
| Tier 1 | RapidAPI India MF Portfolio Holding API | `GET /api/{amfiCode}` for holdings |
| Tier 2 | AMC website Excel downloads | axios download + `xlsx` parse |
| Tier 3 | Manual/cached fallback | MongoDB collection for edge cases |

**We do NOT use Ashu's downloaded files.** We download fresh from AMC websites. The `holdings-config.ts` maps each AMC to its download URL and Excel column format.

**Cache**: MongoDB `analysis.fundHoldings`, TTL 30 days (AMCs publish monthly)

---

### 6.5 Market Cap Resolver (`enrichment/marketcap.resolver.ts`)

**Source**: `yahoo-finance2` search + quoteSummary

**Classification** (SEBI definition):
- Top 100 by market cap → Large Cap
- 101-250 → Mid Cap
- 251+ → Small Cap
- Non-IN ISIN → Global Equity
- No data → Unclassified

**Optimization**: Process by portfolio weight, stop at 97% cumulative coverage.

**Cache**: MongoDB `analysis.marketCapCache`, TTL 7 days

---

### 6.6 TER Provider (`enrichment/ter.provider.ts`)

**Source**: AMFI TER reports + mf.captnemo.in as fallback

**What it does**: Gets both Regular and Direct plan TER for every scheme, enabling commission cost analysis.

**Cache**: MongoDB `analysis.terData`, TTL 30 days

---

### 6.7 Inflation Provider (`enrichment/inflation.provider.ts`) - NEW

**Source**: RBI DBIE / data.gov.in

**What it provides**:
- Monthly CPI inflation data
- 91-day T-Bill yield (risk-free rate proxy, currently ~5.3%)
- RBI repo rate

**Why this matters**: Enables **real return** calculation. "Your fund returned 8% but inflation was 5.2% - your real return was only 2.8%." This is a massive shock-value insight most platforms don't show.

**Cache**: MongoDB `analysis.macroData`, TTL 7 days

---

### 6.8 AMFI Master List (`enrichment/amfi-master.provider.ts`) - NEW

**Source**: `https://www.amfiindia.com/spages/NAVAll.txt`

**What it provides**:
- Every registered scheme with code, ISIN, NAV, and **category classification**
- Category headers in the file give SEBI-mandated category for every scheme (e.g., "Open Ended Schemes(Equity Scheme - Large Cap Fund)")

**Why this matters**: Enables **peer comparison**. Group all schemes in same category, compute category average return, rank user's fund within category. "Your fund is in the bottom 25% of Large Cap funds."

**Cache**: MongoDB `analysis.amfiMaster`, TTL 24h

---

## 7. Core Analysis Modules (Detailed)

### 7.1 Portfolio Summary Analyser

**Input**: `MFDetailedStatementData`
**Output**: `PortfolioSummaryResult`

```
1. Aggregate portfolioSummary by fundHouse (cost, market, gain, gain%, weight)
2. Total unrealised gain = totalMarketValue - totalCostValue
3. Separate active folios (closingUnitBalance > 0) from closed
4. Sum all purchase cashflows → totalInvested
5. Sum all redemption cashflows → totalWithdrawn
6. lifetimePnL = totalWithdrawn + totalMarketValue - totalInvested
7. lifetimeReturnPct = lifetimePnL / totalInvested * 100
```

---

### 7.2 XIRR Calculator

**Input**: `MFDetailedStatementData`, `asOfDate`
**Output**: `XIRRAnalysisResult`

**Core implementation**: bisection method, 200 iterations, converge within 1e-9.

**Cashflow sign convention** (critical):

| Transaction Type | Investor Cashflow |
|-----------------|-------------------|
| Purchase / SIP | **-amount** (money going out) |
| Redemption / SWP | **+amount** (money coming in) |
| Switch In | **-amount** (treated as purchase) |
| Switch Out | **+amount** (treated as redemption) |
| Stamp Duty / STT | **-amount** (charge) |
| Dividend Reinvest | **0** (internal) |
| Merger / Bonus | **0** (internal) |

**Reliability scoring**: < 90 days or < INR 1,000 → Low Sample; < 180 days or < INR 10,000 → Medium Sample; else → High.

---

### 7.3 Benchmark Comparison

Compares each fund's XIRR against the appropriate benchmark (Nifty 500 default, Nifty Midcap for mid/small cap schemes). Also computes portfolio-level benchmarks.

Gap buckets: |gap| >= 3 → Large, >= 1 → Medium, > 0 → Small, else Neutral.

---

### 7.4 Sector Analyser

11 broad sectors via keyword matching: Financial Services, Healthcare, Technology, Consumer, Industrials, Energy, Utilities, Materials, Communication Services, Real Estate, Others.

Weighted by (schemeWeight * holdingPctOfNAV / 100).

---

### 7.5 Company Exposure Analyser

Groups equity holdings by ISIN (or normalized company name). Adds **concentration risk metrics**: top 5/10/20 weights, Herfindahl index.

---

### 7.6 Market Cap Analyser

Large/Mid/Small/Global classification. Per-scheme and portfolio-level breakdown.

---

### 7.7 Asset Allocation Analyser

Equity/Debt/Others from AMC disclosure totals, weighted by scheme market value.

---

### 7.8 Transaction Timeline Analyser

Daily and fund-level investment/withdrawal patterns. Annual net cashflows.

---

### 7.9 TER Analyser

**Logic**:
```
For each active scheme:
  1. Get Regular and Direct TER
  2. TER spread = regularTER - directTER
  3. Commission risk: >= 0.9% → High, >= 0.5% → Medium, < 0.5% → Low

For Direct plan holders (like you):
  - Show: "You saved Rs X this year by being in Direct plans"
  - Annual savings = sum of (marketValue * terSpread / 100)

For Regular plan holders:
  - Show: "You're paying Rs X/year in hidden commissions"
  - Show potential savings from switching to Direct
```

---

### 7.10 Coverage Analyser

Percentage of portfolio with underlying holdings data mapped.

---

## 8. Advanced Analysis Modules

### 8.1 Overlap Analyser

Pairwise fund overlap detection. If two funds share > 40% of holdings by weight, flag as warning.

**Example**: "Your 3 Quant funds (Active, ELSS, Flexi) have 60%+ overlap. You're paying 3 expense ratios for nearly the same portfolio."

---

### 8.2 Risk Metrics Analyser

Per-scheme and portfolio-level: annualized volatility, Sharpe ratio (vs 91-day T-Bill rate from inflation provider), Sortino ratio, max drawdown, drawdown recovery time.

**NEW - Real returns**: `realReturn = nominalReturn - inflationRate`. Most platforms show nominal returns only.

---

### 8.3 Tax Harvesting Analyser

FIFO lot-level analysis. Classifies each lot as STCG (<12mo) or LTCG (>=12mo). Estimates tax liability. Tracks Rs 1.25L annual LTCG exemption usage.

**NEW - Tax-aware timing**: "Unit lot X becomes LTCG in 23 days. Wait to save 7.5% tax (20% STCG vs 12.5% LTCG)."

---

### 8.4 SIP Analysis

Detects SIP patterns, monthly amount, missed months, regularity score. Also detects **lumpsum-only** investors (like the parsed.json account which has zero SIPs).

---

### 8.5 Rebalance Analyser (Deep Implementation)

This is significantly more complex than the previous plan. Inspired by PowerUp Money's rebalancing approach but going deeper.

#### 8.5.1 Multi-Dimensional Drift Detection

Rebalancing isn't one thing - it's measured across 4 dimensions:

**Dimension 1: Asset Class (Primary - highest impact on risk)**
```
Target allocation based on investor profile:
  Aggressive (20s-30s): 75% equity, 15% debt, 10% gold
  Moderate (35-50):     60% equity, 30% debt, 10% gold
  Conservative (50+):   35% equity, 55% debt, 10% gold

Drift = |Current Weight - Target Weight|
Portfolio Drift = Sum(|Current_i - Target_i|) / 2
Trigger: any single asset class drifts > 5% absolute
```

**Dimension 2: Market Cap (within equity)**
```
Target: Large 50-60%, Mid 20-30%, Small 10-20%
Bull markets skew toward small/mid (they rally harder)
Trigger: any bucket drifts > 10% relative
```

**Dimension 3: Sector Concentration**
```
Flag: any single sector > 30% of equity allocation
Flag: Financial Services is typically over-concentrated in Indian portfolios
```

**Dimension 4: Fund-Level (PowerUp-style)**
```
For each fund, compare against category peers:
  - If fund is in bottom 25% of category over 3Y → flag for switch
  - If fund manager changed recently → flag for review
  - If AUM declining > 20% QoQ → flag as warning
  - Only switch within same category (large cap → large cap)
```

#### 8.5.2 Tax-Optimized Rebalancing Strategy

**Priority order (least to most tax-costly)**:

1. **SIP Redirect** (zero tax): Change where new SIP money goes to underweight asset class. Calculate how many months of redirected SIP it would take to close the drift. If fixable within 3-6 months, prefer this.

2. **New Money Allocation** (zero tax): Direct any new lumpsum investments to underweight classes.

3. **LTCG Harvest** (tax-efficient): Sell overweight positions that are held > 12 months and fall within Rs 1.25L annual LTCG exemption. This is **free** rebalancing.

4. **Tax-Loss Harvesting** (tax-saving): Sell positions at a loss to offset gains from other rebalancing sales. Short-term losses offset both STCG and LTCG.

5. **LTCG Sell** (12.5% tax): Sell overweight positions held > 12 months. Better than STCG.

6. **STCG Sell** (20% tax, last resort): Only sell positions held < 12 months if drift is severe and no other option.

**Exit load check**: Before any sell recommendation, verify if the position is still within exit load period (typically 1% for redemption within 1 year for equity funds).

#### 8.5.3 Rebalancing Output

```typescript
{
  // Current state
  currentAllocation: { dimension: string; bucket: string; currentPct: number; targetPct: number; driftPct: number }[];
  portfolioDrift: number;  // aggregate drift score
  needsRebalancing: boolean;  // true if any trigger breached

  // Recommended actions (ordered by tax efficiency)
  actions: {
    priority: number;
    type: 'SIP_REDIRECT' | 'NEW_MONEY' | 'LTCG_HARVEST' | 'TAX_LOSS_HARVEST' | 'LTCG_SELL' | 'STCG_SELL';
    fromScheme?: string;
    toCategory: string;
    amount: number;
    taxImpact: number;
    exitLoadImpact: number;
    reason: string;
    monthsToFixViaSIP?: number;  // if SIP redirect, how long to close drift
  }[];

  // Fund-level signals
  fundSignals: {
    scheme: string;
    signal: 'UNDERPERFORMING' | 'MANAGER_CHANGED' | 'AUM_DECLINING' | 'HIGH_OVERLAP' | 'OK';
    categoryRank: string;  // "Bottom 25%", "Top 10%", etc.
    detail: string;
  }[];

  // Cost of NOT rebalancing (for what-if)
  estimatedDriftCost: {
    ifNotRebalancedFor6Months: number;  // estimated return drag
    ifNotRebalancedFor1Year: number;
  };
}
```

---

## 9. What-If Scenarios Engine (Shock Value)

This is the **most impactful user-facing feature**. Each scenario replays the user's exact investment journey (same dates, same amounts) through an alternate reality.

**The engine picks the top 3-4 most relevant scenarios per user.** Not all scenarios apply to everyone.

### 9.1 Scenario Selection Logic

```typescript
// Each scenario has a relevance score. Show top 3-4 by score.
function selectScenarios(data: MFDetailedStatementData, analysis: CoreAnalysis): WhatIfScenario[] {
  const candidates = [
    { scenario: 'SIP_VS_LUMPSUM',       relevant: hasLumpsumInvestments(data) },
    { scenario: 'DIRECT_VS_REGULAR',     relevant: true },  // always relevant, framed differently
    { scenario: 'INDEX_FUND_ALT',        relevant: hasActivelyManagedFunds(data) },
    { scenario: 'TOP_FUND_IN_CATEGORY',  relevant: hasUnderperformers(analysis) },
    { scenario: 'WORST_FUND_REMOVED',    relevant: analysis.schemeXIRR.some(s => s.xirr < 0) },
    { scenario: 'STARTED_EARLIER',       relevant: true },
    { scenario: 'IF_REBALANCED',         relevant: analysis.rebalance.needsRebalancing },
    { scenario: 'IF_BOUGHT_STOCKS',      relevant: analysis.companyExposure.companies.length > 0 },
    { scenario: 'FD_VS_MF',             relevant: true },
    { scenario: 'INFLATION_ADJUSTED',    relevant: true },
  ];
  // Score by magnitude of difference (|actual - hypothetical|) and sort
  return computeAndRank(candidates).slice(0, 4);
}
```

### 9.2 SIP vs Lumpsum

**When relevant**: User made lumpsum investments (the parsed.json account is 100% lumpsum)

**Logic**:
```
For each lumpsum purchase:
  1. Take the amount and date
  2. Instead of investing full amount on that date:
     - Split into 6 equal monthly SIPs starting from that date
     - For each SIP installment, look up the NAV on that date (from MFAPI.in)
     - Calculate units purchased at each NAV
  3. Compare total units: lumpsum vs SIP
  4. Calculate hypothetical current value with SIP units
```

**Shock framing**:
- If lumpsum was better: "Your timing was great. SIPs would have given you Rs X less."
- If SIP was better: "Monthly SIPs would have earned you Rs X more by averaging out the highs and lows."

---

### 9.3 Direct vs Regular

**When relevant**: Always. Framed differently depending on what user holds.

**Logic**:
```
For each scheme:
  1. Get both Regular and Direct TER from fund metadata
  2. TER spread = Regular TER - Direct TER
  3. For each year of holding:
     hypotheticalValue = actualValue * (1 + terSpread/100) ^ years

For Direct plan holders (framing: "you saved"):
  "Because you chose Direct plans, you saved Rs X over Y years in commissions."

For Regular plan holders (framing: "you could save"):
  "Switching to Direct plans would save you Rs X per year."
  "Over the life of your investments, you've paid Rs Y in hidden commissions."
```

**Shock value**: The compound effect of even 0.5% TER difference over 10 years is massive. On Rs 20L portfolio at 0.8% average spread, that's Rs 16,000/year growing at 12% - over 10 years that's Rs 2.8L+ in lost returns.

---

### 9.4 Index Fund Alternative

**When relevant**: User holds actively managed funds

**Logic**:
```
For each actively managed fund:
  1. Determine the appropriate index (large cap → Nifty 50, mid cap → Nifty Midcap 150, etc.)
  2. Replay every transaction at the index NAV on the same dates
  3. Calculate hypothetical current value

Sum across all funds:
  "If you had invested in index funds instead, your portfolio would be Rs X"
```

**Shock value**: Most actively managed funds underperform their benchmark after fees. This is the single most eye-opening insight for many investors.

---

### 9.5 Top Fund in Category

**When relevant**: User has underperforming funds

**Logic**:
```
For each fund:
  1. Get its SEBI category (from AMFI master list)
  2. Find the top-performing fund in that category over the same period
  3. Replay user's exact transactions into the top fund (using its NAV history)
  4. Show the difference

"Your ICICI Large Cap returned 12%. The top large cap fund (Quant Large Cap) returned 28%.
 If you had been in the top fund, your Rs 2.85L would be Rs 3.65L instead of Rs 3.20L."
```

**Note**: This is hindsight bias by design - the point is to motivate the user to review their fund selection, not to predict the future.

---

### 9.6 Worst Fund Removed

**When relevant**: User has funds with negative or very low XIRR

**Logic**:
```
1. Identify the worst-performing scheme by XIRR
2. Hypothetical: those same amounts invested into the user's best-performing scheme
3. Show the difference

"Your worst fund (ABSL PSU Equity at -3% XIRR) cost you Rs 15,000.
 If that money had been in your best fund (Quant Small Cap at 28% XIRR),
 you'd have Rs 42,000 more."
```

---

### 9.7 Started 1 Year Earlier

**When relevant**: Always (especially powerful for newer investors)

**Logic**:
```
1. Take the user's first investment date
2. Shift ALL transactions back by 12 months (or 6 months)
3. Replay using historical NAVs for those earlier dates
4. Compare

"If you had started investing just 1 year earlier with the same amounts,
 your portfolio would be Rs X more today."
```

**Shock value**: Shows the cost of procrastination. Particularly powerful when the shifted period includes a market dip followed by a rally.

---

### 9.8 If Rebalanced (PowerUp-style)

**When relevant**: User's portfolio has significant drift OR underperforming funds

**Logic** (the most complex scenario):
```
1. Take the portfolio state from 6 months ago (reconstruct from transactions)
2. Apply our rebalance engine's recommendations at that point:
   - Switch underperforming funds (bottom 25% of category) → top fund in category
   - Fix asset class drift → redirect to underweight class
   - All switches optimized for tax (prefer LTCG, use 1.25L exemption)
3. Simulate the next 6 months with the rebalanced portfolio
4. Compare against actual (un-rebalanced) portfolio

"If you had rebalanced 6 months ago following our strategy:
 - Switched ICICI Large Cap → [top large cap fund]
 - Moved 10% from equity to debt (you were overweight equity)
 Your portfolio would be Rs X more, and your tax cost would have been only Rs Y."
```

**This is our killer feature** - it shows the tangible cost of NOT using our rebalancing engine, creating urgency to adopt it.

---

### 9.9 If Bought Stocks Directly

**When relevant**: User has significant company exposure through MFs

**Logic**:
```
1. Take the top 5 company holdings from the company exposure analysis
   (e.g., HDFC Bank 7.5%, ICICI Bank 5.3%, Infosys 3.7%)
2. For each: what if user had bought that stock directly on the same dates
   they invested in the MF that holds it?
3. Use historical stock price from Yahoo Finance
4. Compare stock return vs fund return

"Your top holding through MFs is HDFC Bank (7.5% of portfolio).
 If you had bought HDFC Bank stock directly, that portion would be
 Rs X instead of Rs Y - [better/worse] by Z%."
```

**Shock value**: Sometimes individual stocks massively outperform (or underperform) the fund that holds them. It makes users think about concentration vs diversification.

---

### 9.10 FD vs Mutual Fund

**When relevant**: Always (the classic comparison)

**Logic**:
```
1. Take all investment cashflows (dates + amounts)
2. Calculate what a bank FD at 7% annual would have returned
   (use quarterly compounding, TDS at 30% for income > Rs 40k)
3. Compare against actual portfolio value

"Your mutual funds earned Rs 4.24L on Rs 18.68L invested (22.7% total).
 A bank FD at 7% would have earned Rs 2.95L (15.8% total).
 Your MFs beat the FD by Rs 1.29L - but with significantly more volatility."
```

---

### 9.11 What-If Output Type

```typescript
interface WhatIfResult {
  scenarios: WhatIfScenario[];  // top 3-4 selected for this user
}

interface WhatIfScenario {
  id: string;
  name: string;
  description: string;  // 1-line human explanation of what this scenario tests
  relevanceScore: number;  // 0-100, used for selection

  actual: {
    totalInvested: number;
    currentValue: number;
    xirr: number;
  };

  hypothetical: {
    totalInvested: number;  // same as actual (same money, different allocation)
    hypotheticalValue: number;
    hypotheticalXirr: number;
  };

  difference: {
    absoluteAmount: number;
    percentageDifference: number;
    userDidBetter: boolean;
  };

  // For LLM to narrate
  dataPointsForNarrative: Record<string, string | number>;
}
```

---

## 10. LLM-Powered Insights Engine

### 10.1 Where LLM Adds Genuine Value vs Where It Doesn't

| Task | Use LLM? | Why |
|------|----------|-----|
| XIRR / CAGR calculation | No | Math library |
| Sector classification | No | Keyword matching |
| Overlap detection | No | Set intersection |
| "10 purchases totaling Rs 2.85L" | No | Template string |
| **Explaining WHY a pattern matters** | **Yes** | Contextual reasoning |
| **Connecting portfolio to market events** | **Yes** | Requires world knowledge |
| **Risk metaphors in plain language** | **Yes** | Creative communication |
| **Behavioral observations** | **Yes** | Pattern interpretation |
| **What-if storytelling** | **Yes** | Making numbers compelling |
| **Anomaly prioritization + explanation** | **Yes** | Judgment + nuance |

### 10.2 The Two-Layer Architecture

```
Layer 1: Statistical Engine (TypeScript, deterministic)
  → Computes ALL numbers: XIRR, sector weights, overlaps, what-if values
  → Produces a NarrativeContext object with pre-computed data points

Layer 2: LLM Narrative Engine (optional, adds human-readable stories)
  → Takes NarrativeContext as input
  → NEVER does math
  → Generates stories, explanations, behavioral observations
```

### 10.3 What the LLM Generates

**A. Portfolio Headline** (Haiku - cheap, fast)
```
Input: { totalReturn: 22.7%, xirr: 14.2%, benchmarkXirr: 12.1%, holdingCount: 18 }
Output: "Your portfolio is beating the market by 2.1% - but 35% is concentrated in one fund house."
```

**B. Holding-Level Insights** (Haiku)
```
Per scheme, one insight sentence:
"Your HDFC Gold ETF has returned 49.2% since May 2025 - nearly 3x a savings account."
"Quant Infrastructure at -8% from peak, but still 16% above your cost basis."
```

**C. Behavioral Observations** (Sonnet - needs pattern reasoning)

Pre-compute behavioral signals, then ask LLM to interpret:
```typescript
interface BehavioralSignals {
  investmentCadence: { avgDaysBetween: number; stdDevDays: number; longestGapDays: number };
  amountPatterns: { avgAmount: number; roundNumberBias: number; increasingTrend: boolean };
  timingSignals: {
    purchasesDuringDips: number;    // bought within 5% of local NAV minima
    purchasesDuringPeaks: number;   // bought within 5% of local NAV maxima
    redemptionsDuringDips: number;  // panic selling signal
  };
  emotionalSignals: {
    panicSelling: { scheme: string; date: string; navDropPct: number }[];
    fomoChasing: { scheme: string; date: string; priorRallyPct: number }[];
    lossAversion: { scheme: string; holdingMonthsAtLoss: number }[];
  };
}
```

LLM output: "You invest in round amounts (Rs 5K, 10K, 50K) on a consistent schedule - this disciplined approach has served you well. One pattern worth noting: 3 of your 4 purchases in October 2024 were during a market rally, which slightly raised your average cost."

**D. Anomaly Detection + Explanation** (Sonnet)

Pre-compute anomalies, then ask LLM to explain and prioritize:
```typescript
interface PortfolioAnomalies {
  noNominees: string[];           // Folios without nominees
  microHoldings: { scheme: string; value: number; pct: number }[];  // < 1% of portfolio
  fundHouseConcentration: { house: string; pct: number }[];         // > 25%
  dormantHoldings: { scheme: string; monthsInactive: number }[];    // No tx in 12+ months
  sameCategory Duplicates: { scheme1: string; scheme2: string; category: string }[];
}
```

LLM prioritizes: "URGENT: None of your 18 folios have nominees. If something happens to you, your family will face significant delays accessing these funds."

**E. What-If Storytelling** (Haiku - it's just narration of pre-computed numbers)
```
"Here's a thought experiment: if you had spread your Rs 50,000 Quant Active purchase
across 6 monthly SIPs instead, you would have Rs 52,300 today instead of Rs 48,700.
The market dipped 8% in month 3 of that period - SIPs would have caught that dip."
```

**F. Risk Communication** (Sonnet - nuance matters)
```
"Your portfolio is dressed for summer - it does great in sunshine but has no umbrella for rain.
With 95% in equity and 0% in debt, a 20% market correction would temporarily wipe out
Rs 4.4L from your portfolio. That is real money - enough to fund 8 months of SIPs."
```

### 10.4 Model Selection & Cost

| Insight Type | Model | Cost per call |
|-------------|-------|---------------|
| Portfolio headline | Haiku | ~$0.002 |
| Holding insights (all) | Haiku | ~$0.004 |
| What-if narratives | Haiku | ~$0.002 |
| Behavioral observation | Sonnet | ~$0.02 |
| Risk communication | Sonnet | ~$0.015 |
| Anomaly explanation | Sonnet | ~$0.015 |
| **Total per full analysis** | | **~$0.06** |

### 10.5 Caching

LLM insights are cached and refreshed only when:
- New statement is parsed (portfolio changed)
- Market context is stale (> 24h for market-linked insights)
- User explicitly requests refresh

---

## 11. Recurring Insights Engine

Not all insights require a new statement. Public data changes constantly - we can deliver value between statement refreshes.

### 11.1 Daily Insights (from NAV changes + market data)

**Data needed**: Latest NAV (from MFAPI.in), market indices (yahoo-finance2)

**Insights generated**:
- "Your portfolio moved +Rs 12,340 today (+0.54%)"
- "Nifty fell 2.3% but your portfolio only fell 1.1% - your diversification is working"
- "Your largest holding (Quant Active) hit a 52-week high today"
- "HDFC Bank (your #1 stock exposure at 7.5%) reported Q3 results - stock up 4%"

### 11.2 Weekly Insights (from category rankings + AUM flows)

**Data needed**: AMFI category data, fund metadata (ratings, AUM)

**Insights generated**:
- "Your fund ICICI Large Cap dropped from top 40% to bottom 30% in its category this week"
- "Quant Mutual Fund saw Rs 2,000 Cr outflow this month - investors are leaving"
- "Your fund's CRISIL rating changed from Rank 2 to Rank 3"
- "3 new ELSS funds launched this week - here's how they compare to your Quant ELSS"

### 11.3 Monthly Insights (from holdings changes + rebalance check)

**Data needed**: New AMC portfolio disclosures, TER updates

**Insights generated**:
- "Your fund manager at ICICI Large Cap changed. New manager has 3 years experience"
- "AMC portfolio update: Quant Active increased HDFC Bank from 5% to 8% of holdings"
- "Your portfolio drift is now 7.2% - time to consider rebalancing"
- "Rs 23,000 of your LTCG exemption is unused with 2 months left in the financial year"
- "TER for Mirae Large Cap (Direct) increased from 0.45% to 0.52%"

### 11.4 Implementation

```typescript
class RecurringInsightsEngine {
  // Call daily with just the user's scheme codes (no new statement needed)
  async generateDailyInsights(schemeISINs: string[], lastAnalysis: PortfolioAnalysis): DailyInsight[]

  // Call weekly
  async generateWeeklyInsights(schemeISINs: string[], lastAnalysis: PortfolioAnalysis): WeeklyInsight[]

  // Call monthly (or when new AMC disclosure data is available)
  async generateMonthlyInsights(schemeISINs: string[], lastAnalysis: PortfolioAnalysis): MonthlyInsight[]
}
```

---

## 12. Additional Shock-Value Data Points

Beyond the modules above, these data points from our enrichment layer create moments of "I had no idea":

| Insight | Data Source | Shock Factor |
|---------|-----------|-------------|
| "Your fund is rated 2 stars by CRISIL" | mf.captnemo.in | High - most people don't know their fund's rating |
| "After inflation, your debt fund lost money" | RBI CPI + NAV | Very High - nobody thinks about real returns |
| "You've paid Rs 8,400 in stamp duty across all SIPs" | Computed from transactions (0.005% per purchase) | Medium - hidden cost |
| "Your fund took 8 months to recover from the 2024 crash; category average was 5" | NAV history drawdown analysis | High - recovery time is scarier than drop % |
| "The risk-free rate was 5.3%. Your fund returned 7%. You took huge risk for 1.7% extra" | T-bill yield + XIRR | Very High - Sharpe ratio made visceral |
| "Your fund has only Rs 50 Cr AUM - closure risk" | mf.captnemo.in AUM | High for small funds |
| "80% of your mid-cap fund's top holdings are the same as your flexi-cap fund" | Holdings overlap | High - false diversification exposed |
| "If you had invested the same on the worst possible day in the last 5 years, you'd still have made X%" | NAV history | Positive shock - reduces fear |

---

## 13. Output Type (Master)

```typescript
interface PortfolioAnalysis {
  analysisId: string;
  requestId: string;
  investor: { name: string; email: string; pan: string };
  statementPeriod: { from: string; to: string };
  analysedAt: Date;
  asOfDate: string;

  // Core Analytics (11 modules)
  portfolioSummary: PortfolioSummaryResult;
  activeHoldings: ActiveHolding[];
  xirrAnalysis: XIRRAnalysisResult;
  benchmarkComparison: BenchmarkComparisonResult;
  sectorAnalysis: SectorAnalysisResult;
  companyExposure: CompanyExposureResult;
  marketCapAllocation: MarketCapAllocationResult;
  assetAllocation: AssetAllocationResult;
  transactionTimeline: TransactionTimelineResult;
  cashflowAnalysis: CashflowAnalysisResult;
  terAnalysis: TERAnalysisResult;
  coverageAnalysis: CoverageResult;

  // Advanced Analytics (5 modules)
  overlapAnalysis: OverlapResult;
  riskMetrics: RiskMetricsResult;
  taxHarvesting: TaxHarvestingResult;
  sipAnalysis: SIPAnalysisResult;
  rebalanceAnalysis: RebalanceResult;

  // What-If Scenarios (top 3-4 selected per user)
  whatIfScenarios: WhatIfResult;

  // LLM Insights (optional - engine works without this)
  insights?: LLMInsightsResult;

  // Metadata
  enrichmentMeta: {
    holdingsCoverage: number;
    benchmarkDataAvailable: boolean;
    marketCapCoverage: number;
    dataSourcesUsed: string[];
    fundMetadataAvailable: boolean;
    inflationDataAvailable: boolean;
  };
}

// The LLM insights, generated separately
interface LLMInsightsResult {
  headline: string;
  performanceStory: string;
  holdingInsights: { schemeName: string; insight: string }[];
  behavioralObservation: string;
  whatIfNarratives: { scenarioId: string; narrative: string }[];
  riskExplanation: string;
  anomalies: { severity: 'critical' | 'warning' | 'info'; title: string; explanation: string }[];
}
```

---

## 14. Export Interface

No API routes. Just a class exported from `index.ts`:

```typescript
// src/core/analyse/index.ts
import { AnalysisEngine } from './analysis-engine';
export { AnalysisEngine };
export type { PortfolioAnalysis } from '../../types/analysis';

// Usage anywhere:
import { AnalysisEngine } from './core/analyse';

const engine = new AnalysisEngine();
const result = await engine.analyse(parsedData, requestId);

// For recurring insights (no new statement needed):
const daily = await engine.getDailyInsights(schemeISINs, lastAnalysis);
const weekly = await engine.getWeeklyInsights(schemeISINs, lastAnalysis);

// For LLM insights (optional layer):
const insights = await engine.generateInsights(result);  // calls LLM
```

---

## 15. Storage

### 15.1 Results Collection (`analysis.results`)

```
Indexes:
  - analysisId: unique
  - requestId: for lookup by statement request
  - investor.pan: for lookup by user (latest analysis)
  - analysedAt: for time-based queries
```

### 15.2 Enrichment Cache Collections

| Collection | TTL | Purpose |
|-----------|-----|---------|
| `analysis.benchmarks` | 24h | Benchmark price data |
| `analysis.navHistory` | 24h | Scheme NAV history |
| `analysis.fundHoldings` | 30 days | AMC portfolio holdings |
| `analysis.marketCapCache` | 7 days | Stock market cap classification |
| `analysis.terData` | 30 days | Expense ratio data |
| `analysis.fundMetadata` | 24h | Fund ratings, AUM, manager (from captnemo) |
| `analysis.macroData` | 7 days | Inflation, T-bill yield, repo rate |
| `analysis.amfiMaster` | 24h | Full scheme list with categories |

---

## 16. Workflow Integration

Current workflow in `src/jobs/statements.workflow.ts`:
```
1. Request statement  → submitRequest()
2. Poll email         → pollForEmail()
3. Parse PDF          → parseStatement()
4. Store in MongoDB   → updateRequest()
```

After step 4, add:
```
5. Analyse            → engine.analyse(data, requestId)
6. Store results      → analysisService.createAnalysis(result)
7. Generate insights  → engine.generateInsights(result)  // optional LLM layer
```

Also available standalone via `src/scripts/run-analysis.ts`.

---

## 17. Implementation Phases

### Phase 1: Foundation
**What**: Types + helpers + XIRR + portfolio summary + transaction timeline + cashflow

**Files**:
- `src/types/analysis/*` (all type files)
- `src/core/analyse/helpers/financial-math.ts`
- `src/core/analyse/helpers/normalization.ts`
- `src/core/analyse/helpers/cashflow-builder.ts`
- `src/core/analyse/modules/portfolio-summary.analyser.ts`
- `src/core/analyse/modules/xirr.calculator.ts`
- `src/core/analyse/modules/transaction-timeline.analyser.ts`
- `src/core/analyse/modules/cashflow.analyser.ts`
- `src/core/analyse/analysis-engine.ts` (skeleton)
- `src/core/analyse/index.ts` (export)
- `src/schema/analysis/analysis-results.schema.ts`
- `src/scripts/run-analysis.ts`

**No enrichment needed** - works purely on parsed data.

---

### Phase 2: Enrichment + Core Analysis
**What**: All data providers + benchmark/sector/company/asset/coverage analysis

**Files**:
- All `src/core/analyse/enrichment/*.ts`
- `src/core/analyse/helpers/sector-classifier.ts`
- `src/core/analyse/helpers/benchmark-mapper.ts`
- `src/core/analyse/modules/benchmark.analyser.ts`
- `src/core/analyse/modules/sector.analyser.ts`
- `src/core/analyse/modules/company-exposure.analyser.ts`
- `src/core/analyse/modules/asset-allocation.analyser.ts`
- `src/core/analyse/modules/coverage.analyser.ts`
- `src/core/analyse/modules/marketcap.analyser.ts`
- `src/core/analyse/modules/ter.analyser.ts`

**New dependency**: `npm install xlsx`

---

### Phase 3: Advanced Analytics
**What**: Overlap, risk metrics, tax harvesting, SIP analysis, deep rebalancing

**Files**:
- `src/core/analyse/modules/overlap.analyser.ts`
- `src/core/analyse/modules/risk-metrics.analyser.ts`
- `src/core/analyse/modules/tax-harvesting.analyser.ts`
- `src/core/analyse/modules/sip-analysis.analyser.ts`
- `src/core/analyse/modules/rebalance.analyser.ts`

---

### Phase 4: What-If Scenarios Engine
**What**: All scenario modules + selection logic

**Files**:
- `src/core/analyse/what-if/what-if-engine.ts`
- `src/core/analyse/what-if/sip-vs-lumpsum.scenario.ts`
- `src/core/analyse/what-if/direct-vs-regular.scenario.ts`
- `src/core/analyse/what-if/index-fund-alt.scenario.ts`
- `src/core/analyse/what-if/top-fund-in-category.scenario.ts`
- `src/core/analyse/what-if/worst-fund-removed.scenario.ts`
- `src/core/analyse/what-if/started-earlier.scenario.ts`
- `src/core/analyse/what-if/if-rebalanced.scenario.ts`
- `src/core/analyse/what-if/if-bought-stocks.scenario.ts`
- `src/core/analyse/what-if/fd-vs-mf.scenario.ts`

---

### Phase 5: LLM Insights + Recurring Insights
**What**: Narrative generation, behavioral analysis, anomaly detection, recurring triggers

**Files**:
- `src/core/analyse/insights/llm-insights.engine.ts`
- `src/core/analyse/insights/narrative.generator.ts`
- `src/core/analyse/insights/behavioral.analyser.ts`
- `src/core/analyse/insights/anomaly.explainer.ts`
- `src/core/analyse/insights/recurring-insights.engine.ts`

---

### Phase 6: Storage + Production Hardening
**What**: MongoDB schemas, service layer, error handling, caching

**Files**:
- `src/schema/analysis/enrichment-cache.schema.ts`
- `src/services/analysis/analysis.service.ts`
- Error handling and retry logic in enrichment providers
- Rate limiting for Yahoo Finance / MFAPI.in calls
- Logging throughout pipeline

---

## 18. Dependencies

**Existing** (already in package.json):
- `yahoo-finance2` - benchmarks, market cap
- `mongoose` - MongoDB
- `axios` - HTTP requests

**New** (to add):
- `xlsx` (SheetJS) - parsing AMC portfolio Excel files
- `@anthropic-ai/sdk` - for LLM insights layer (if not already present)

---

## 19. Potential Data Quality Issues

| Data Source | Known Issue | Mitigation |
|-----------|-------------|-----------|
| yahoo-finance2 | Indian MF NAVs often missing or delayed | Use MFAPI.in as primary for NAV, yahoo only for benchmarks/stocks |
| AMC Excel downloads | Format changes without notice, column names vary per AMC | Robust column detection + fallback to captnemo data |
| mf.captnemo.in | Unofficial API, could go down | Cache aggressively (24h), fallback to AMFI direct |
| AMFI NAVAll.txt | Delayed by 1 business day | Acceptable for analysis purposes |
| Market cap from Yahoo | Some Indian stocks don't map well (different exchange codes) | Try NSE suffix (.NS), then BSE suffix (.BO), then skip |
| CPI data from data.gov.in | May have API auth changes | Cache for 7 days, hardcode fallback (5% default inflation) |
| AMC holdings | Only updated monthly (SEBI mandate) | Use latest available, note staleness in enrichmentMeta |

---

## 20. Validation Strategy

| Module | Validate Against |
|--------|-----------------|
| Portfolio Summary | `parsed.json` totals: cost 18,68,000 / market 22,91,999 |
| XIRR | Cross-check with Excel XIRR function on same cashflows |
| Benchmark | Yahoo Finance historical prices (manual spot check) |
| Sector | Compare against AMC factsheet published sector allocation |
| What-If: FD vs MF | Manual calculation with known FD rate and compounding |
| What-If: Direct vs Regular | Manual TER spread compounding check |
| Rebalance Drift | Compare against PrimeInvestor rebalancing calculator (manual) |
| LLM Insights | Human review for accuracy of narrated numbers |
