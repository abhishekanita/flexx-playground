# External Data Source Issues

Known issues with enrichment data providers. Each section is a standalone task.

---

## 1. ~~Kuvera Metadata API — 404 for most ISINs~~ FIXED

**Provider**: `src/core/analyse/enrichment/fund-metadata.provider.ts`
**Status**: RESOLVED

**Problem**: captnemo API returned 404 for most ISINs (12/12 for Ashu, ~13/18 for Abhishek).

**Solution**: Added AMFI Master fallback in `fetchBatch()`:
1. Tries captnemo first (existing behavior, kept for ISINs it does support)
2. Falls back to AMFI Master for missing ISINs:
   - Gets scheme category, fund house, isDirect from AMFI scheme data
   - Estimates TER using category-based industry averages (2024-25 medians)
   - Finds Direct/Regular counterpart via `AMFIMasterProvider.findCounterpart()`
   - Builds `FundMetadata` with `tags: ['amfi-estimated-ter']` to flag estimated data
3. Result: **12/12 Ashu ISINs** and **18/18 Abhishek ISINs** now resolve
4. TER Analysis works for both portfolios (was completely skipped before)

**Remaining limitation**: TER values are category-based estimates, not actual scheme-level TERs. Could be improved by computing TER spread from Direct/Regular NAV divergence via MFAPI.in.

---

## 2. AMC Portfolio Holdings — No Direct Download URLs

**Provider**: `src/core/analyse/enrichment/holdings.provider.ts`
**Config**: `src/core/analyse/enrichment/holdings-config.ts`
**Impact**: Sector analysis, company exposure, asset allocation, market cap allocation, overlap detection — ALL skip when no holdings data
**Status**: OPEN

**Problem**: AMC portfolio disclosure Excel files cannot be fetched via stable direct-download URLs. Every AMC has a different setup:
- Some show a web page with a JS-rendered download button
- Some require form submission (select month/year, then download)
- URLs change monthly when new disclosures are published
- Some need captcha or login

**Current state**: Holdings provider only loads from local files (`loadFromDirectory()`). No automated fetching.

**Possible fixes**:
1. **Puppeteer scraper**: Build per-AMC scrapers using the browser client pattern already in the codebase. Navigate to disclosure page → click download → save Excel.
2. **Third-party aggregator**: Use a service like VR Online, Morningstar, or ValueResearch that aggregates holdings.
3. **Manual periodic download**: Download the ~10 key AMC files monthly and store in a `holdings/` directory. Wire into the analysis engine via `holdingsDir` option.
4. **Ashu already scraped some**: Check `ashu-work/extracted/` for existing Excel files that can be used as test data.

---

## 3. ~~Yahoo Finance — Deprecated `historical()` API~~ FIXED

**Provider**: `src/core/analyse/enrichment/benchmark.provider.ts`
**Status**: RESOLVED

**Problem**: `yahoo-finance2` showed deprecation warning for `historical()`.

**Solution**: Migrated to `yahooFinance.chart()` API. Also added null/NaN filtering for close values — `chart()` returns null close for some dates (weekends/holidays that leak through). Without filtering, this caused `-100%` CAGR and `NaN` volatility.

---

## 4. ~~Yahoo Finance — Unreliable Index Tickers~~ VERIFIED

**Provider**: `src/core/analyse/helpers/benchmark-mapper.ts`
**Status**: VERIFIED OK — all 13 tickers tested and working

All benchmark tickers currently in use produce valid data:
- `^NSEI` (Nifty 50), `^CRSLDX` (Nifty 500), `^BSESN` (BSE Sensex)
- `0P0000XVKP.BO` (Nifty Midcap 150 proxy), `0P0001BAV4.BO` (Nifty Smallcap 250 proxy)
- `^NSMIDCP` (Nifty Next 50), `^NSEBANK` (Nifty Bank), `^CNXIT` (Nifty IT)
- `^CNXPHARMA` (Nifty Pharma), `^CNXINFRA` (Nifty Infrastructure)
- `^GSPC` (S&P 500), `^IXIC` (NASDAQ), `GC=F` (Gold Futures)

**Note**: `^NSMIDCP` is labelled "Nifty Next 50" by Yahoo despite the misleading ticker name. `0P0000XVKP.BO` and `0P0001BAV4.BO` are mutual fund NAV proxies, not actual index values, but work fine for CAGR/return calculations.

---

## 5. Yahoo Finance Market Cap — Rate Limiting & Coverage

**Provider**: `src/core/analyse/enrichment/marketcap.resolver.ts`
**Impact**: Market cap classification depends on Yahoo Finance search + quoteSummary
**Status**: OPEN (only relevant when holdings data is available)

**Problem**:
- Batched in groups of 3 to respect rate limits, but large portfolios with many underlying holdings could hit limits
- Yahoo Finance search may not find Indian equities by ISIN — some ISINs return no results
- Market cap thresholds (₹50,000 Cr / ₹15,000 Cr) are static approximations of SEBI classification

**Possible fixes**:
1. Use BSE/NSE API or a local database of Indian equity market caps instead of Yahoo Finance
2. Cache resolved market caps with a 7-day TTL to reduce API calls
3. Use AMFI's SEBI categorization (already in scheme category) as a first-pass classification without needing market cap data

---

## 6. MFAPI.in NAV History — Not Yet Used in Analysis

**Provider**: `src/core/analyse/enrichment/nav.provider.ts`
**Impact**: Risk metrics module (Sharpe, volatility, max drawdown per fund) not yet implemented
**Status**: OPEN (blocked on Phase 4 implementation)

**Problem**: Provider is implemented but not wired into the analysis engine. The risk metrics analyser (Phase 4) needs daily NAV history to compute per-fund volatility, Sharpe ratio, and drawdown.

**Status**: Provider code is ready. Needs:
1. Wire into `runEnrichment()` in `analysis-engine.ts`
2. Need AMFI scheme codes for each ISIN — use `AMFIMasterProvider.findByISIN()` to get the code
3. Implement `risk-metrics.analyser.ts` that consumes NAV history

---

## 7. ~~AMFI Master — Scheme Name Matching Issues~~ FIXED

**Provider**: `src/core/analyse/enrichment/amfi-master.provider.ts`
**Status**: RESOLVED

**Problem**: AMFI scheme names don't exactly match CAMS statement scheme names.

**Solution**: Added three new capabilities:
1. **`findCounterpart(isin)`**: Finds the Direct/Regular counterpart of a scheme using normalized name matching. Handles variations like "Growth" vs "Growth Option", trailing hyphens, plan keyword positioning.
2. **`fuzzyFindByName(name, plan?)`**: Word-overlap scoring with 70% threshold and minimum 3 keyword overlap. Stop words include plan identifiers. Used as last-resort fallback.
3. **`isDirect(schemeName)`**: Static helper for plan detection.

Both ISIN fields (`isinDivPayoutOrGrowth` and `isinDivReinvestment`) were already indexed for lookup.
