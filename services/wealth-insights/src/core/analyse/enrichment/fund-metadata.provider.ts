/**
 * Fund metadata provider.
 *
 * Strategy (waterfall):
 *   1. Try mf.captnemo.in (Kuvera mirror) — has full metadata including TER, comparison peers
 *   2. Fallback to AMFI Master + category-based TER estimation — always works for known ISINs
 *
 * The AMFI fallback provides: fund_house, category, isDirect, estimated TER,
 * and finds the Direct/Regular counterpart to build a comparison entry.
 *
 * Cache strategy (two-level):
 *   1. In-memory Map (per-process, instant)
 *   2. MongoDB mfs.enriched.cache (persistent, 24h TTL)
 *   3. Kuvera API / AMFI fallback (cold fetch)
 */

import axios from 'axios';
import { FundMetadata, FundComparison, AMFIScheme } from '@/types/analysis/enrichment.type';
import { AMFIMasterProvider } from './amfi-master.provider';
import { enrichmentCache } from '@/services/enrichment-cache.service';

const CAPTNEMO_BASE = 'https://mf.captnemo.in/kuvera';

// ─── Industry-average TER by AMFI scheme category (2024-25 medians) ─────────
// Source: SEBI annual reports & aggregator data
const TER_ESTIMATES: Record<string, { direct: number; regular: number }> = {
    'large cap':       { direct: 0.55, regular: 1.50 },
    'large & mid cap': { direct: 0.60, regular: 1.60 },
    'mid cap':         { direct: 0.60, regular: 1.70 },
    'small cap':       { direct: 0.70, regular: 1.90 },
    'multi cap':       { direct: 0.55, regular: 1.55 },
    'flexi cap':       { direct: 0.55, regular: 1.55 },
    'elss':            { direct: 0.55, regular: 1.50 },
    'focused':         { direct: 0.55, regular: 1.50 },
    'value':           { direct: 0.60, regular: 1.60 },
    'contra':          { direct: 0.60, regular: 1.60 },
    'sectoral':        { direct: 0.60, regular: 1.60 },
    'thematic':        { direct: 0.60, regular: 1.60 },
    'index':           { direct: 0.15, regular: 0.50 },
    'etf':             { direct: 0.10, regular: 0.35 },
    'debt':            { direct: 0.25, regular: 0.60 },
    'liquid':          { direct: 0.15, regular: 0.25 },
    'overnight':       { direct: 0.08, regular: 0.15 },
    'hybrid':          { direct: 0.50, regular: 1.20 },
    'aggressive hybrid': { direct: 0.50, regular: 1.30 },
    'balanced advantage': { direct: 0.50, regular: 1.20 },
    'equity savings':  { direct: 0.45, regular: 1.10 },
    'fund of funds':   { direct: 0.30, regular: 0.80 },
    'gold':            { direct: 0.15, regular: 0.50 },
    'default_equity':  { direct: 0.55, regular: 1.50 },
    'default_debt':    { direct: 0.25, regular: 0.60 },
    'default':         { direct: 0.50, regular: 1.30 },
};

export class FundMetadataProvider {
    private cache = new Map<string, FundMetadata | null>();

