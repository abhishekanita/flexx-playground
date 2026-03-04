/**
 * Market cap resolver using Yahoo Finance.
 * Resolves Indian equity ISINs to market cap buckets:
 *   Top 100 by MCap = Large Cap
 *   101-250 = Mid Cap
 *   251+ = Small Cap
 *   Non-IN ISIN = Global Equity
 *
 * Uses Yahoo Finance search to find the ticker, then quoteSummary for market cap.
 *
 * Cache strategy (two-level):
 *   1. In-memory Map (per-process, instant)
 *   2. MongoDB mfs.enriched.cache (persistent, 7-day TTL)
 *   3. Yahoo Finance API (cold fetch)
 */

import YahooFinance from 'yahoo-finance2';
import { MarketCapLookup } from '@/types/analysis/enrichment.type';
import { isValidISIN, isinCountry } from '../helpers/normalization';
import { enrichmentCache } from '@/services/enrichment-cache.service';

const yahooFinance = new YahooFinance();

// SEBI thresholds (approximate, updated periodically)
// These are rough MCap cutoffs in INR crores for classification
const LARGE_CAP_THRESHOLD = 50000; // Above 50,000 Cr = Large Cap (top ~100)
const MID_CAP_THRESHOLD = 15000;   // 15,000-50,000 Cr = Mid Cap (~101-250)

export class MarketCapResolver {
    private cache = new Map<string, MarketCapLookup>();

    /**
     * Resolve market cap for a single ISIN.
     */
    async resolve(isin: string, instrument: string): Promise<MarketCapLookup> {
        // Level 1: in-memory
        if (this.cache.has(isin)) return this.cache.get(isin)!;

        // Level 2: MongoDB
        const cached = await enrichmentCache.get<MarketCapLookup>('market_cap', isin);
        if (cached) {
            this.cache.set(isin, cached);
            return cached;
        }

        // Level 3: Yahoo Finance
        const country = isinCountry(isin);
        if (country === 'Global') {
            const result: MarketCapLookup = {
                isin,
                instrument,
                yahooSymbol: null,
                marketCap: null,
                country: 'Global',
                bucket: 'Global Equity',
                resolvedAt: new Date(),
            };
            this.cache.set(isin, result);
            await enrichmentCache.set('market_cap', isin, result);
            return result;
        }

        try {
            // Search Yahoo Finance for the ISIN to find the ticker
            const searchResult = await yahooFinance.search(isin, {
                quotesCount: 3,
                newsCount: 0,
            });

            const equity = searchResult.quotes.find(
                (q) => 'quoteType' in q && (q.quoteType === 'EQUITY' || q.quoteType === 'ETF'),
            );

            if (!equity || !('symbol' in equity) || !equity.symbol) {
                return this.unknownResult(isin, instrument);
            }

            const symbol = equity.symbol as string;

            // Get market cap from quoteSummary
            const summary = await yahooFinance.quoteSummary(symbol, {
                modules: ['summaryDetail', 'price'],
            });

            const marketCapRaw = summary.summaryDetail?.marketCap ?? summary.price?.marketCap;
            const marketCap = typeof marketCapRaw === 'number' ? marketCapRaw : null;
            const marketCapCr = marketCap ? marketCap / 10000000 : null; // Convert to crores

            const bucket = this.classifyMarketCap(marketCapCr, country);

            const result: MarketCapLookup = {
                isin,
                instrument,
                yahooSymbol: symbol,
                marketCap: marketCapCr,
                country: country === 'India' ? 'IN' : country,
                bucket,
                resolvedAt: new Date(),
            };

            // Store in both caches
            this.cache.set(isin, result);
            await enrichmentCache.set('market_cap', isin, result);

            return result;
        } catch (err) {
            console.warn(`[MarketCapResolver] Failed for ${isin} (${instrument}):`, (err as Error).message);
            return this.unknownResult(isin, instrument);
        }
    }

    /**
     * Resolve market cap for multiple ISINs in parallel (batched).
     */
    async resolveBatch(
        items: { isin: string; instrument: string }[],
    ): Promise<Map<string, MarketCapLookup>> {
        const results = new Map<string, MarketCapLookup>();
        const unique = new Map<string, string>();
        for (const item of items) {
            if (!unique.has(item.isin)) unique.set(item.isin, item.instrument);
        }

        // Pre-fill from MongoDB cache (batch lookup)
        const allISINs = [...unique.keys()];
        const cachedMap = await enrichmentCache.getMany<MarketCapLookup>('market_cap', allISINs);
        const uncachedEntries: [string, string][] = [];

        for (const [isin, instrument] of unique.entries()) {
            const cached = cachedMap.get(isin);
            if (cached) {
                this.cache.set(isin, cached);
                results.set(isin, cached);
            } else {
                uncachedEntries.push([isin, instrument]);
            }
        }

        // Batch fetch uncached in groups of 3 to respect rate limits
        for (let i = 0; i < uncachedEntries.length; i += 3) {
            const batch = uncachedEntries.slice(i, i + 3);
            const fetches = batch.map(async ([isin, instrument]) => {
                const lookup = await this.resolve(isin, instrument);
                results.set(isin, lookup);
            });
            await Promise.allSettled(fetches);
        }

        return results;
    }

    private classifyMarketCap(
        marketCapCr: number | null,
        country: string,
    ): MarketCapLookup['bucket'] {
        if (country !== 'India') return 'Global Equity';
        if (marketCapCr === null) return 'Unclassified';
        if (marketCapCr >= LARGE_CAP_THRESHOLD) return 'Large Cap';
        if (marketCapCr >= MID_CAP_THRESHOLD) return 'Mid Cap';
        return 'Small Cap';
    }

    private async unknownResult(isin: string, instrument: string): Promise<MarketCapLookup> {
        const result: MarketCapLookup = {
            isin,
            instrument,
            yahooSymbol: null,
            marketCap: null,
            country: isValidISIN(isin) && isin.startsWith('IN') ? 'IN' : null,
            bucket: 'Unclassified',
            resolvedAt: new Date(),
        };
        this.cache.set(isin, result);
        await enrichmentCache.set('market_cap', isin, result);
        return result;
    }
}
