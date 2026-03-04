# Pending Tasks — CAMS Analysis Engine

Last updated: 2026-03-01

## What's Done

### Data Pipeline (Complete)
- Browser automation to request CAMS statements (Puppeteer)
- Gmail polling + PDF download
- PDF parsing into `MFDetailedStatementData` (handles both Abhishek & Ashu portfolios)
- Statement request workflow (`src/jobs/statements.workflow.ts`)

### Analysis Engine — Phase 1: Core (Complete)
All 11 modules implemented in `src/core/analyse/modules/`:
- PortfolioSummary, XIRR Calculator, Transaction Timeline, Cashflow
- Benchmark Comparison, Sector Analysis, Company Exposure
- Market Cap Allocation, Asset Allocation, TER Analysis, Coverage

### Analysis Engine — Phase 2: Enrichment (Complete)
All providers in `src/core/analyse/enrichment/`:
- BenchmarkProvider (Yahoo Finance `chart()` API — migrated from deprecated `historical()`)
- AMFIMasterProvider (AMFI NAVAll.txt — with counterpart finding + fuzzy name matching)
- FundMetadataProvider (captnemo + AMFI fallback with category-based TER estimates)
- HoldingsProvider (local Excel parsing — no automated download)
- MarketCapResolver (Yahoo Finance search + quoteSummary)
- NAVProvider (MFAPI.in — implemented but not wired into engine)

### Analysis Engine — Insights Layer (Complete)
All files in `src/core/analyse/insights/`:
- BehavioralAnalyser (cadence, timing signals, emotional signals, diversification)
- AnomalyDetector (9 anomaly types: no nominees, micro holdings, concentration, dormant, etc.)
- NarrativeGenerator (LLM-powered via Vercel AI SDK + OpenAI)
- LLMInsightsEngine (orchestrator — degrades gracefully without API key)

### What-If Scenarios — 3 of 6 (Partial)
Implemented in `src/core/analyse/what-if/`:
- FD vs MF
- Worst Fund Removed
- Direct vs Regular

### Types (Complete for all planned modules)
All type definitions exist in `src/types/analysis/`:
- `analysis.type.ts` — PortfolioAnalysis master type (has slots for all 16 modules)
- `analysis-sections.type.ts` — Types for all sections including unimplemented ones
- `what-if.type.ts`, `insights.type.ts`, `enrichment.type.ts`

---

## Pending Tasks

### P1 — Advanced Analysis Modules

Types already defined in `analysis-sections.type.ts`. Need implementation files in `src/core/analyse/modules/`.