    /**
     * Fetch fund metadata for a given ISIN.
     */
    async fetchMetadata(isin: string): Promise<FundMetadata | null> {
        // Level 1: in-memory
        if (this.cache.has(isin)) return this.cache.get(isin)!;

        // Level 2: MongoDB
        const cached = await enrichmentCache.get<FundMetadata>('fund_metadata', isin);
        if (cached) {
            this.cache.set(isin, cached);
            return cached;
        }

        // Level 3: Kuvera API
        try {
            const { data } = await axios.get(`${CAPTNEMO_BASE}/${isin}`, {
                timeout: 10000,
                headers: { Accept: 'application/json' },
            });

            // Response is an array - take first item
            const raw = Array.isArray(data) ? data[0] : data;
            if (!raw || typeof raw !== 'object') {
                this.cache.set(isin, null);
                return null;
            }

            const result: FundMetadata = {
                code: raw.code || '',
                isin: raw.ISIN || isin,
                name: raw.name || '',
                shortName: raw.short_name || '',
                fundHouse: raw.fund_name || '',          // display name
                fundHouseCode: raw.fund_house || '',     // internal code
                category: raw.category || '',             // "Equity", "Debt", "Hybrid"
                fundCategory: raw.fund_category || '',    // "Fund of Funds", "Large Cap Fund"
                fundType: raw.fund_type || '',            // "Others", "Equity"
                plan: raw.plan || '',                     // "GROWTH", "DIVIDEND", "IDCW"
                isDirect: raw.direct === 'Y',             // "Y"/"N" → boolean
                expenseRatio: this.parseNum(raw.expense_ratio),
                expenseRatioDate: raw.expense_ratio_date || null,
                fundManager: raw.fund_manager || null,
                crisilRating: raw.crisil_rating || null,  // text like "Very High Risk"
                investmentObjective: raw.investment_objective || null,
                portfolioTurnover: this.parseNum(raw.portfolio_turnover),
                maturityType: raw.maturity_type || null,
                aum: typeof raw.aum === 'number' ? raw.aum : this.parseNum(raw.aum),
                nav: raw.nav && typeof raw.nav === 'object'
                    ? { nav: raw.nav.nav, date: raw.nav.date }
                    : null,
                returns: {
                    week1: this.parseNum(raw.returns?.week_1),
                    year1: this.parseNum(raw.returns?.year_1),
                    year3: this.parseNum(raw.returns?.year_3),
                    year5: this.parseNum(raw.returns?.year_5),
                    inception: this.parseNum(raw.returns?.inception),
                },
                volatility: typeof raw.volatility === 'number' ? raw.volatility : this.parseNum(raw.volatility),
                lockInPeriod: typeof raw.lock_in_period === 'number' ? raw.lock_in_period : null,
                taxPeriod: typeof raw.tax_period === 'number' ? raw.tax_period : null,
                sipMin: typeof raw.sip_min === 'number' ? raw.sip_min : null,
                sipMax: typeof raw.sip_max === 'number' ? raw.sip_max : null,
                lumpMin: typeof raw.lump_min === 'number' ? raw.lump_min : null,
                lumpMax: typeof raw.lump_max === 'number' ? raw.lump_max : null,
                startDate: raw.start_date || null,
                tags: Array.isArray(raw.tags) ? raw.tags : [],
                switchAllowed: raw.switch_allowed === 'Y',
                stpAllowed: raw.stp_flag === 'Y',
                swpAllowed: raw.swp_flag === 'Y',
                redemptionAllowed: raw.redemption_allowed === 'Y',
                comparison: Array.isArray(raw.comparison)
                    ? raw.comparison.map((c: Record<string, unknown>) => this.parseComparison(c))
                    : [],
                fetchedAt: new Date(),
            };

            // Store in both caches
            this.cache.set(isin, result);
            await enrichmentCache.set('fund_metadata', isin, result);

            return result;
        } catch {
            // captnemo failed — will be handled by AMFI fallback in fetchBatch
            return null;
        }
    }

