/**
 * NAV history provider using MFAPI.in (free, no auth).
 * GET https://api.mfapi.in/mf/{schemeCode} returns full NAV history.
 *
 * Actual response structure (verified):
 *   meta: { fund_house, scheme_type, scheme_category, scheme_code, scheme_name,
 *           isin_growth, isin_div_reinvestment }
 *   data: [{ date: "DD-MM-YYYY", nav: "string" }]  ← NAV is a STRING, dates descending
 *
 * Search endpoint:
 *   GET https://api.mfapi.in/mf/search?q={query}
 *   Returns: [{ schemeCode: number, schemeName: string }]  ← camelCase!
 *
 * Cache strategy (two-level):
 *   1. In-memory Map (per-process, instant)
 *   2. MongoDB mfs.enriched.cache (persistent, 24h TTL)
 *   3. MFAPI.in API (cold fetch)
 */

import axios from 'axios';
import { SchemeNAVHistory, NAVDataPoint } from '@/types/analysis/enrichment.type';
import { enrichmentCache } from '@/services/enrichment-cache.service';

const MFAPI_BASE = 'https://api.mfapi.in/mf';

interface MFAPIMeta {
    fund_house: string;
    scheme_type: string;
    scheme_category: string;
    scheme_code: number;
    scheme_name: string;
    isin_growth: string;
    isin_div_reinvestment: string;
}

interface MFAPIResponse {
    meta: MFAPIMeta;
    data: { date: string; nav: string }[]; // NAV is a STRING, not number
}

interface MFAPISearchResult {
    schemeCode: number;  // camelCase (different from meta's snake_case)
    schemeName: string;
}

export class NAVProvider {
    private cache = new Map<number, SchemeNAVHistory>();
    private searchCache = new Map<string, MFAPISearchResult[]>();

    /**
     * Fetch NAV history for a scheme by its AMFI scheme code.
     */
    async fetchNAVHistory(schemeCode: number): Promise<SchemeNAVHistory | null> {
        // Level 1: in-memory
        if (this.cache.has(schemeCode)) return this.cache.get(schemeCode)!;

        // Level 2: MongoDB
        const cached = await enrichmentCache.get<SchemeNAVHistory>('nav_history', String(schemeCode));
        if (cached) {
            this.cache.set(schemeCode, cached);
            return cached;
        }

        // Level 3: MFAPI.in
        try {
            const { data } = await axios.get<MFAPIResponse>(`${MFAPI_BASE}/${schemeCode}`, {
                timeout: 15000,
            });

            if (!data?.meta || !data?.data?.length) return null;

            // Data comes descending (newest first) - reverse to oldest first
            const navHistory: NAVDataPoint[] = data.data
                .map((d) => ({
                    date: d.date,                    // "DD-MM-YYYY" as-is
                    nav: parseFloat(d.nav),           // parse string → number
                }))
                .filter((d) => !isNaN(d.nav))
                .reverse(); // oldest first

            const result: SchemeNAVHistory = {
                schemeCode,
                schemeName: data.meta.scheme_name,
                isinGrowth: data.meta.isin_growth || '',
                isinDivReinvestment: data.meta.isin_div_reinvestment || '',
                fundHouse: data.meta.fund_house,
                schemeType: data.meta.scheme_type,
                schemeCategory: data.meta.scheme_category,
                navHistory,
                fetchedAt: new Date(),
            };

            // Store in both caches
            this.cache.set(schemeCode, result);
            await enrichmentCache.set('nav_history', String(schemeCode), result);

            return result;
        } catch (err) {
            console.warn(`[NAVProvider] Failed to fetch scheme ${schemeCode}:`, (err as Error).message);
            return null;
        }
    }

    /**
     * Search for schemes by name. Returns matching scheme codes.
     */
    async searchSchemes(query: string): Promise<MFAPISearchResult[]> {
        if (this.searchCache.has(query)) return this.searchCache.get(query)!;

        try {
            const { data } = await axios.get<MFAPISearchResult[]>(
                `${MFAPI_BASE}/search`,
                { params: { q: query }, timeout: 10000 },
            );

            const results = Array.isArray(data) ? data : [];
            this.searchCache.set(query, results);
            return results;
        } catch (err) {
            console.warn(`[NAVProvider] Search failed for "${query}":`, (err as Error).message);
            return [];
        }
    }

    /**
     * Convert MFAPI date "DD-MM-YYYY" to ISO "YYYY-MM-DD".
     */
    static toISO(ddmmyyyy: string): string {
        const [d, m, y] = ddmmyyyy.split('-');
        return `${y}-${m}-${d}`;
    }

    /**
     * Get daily NAV values as close prices (for volatility/drawdown calculations).
     * Returns oldest-first arrays.
     */
    static extractPrices(history: SchemeNAVHistory): { dates: Date[]; prices: number[] } {
        const dates: Date[] = [];
        const prices: number[] = [];
        for (const point of history.navHistory) {
            const iso = NAVProvider.toISO(point.date);
            dates.push(new Date(iso));
            prices.push(point.nav);
        }
        return { dates, prices };
    }
}