#### 1. Overlap Analyser
**File**: `src/core/analyse/modules/overlap.analyser.ts`
**Type**: `OverlapResult` (pairwise overlap, common companies, common weight)
**Depends on**: Holdings data (from HoldingsProvider)
**Logic**:
- For each pair of active funds with holdings data, compute % common holdings by weight
- Flag pairs with >40% overlap as redundant diversification
- Output: list of fund pairs with overlap %, common company count, combined weight
**Blocked by**: No holdings data available without AMC Excel files (Issue #2 in external-data-issues.md)

#### 2. Risk Metrics Analyser
**File**: `src/core/analyse/modules/risk-metrics.analyser.ts`
**Type**: `RiskMetricsResult` (portfolio volatility, Sharpe, max drawdown, per-scheme metrics)
**Depends on**: NAV history (from NAVProvider — implemented but not wired)
**Logic**:
- Fetch daily NAV history for each active scheme via MFAPI.in
- Compute annualized volatility, Sharpe ratio (vs 6% risk-free), max drawdown, recovery days
- Portfolio-level: weighted volatility, combined drawdown from cashflow-weighted NAV series
**Wiring needed**:
  1. In `analysis-engine.ts` → `runEnrichment()`: use `AMFIMasterProvider.getSchemeCode(isin)` to get AMFI code, then `NAVProvider.fetch(code)` for each active scheme
  2. Pass NAV history map to risk metrics analyser
  3. Helpers already exist: `financialMath.ts` has `volatility()`, `maxDrawdown()`, `dailyReturns()`, `sharpeRatio()` (may need to add `sharpeRatio`)

#### 3. Tax Harvesting Analyser
**File**: `src/core/analyse/modules/tax-harvesting.analyser.ts`
**Type**: `TaxHarvestingResult` (STCG/LTCG breakdown, exemption tracking, harvest opportunities)
**Depends on**: Transaction data (already in `MFDetailedStatementData`)
**Logic**:
- FIFO lot-level holding period analysis per folio
- Classify each lot as STCG (<12mo for equity, <36mo for debt) or LTCG
- Equity LTCG: 12.5% above ₹1.25L exemption; STCG: 20%
- Debt: taxed at slab rate (no indexation post-2023)
- Identify harvestable losses (sell at loss to offset gains)
- Flag lots approaching LTCG threshold (can wait N days to save tax)
**No external dependencies** — pure computation on parsed statement data

#### 4. SIP Analysis Analyser
**File**: `src/core/analyse/modules/sip-analysis.analyser.ts`
**Type**: `SIPAnalysisResult` (SIP schemes, regularity score, missed months)
**Depends on**: Transaction data (already in `MFDetailedStatementData`)
**Logic**:
- Detect SIP patterns: regular monthly purchases of similar amounts in same scheme
- For each detected SIP: amount, frequency, missed months, regularity score (0-100)
- Identify lumpsum-only investors vs SIP investors
- Flag stopped SIPs, irregular SIPs, amount changes
**No external dependencies** — pure computation on parsed statement data

#### 5. Rebalance Analyser
**File**: `src/core/analyse/modules/rebalance.analyser.ts`
**Type**: `RebalanceResult` (allocation drift, actions, fund signals)
**Depends on**: Sector/asset allocation data + TER + benchmark comparison
**Logic**:
- Define target allocation model (age-based default or user-specified)
- Compare current allocation (equity/debt/gold by %) against target
- Compute drift per dimension (asset class, market cap, sector)
- Generate prioritized rebalance actions (SIP redirect, new money, harvest)
- Fund signals: flag underperforming funds (vs benchmark), high overlap, high TER
**Partially blocked by**: Need holdings for sector-level drift; basic equity/debt/gold drift works from statement data alone

---

### P2 — Additional What-If Scenarios

The `WhatIfEngine` already has placeholder comments for these. Each is a separate file in `src/core/analyse/what-if/`.

#### 6. SIP vs Lumpsum Scenario
**File**: `src/core/analyse/what-if/sip-vs-lumpsum.scenario.ts`
**Depends on**: NAV history (MFAPI.in)
**Logic**: For lumpsum purchases, simulate if the same amount was deployed via monthly SIP. Use actual NAV history to compute hypothetical SIP units purchased.

#### 7. Started Earlier Scenario
**File**: `src/core/analyse/what-if/started-earlier.scenario.ts`
**Depends on**: NAV history (MFAPI.in)
**Logic**: "What if you had started investing 2 years earlier?" Use earliest investment date, shift all cashflows back 2 years, replay through actual NAV history.

#### 8. Index Fund Alternative Scenario
**File**: `src/core/analyse/what-if/index-fund-alt.scenario.ts`
**Depends on**: Benchmark data (Yahoo Finance — already available)
**Logic**: "What if you had put everything in a Nifty 50 index fund?" Replay all cashflows through Nifty 50 index, compare with actual portfolio value.

---

### P3 — Storage & API Layer

#### 9. MongoDB Schema for Analysis Results
**Directory**: `src/schema/analysis/`
**Files needed**:
- `analysis-results.schema.ts` — Store full `PortfolioAnalysis` per requestId
- `enrichment-cache.schema.ts` — TTL-cached enrichment data (benchmark prices, metadata, market caps)
**Pattern**: Follow existing `src/schema/statements/` pattern with Mongoose

#### 10. Analysis Service
**File**: `src/services/analysis/analysis.service.ts`
**Pattern**: Extend `src/services/base-service.ts`
**Methods**: `createAnalysis()`, `getByRequestId()`, `getLatestForPAN()`, `deleteByRequestId()`

#### 11. API Routes
**File**: `src/server/routes/analysis.route.ts`
**Endpoints**:
```
GET  /api/v1/analysis/:requestId           — Full analysis
GET  /api/v1/analysis/:requestId/summary   — Portfolio summary + XIRR
GET  /api/v1/analysis/:requestId/sectors   — Sector breakdown
GET  /api/v1/analysis/:requestId/companies — Company exposure
GET  /api/v1/analysis/:requestId/benchmark — Fund vs benchmark
GET  /api/v1/analysis/:requestId/risk      — Risk + tax harvesting
GET  /api/v1/analysis/:requestId/timeline  — Transactions + cashflows
POST /api/v1/analysis/run                  — Trigger analysis for a requestId
```

#### 12. Workflow Integration
**File**: `src/jobs/statements.workflow.ts` (modify existing)
**Change**: After PDF parsing completes, auto-trigger analysis:
```typescript
const engine = new AnalysisEngine();
const analysis = await engine.analyse(data, request.requestId);
await analysisService.createAnalysis(analysis);
```

---

### P4 — Data Source Improvements

#### 13. AMC Portfolio Holdings Download
**Issue**: #2 in `docs/external-data-issues.md`
**Impact**: Unlocks sector analysis, company exposure, asset allocation, market cap, overlap detection
**Options**:
- Puppeteer scraper per AMC (10 major AMCs)
- Third-party aggregator (Morningstar/ValueResearch)
- Manual monthly download to `holdings/` directory
**Ashu already scraped some**: Check `ashu-work/extracted/` for existing Excel files

#### 14. Improve TER Estimates with NAV-based Calculation
**Current**: Category-based industry averages (tagged `amfi-estimated-ter`)
**Improvement**: For each Regular fund, find its Direct counterpart ISIN from AMFI master (already implemented via `findCounterpart()`), fetch 1-year NAV history from MFAPI.in for both, compute actual return difference = precise TER spread.
**Impact**: More accurate TER analysis and commission cost estimates

#### 15. Wire NAV Provider into Analysis Engine
**Current**: `NAVProvider` is implemented but not called from `runEnrichment()`
**Needed for**: Risk Metrics (task #2), SIP vs Lumpsum what-if (#6), Started Earlier what-if (#7)
**Steps**:
1. In `runEnrichment()`: for each active ISIN, get AMFI scheme code, call `NAVProvider.fetch(code)`
2. Store in `Map<string, SchemeNAVHistory>` and pass to analysis modules
3. Rate limit: MFAPI.in has no auth but batch gently (5 concurrent)

---

## Recommended Pickup Order

**Quick wins (no external deps):**
1. Tax Harvesting Analyser (#3) — pure computation, high user value
2. SIP Analysis (#4) — pure computation, useful behavioral insight
3. Index Fund Alternative what-if (#8) — benchmark data already available

**Medium effort (needs NAV wiring):**
4. Wire NAV Provider (#15) — unblocks multiple modules
5. Risk Metrics Analyser (#2) — needs NAV history
6. SIP vs Lumpsum what-if (#6) — needs NAV history
7. Started Earlier what-if (#7) — needs NAV history

**Needs holdings data first:**
8. Overlap Analyser (#1) — blocked on holdings
9. Rebalance Analyser (#5) — partially blocked

**Production readiness:**
10. MongoDB Schema (#9) + Service (#10) + API Routes (#11) + Workflow (#12)

**Data quality:**
13. AMC Holdings download (#13)
14. NAV-based TER calculation (#14)