    /**
     * Fetch metadata for multiple ISINs in parallel (batched in groups of 5).
     * When captnemo fails, falls back to AMFI master + category-based TER estimation.
     */
    async fetchBatch(
        isins: string[],
        amfiMaster?: AMFIMasterProvider,
    ): Promise<Map<string, FundMetadata>> {
        const results = new Map<string, FundMetadata>();
        const unique = [...new Set(isins)];

        // Pre-fill from MongoDB cache (batch lookup)
        const cachedMap = await enrichmentCache.getMany<FundMetadata>('fund_metadata', unique);
        const uncachedISINs: string[] = [];
        for (const isin of unique) {
            const cached = cachedMap.get(isin);
            if (cached) {
                this.cache.set(isin, cached);
                results.set(isin, cached);
            } else {
                uncachedISINs.push(isin);
            }
        }

        if (uncachedISINs.length === 0) return results;

        // Phase 1: Try captnemo for uncached ISINs
        const missingISINs: string[] = [];
        for (let i = 0; i < uncachedISINs.length; i += 5) {
            const batch = uncachedISINs.slice(i, i + 5);
            const fetches = batch.map(async (isin) => {
                const meta = await this.fetchMetadata(isin);
                if (meta) {
                    results.set(isin, meta);
                } else {
                    missingISINs.push(isin);
                }
            });
            await Promise.allSettled(fetches);
        }

        // Phase 2: Fallback to AMFI master for missing ISINs
        if (missingISINs.length > 0 && amfiMaster?.isLoaded) {
            const amfiFallbackCount = await this.buildFromAMFI(missingISINs, amfiMaster, results);
            if (amfiFallbackCount > 0) {
                console.log(`[FundMetadataProvider] AMFI fallback: resolved ${amfiFallbackCount}/${missingISINs.length} missing ISINs`);
            }
        }

        return results;
    }

    /**
     * Build basic FundMetadata from AMFI master data for ISINs where captnemo failed.
     * Uses category-based TER estimation and finds Direct/Regular counterparts.
     */
    private async buildFromAMFI(
        isins: string[],
        amfiMaster: AMFIMasterProvider,
        results: Map<string, FundMetadata>,
    ): Promise<number> {
        let resolved = 0;
        const toCache: { key: string; data: any }[] = [];

        for (const isin of isins) {
            const amfi = amfiMaster.findByISIN(isin);
            if (!amfi) continue;

            const isDirect = AMFIMasterProvider.isDirect(amfi.schemeName);
            const categoryKey = this.matchCategoryKey(amfi.schemeCategory);
            const terEstimate = TER_ESTIMATES[categoryKey] || TER_ESTIMATES['default'];
            const expenseRatio = isDirect ? terEstimate.direct : terEstimate.regular;

            // Try to find Direct/Regular counterpart
            const counterpart = amfiMaster.findCounterpart(isin);
            const comparison: FundComparison[] = [];
            if (counterpart) {
                const counterpartIsDirect = AMFIMasterProvider.isDirect(counterpart.schemeName);
                const counterpartTER = counterpartIsDirect ? terEstimate.direct : terEstimate.regular;
                comparison.push({
                    name: counterpart.schemeName,
                    shortName: counterpart.schemeName.substring(0, 40),
                    code: String(counterpart.schemeCode),
                    year1: null,
                    year3: null,
                    year5: null,
                    inception: null,
                    volatility: null,
                    expenseRatio: counterpartTER,
                    aum: null,
                    infoRatio: null,
                });
            }

            // Map AMFI scheme category to high-level Kuvera category
            const highLevelCategory = this.mapToHighLevelCategory(amfi.schemeCategory);

            const result: FundMetadata = {
                code: String(amfi.schemeCode),
                isin,
                name: amfi.schemeName,
                shortName: amfi.schemeName.substring(0, 40),
                fundHouse: amfi.fundHouse,
                fundHouseCode: '',
                category: highLevelCategory,
                fundCategory: amfi.schemeCategory,
                fundType: highLevelCategory,
                plan: 'GROWTH',
                isDirect,
                expenseRatio,
                expenseRatioDate: null,
                fundManager: null,
                crisilRating: null,
                investmentObjective: null,
                portfolioTurnover: null,
                maturityType: amfi.schemeType.includes('Open') ? 'Open Ended' : 'Close Ended',
                aum: null,
                nav: amfi.nav > 0 ? { nav: amfi.nav, date: amfi.navDate } : null,
                returns: {},
                volatility: null,
                lockInPeriod: amfi.schemeCategory.toLowerCase().includes('elss') ? 1095 : null,
                taxPeriod: highLevelCategory === 'Equity' ? 365 : 1095,
                sipMin: null,
                sipMax: null,
                lumpMin: null,
                lumpMax: null,
                startDate: null,
                tags: ['amfi-estimated-ter'],
                switchAllowed: true,
                stpAllowed: true,
                swpAllowed: true,
                redemptionAllowed: true,
                comparison,
                fetchedAt: new Date(),
            };

            this.cache.set(isin, result);
            results.set(isin, result);
            toCache.push({ key: isin, data: result });
            resolved++;
        }

        // Bulk store AMFI fallback results in MongoDB
        if (toCache.length > 0) {
            await enrichmentCache.setMany('fund_metadata', toCache);
        }

        return resolved;
    }

