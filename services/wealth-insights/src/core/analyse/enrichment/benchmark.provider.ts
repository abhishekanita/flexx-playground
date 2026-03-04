/**
 * Benchmark data provider using Yahoo Finance.
 * Fetches historical prices for indices like Nifty 50, Nifty 500, etc.
 *
 * Cache strategy (two-level):
 *   1. In-memory Map (per-process, instant)
 *   2. MongoDB mfs.enriched.cache (persistent, 24h TTL)
 *   3. Yahoo Finance API (cold fetch)
 */

import YahooFinance from 'yahoo-finance2';
import {
    BenchmarkStats,
    BenchmarkDataPoint,
} from '@/types/analysis/enrichment.type';
import { cagr, volatility, maxDrawdown, dailyReturns } from '../helpers/financial-math';
import { enrichmentCache } from '@/services/enrichment-cache.service';

const yahooFinance = new YahooFinance();

// Default benchmarks for Indian MF analysis
export const DEFAULT_BENCHMARKS: { ticker: string; name: string }[] = [
    { ticker: '^NSEI', name: 'Nifty 50' },
    { ticker: '^CRSLDX', name: 'Nifty 500' },
    { ticker: '0P0000XVKP.BO', name: 'Nifty Midcap 150' },
];

export class BenchmarkProvider {
    private cache = new Map<string, BenchmarkStats>();

    private cacheKey(ticker: string, startDate: string, endDate: string): string {
        return `${ticker}:${startDate}:${endDate}`;
    }

    /**
     * Fetch benchmark stats for a given ticker and date range.
     */
    async fetchBenchmark(
        ticker: string,
        name: string,
        startDate: string,
        endDate: string,
    ): Promise<BenchmarkStats | null> {
        const key = this.cacheKey(ticker, startDate, endDate);

        // Level 1: in-memory
        if (this.cache.has(key)) return this.cache.get(key)!;

        // Level 2: MongoDB
        const cached = await enrichmentCache.get<BenchmarkStats>('benchmark', key);
        if (cached) {
            this.cache.set(key, cached);
            return cached;
        }

        // Level 3: Yahoo Finance
        try {
            const result = await yahooFinance.chart(ticker, {
                period1: startDate,
                period2: endDate,
                interval: '1d',
            });

            // Filter out quotes with null/NaN close (weekends, holidays, partial data)
            const rows = (result.quotes || []).filter(
                (r) => r.close != null && !isNaN(r.close) && r.date != null,
            );
            if (rows.length < 2) return null;

            const prices: BenchmarkDataPoint[] = rows.map((r) => ({
                date: r.date.toISOString().slice(0, 10),
                close: r.close!,
            }));

            const closePrices = rows.map((r) => r.close!);
            const startPrice = closePrices[0];
            const endPrice = closePrices[closePrices.length - 1];
            const years =
                (rows[rows.length - 1].date.getTime() - rows[0].date.getTime()) /
                (365.2425 * 24 * 60 * 60 * 1000);

            const totalReturn = ((endPrice - startPrice) / startPrice) * 100;
            const cagrVal = cagr(startPrice, endPrice, years);
            const returns = dailyReturns(closePrices);
            const vol = volatility(returns);
            const mdd = maxDrawdown(closePrices);

            const stats: BenchmarkStats = {
                ticker,
                name,
                startDate: prices[0].date,
                endDate: prices[prices.length - 1].date,
                totalReturn,
                cagr: cagrVal,
                volatility: vol,
                maxDrawdown: mdd,
                prices,
            };

            // Store in both caches
            this.cache.set(key, stats);
            await enrichmentCache.set('benchmark', key, stats);

            return stats;
        } catch (err) {
            console.warn(`[BenchmarkProvider] Failed to fetch ${ticker}:`, (err as Error).message);
            return null;
        }
    }

    /**
     * Fetch all default benchmarks for a given date range.
     */
    async fetchAllBenchmarks(
        startDate: string,
        endDate: string,
    ): Promise<Map<string, BenchmarkStats>> {
        return this.fetchBenchmarkSet(DEFAULT_BENCHMARKS, startDate, endDate);
    }

    /**
     * Fetch benchmarks for an explicit set of tickers.
     * Deduplicates by ticker and fetches in parallel.
     */
    async fetchBenchmarkSet(
        benchmarks: { ticker: string; name: string }[],
        startDate: string,
        endDate: string,
    ): Promise<Map<string, BenchmarkStats>> {
        const results = new Map<string, BenchmarkStats>();
        const seen = new Set<string>();
        const unique: { ticker: string; name: string }[] = [];

        for (const b of benchmarks) {
            if (!seen.has(b.ticker)) {
                seen.add(b.ticker);
                unique.push(b);
            }
        }

        const fetches = unique.map(async ({ ticker, name }) => {
            const stats = await this.fetchBenchmark(ticker, name, startDate, endDate);
            if (stats) results.set(ticker, stats);
        });

        await Promise.allSettled(fetches);
        return results;
    }

    /**
     * Compute CAGR for a specific period within cached benchmark data.
     */
    computeCAGR(stats: BenchmarkStats, fromDate: string, toDate: string): number | null {
        const validPrices = stats.prices.filter((p) => p.close != null && !isNaN(p.close));
        const from = validPrices.find((p) => p.date >= fromDate);
        const to = [...validPrices].reverse().find((p) => p.date <= toDate);
        if (!from || !to || from.date >= to.date) return null;

        const years =
            (new Date(to.date).getTime() - new Date(from.date).getTime()) /
            (365.2425 * 24 * 60 * 60 * 1000);
        if (years <= 0) return null;

        return cagr(from.close, to.close, years);
    }
}