    /**
     * Match AMFI schemeCategory to TER_ESTIMATES key.
     */
    private matchCategoryKey(schemeCategory: string): string {
        const lower = schemeCategory.toLowerCase();

        // Specific matches first
        if (lower.includes('elss')) return 'elss';
        if (lower.includes('index') || lower.includes('nifty') || lower.includes('sensex')) return 'index';
        if (lower.includes('etf')) return 'etf';
        if (lower.includes('gold') || lower.includes('silver')) return 'gold';
        if (lower.includes('fund of fund')) return 'fund of funds';
        if (lower.includes('overnight')) return 'overnight';
        if (lower.includes('liquid')) return 'liquid';

        // Equity sub-categories
        if (lower.includes('large') && lower.includes('mid')) return 'large & mid cap';
        if (lower.includes('large cap')) return 'large cap';
        if (lower.includes('mid cap')) return 'mid cap';
        if (lower.includes('small cap')) return 'small cap';
        if (lower.includes('multi cap')) return 'multi cap';
        if (lower.includes('flexi cap')) return 'flexi cap';
        if (lower.includes('focused')) return 'focused';
        if (lower.includes('value')) return 'value';
        if (lower.includes('contra')) return 'contra';
        if (lower.includes('sectoral') || lower.includes('thematic')) return 'sectoral';

        // Hybrid
        if (lower.includes('aggressive hybrid')) return 'aggressive hybrid';
        if (lower.includes('balanced advantage') || lower.includes('dynamic asset')) return 'balanced advantage';
        if (lower.includes('equity saving')) return 'equity savings';
        if (lower.includes('hybrid')) return 'hybrid';

        // High-level fallback
        if (lower.includes('equity')) return 'default_equity';
        if (lower.includes('debt')) return 'default_debt';

        return 'default';
    }

    /**
     * Map AMFI scheme category to high-level category (Equity/Debt/Hybrid/Other).
     */
    private mapToHighLevelCategory(schemeCategory: string): string {
        const lower = schemeCategory.toLowerCase();
        if (lower.includes('equity') || lower.includes('elss')) return 'Equity';
        if (lower.includes('debt') || lower.includes('money market') || lower.includes('liquid') || lower.includes('overnight')) return 'Debt';
        if (lower.includes('hybrid') || lower.includes('balanced') || lower.includes('equity saving')) return 'Hybrid';
        if (lower.includes('index') || lower.includes('etf')) return 'Equity';
        if (lower.includes('gold') || lower.includes('silver') || lower.includes('commodit')) return 'Other';
        if (lower.includes('fund of fund')) return 'Other';
        return 'Equity';
    }

    private parseComparison(c: Record<string, unknown>): FundComparison {
        return {
            name: String(c.name || ''),
            shortName: String(c.short_name || ''),
            code: String(c.code || ''),
            year1: this.parseNum(c['1y']),
            year3: this.parseNum(c['3y']),
            year5: this.parseNum(c['5y']),
            inception: this.parseNum(c.inception),
            volatility: this.parseNum(c.volatility),
            expenseRatio: this.parseNum(c.expense_ratio),
            aum: this.parseNum(c.aum),
            infoRatio: this.parseNum(c.info_ratio),
        };
    }

    private parseNum(val: unknown): number | null {
        if (val === null || val === undefined || val === '') return null;
        const n = Number(val);
        return isNaN(n) ? null : n;
    }
}
