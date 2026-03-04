import { config } from '@/config';
import {
    GrowwScheme,
    GrowwSchemeReturns,
    GrowwSIPReturns,
    GrowwRiskStats,
    GrowwHolding,
    GrowwFundManager,
    GrowwCategoryRank,
    GrowwCategoryAvgReturn,
    GrowwExpenseHistoryEntry,
} from '@/types/market';
import { growwSchemeService } from '@/services/market/groww-scheme.service';
import { growwAMCService } from '@/services/market/groww-amc.service';
import logger from '@/utils/logger';

const log = logger.createServiceLogger('GrowwScraper');

const AMC_SLUGS = [
    'nj-mutual-funds',
    'choice-mutual-funds',
    'the-wealth-company-mutual-funds',
    'capitalmind-mutual-funds',
    'jioblackrock-mutual-funds',
    'unifi-mutual-funds',
    'helios-mutual-funds',
    'bajaj-finserv-mutual-funds',
    'navi-mutual-funds',
    'bandhan-mutual-funds',
    'union-mutual-funds',
    'nippon-india-mutual-funds',
    '360-one-mutual-funds',
    'whiteoak-capital-mutual-funds',
    'pgim-india-mutual-funds',
    'motilal-oswal-mutual-funds',
    'bank-of-india-mutual-funds',
    'mirae-asset-mutual-funds',
    'aditya-birla-sun-life-mutual-funds',
    'franklin-templeton-mutual-funds',
    'lic-mutual-funds',
    'jm-financial-mutual-funds',
    'icici-prudential-mutual-funds',
    'quant-mutual-funds',
    'canara-robeco-mutual-funds',
    'mahindra-manulife-mutual-funds',
    'iti-mutual-funds',
    'trust-mutual-funds',
    'abakkus-mutual-funds',
    'samco-mutual-funds',
    'sbi-mutual-funds',
    'dsp-mutual-funds',
    'tata-mutual-funds',
    'edelweiss-mutual-funds',
    'invesco-mutual-funds',
    'sundaram-mutual-funds',
    'hdfc-mutual-funds',
    'hshs-mutual-funds',
    'ppfas-mutual-funds',
    'baroda-bnp-paribas-mutual-funds',
    'quantum-mutual-funds',
    'taurus-mutual-funds',
    'shriram-mutual-funds',
    'groww-mutual-funds',
    'kotak-mahindra-mutual-funds',
    'zerodha-mutual-funds',
    'axis-mutual-funds',
    'uti-mutual-funds',
];

export interface GrowwScraperStats {
    amcsProcessed: number;
    schemesFromLightSync: number;
    schemesDeepSynced: number;
    errors: string[];
}

export class GrowwScraper {
    private baseUrl: string;
    private apiKey: string;
    private stats: GrowwScraperStats;

    constructor() {
        this.baseUrl = config.groww.baseUrl;
        this.apiKey = config.scraperApi.apiKey;
        this.stats = { amcsProcessed: 0, schemesFromLightSync: 0, schemesDeepSynced: 0, errors: [] };
    }

    private getProxiedUrl(url: string): string {
        if (!this.apiKey) return url;
        return `http://api.scraperapi.com?api_key=${this.apiKey}&url=${encodeURIComponent(url)}`;
    }

    private async fetchJson(url: string): Promise<any> {
        const targetUrl = this.getProxiedUrl(url);
        const res = await fetch(targetUrl, {
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status} for ${url}`);
        }
        return res.json();
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private async runInBatches<T>(
        items: T[],
        batchSize: number,
        delayMs: number,
        fn: (item: T, index: number) => Promise<void>
    ): Promise<void> {
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            await Promise.all(batch.map((item, idx) => fn(item, i + idx)));
            if (i + batchSize < items.length) {
                await this.delay(delayMs);
            }
        }
    }

    // ── Light Sync ──────────────────────────────────────────────

    async lightSync(): Promise<GrowwScraperStats> {
        log.info(`Starting light sync for ${AMC_SLUGS.length} AMCs`);
        this.stats = { amcsProcessed: 0, schemesFromLightSync: 0, schemesDeepSynced: 0, errors: [] };

        await this.runInBatches(AMC_SLUGS, 3, 2000, async slug => {
            try {
                await this.syncAMC(slug);
                this.stats.amcsProcessed++;
            } catch (err: any) {
                const msg = `Light sync error for ${slug}: ${err.message}`;
                log.error(msg);
                this.stats.errors.push(msg);
            }
        });

        log.info(`Light sync complete`, this.stats);
        return { ...this.stats };
    }

    private async syncAMC(slug: string): Promise<void> {
        // Step 1: Get AMC metadata from page API
        const pageUrl = `${this.baseUrl}/v1/api/data/mf/v1/web/content/v2/page/${slug}`;
        const pageData = await this.fetchJson(pageUrl);

        const keyInfo = pageData?.key_information || {};
        const amcName = keyInfo.fund_house || slug;
        const totalAum = keyInfo.total_aum ? parseFloat(keyInfo.total_aum) : undefined;
        const totalSchemes = pageData?.fund_rows?.total_results || 0;

        // Step 2: Fetch ALL schemes via search API (page API caps at 15)
        const schemes: Partial<GrowwScheme>[] = [];
        const pageSize = 100;
        for (let page = 0; page * pageSize < Math.max(totalSchemes, 1); page++) {
            const searchUrl = `${this.baseUrl}/v1/api/search/v1/derived/scheme?page=${page}&size=${pageSize}&fund_house=${encodeURIComponent(amcName)}&doc_type=scheme`;
            const searchData = await this.fetchJson(searchUrl);
            const content = searchData?.content || [];
            if (!content.length) break;

            for (const item of content) {
                const mapped = this.mapLightSyncScheme(item, slug, amcName);
                if (mapped) schemes.push(mapped);
            }

            if (content.length < pageSize) break;
        }

        if (schemes.length > 0) {
            await growwSchemeService.bulkUpsertSchemes(schemes);
            this.stats.schemesFromLightSync += schemes.length;
        }

        await growwAMCService.upsertAMC({
            slug,
            name: amcName,
            totalAum,
            schemeCount: schemes.length,
            lastLightSyncAt: new Date(),
        });

        log.info(`  ${slug}: ${schemes.length} schemes`);
    }

    private mapLightSyncScheme(item: any, amcSlug: string, amcName: string): Partial<GrowwScheme> | null {
        const searchId = item?.search_id;
        if (!searchId) return null;

        // Returns are flat fields on the item (return1y, return3y, etc.)
        const returns: GrowwSchemeReturns = {};
        if (item.return1d != null) returns.ret1d = item.return1d;
        if (item.return3m != null) returns.ret3m = item.return3m;
        if (item.return6m != null) returns.ret6m = item.return6m;
        if (item.return1y != null) returns.ret1y = item.return1y;
        if (item.return3y != null) returns.ret3y = item.return3y;
        if (item.return5y != null) returns.ret5y = item.return5y;
        if (item.return7y != null) returns.ret7y = item.return7y;
        if (item.return10y != null) returns.ret10y = item.return10y;

        return {
            searchId,
            schemeName: item.scheme_name || item.direct_scheme_name || '',
            fundHouse: item.fund_house || amcName,
            category: item.category,
            subCategory: item.sub_category,
            schemeType: item.scheme_type,
            plan: item.plan_type,
            logoUrl: item.logo_url,
            aum: item.aum,
            launchDate: item.launch_date,
            returns: Object.keys(returns).length ? returns : undefined,
            growwRating: item.groww_rating,
            minSipAmount: item.min_sip_investment,
            minLumpsum: item.min_investment_amount,
            lastLightSyncAt: new Date(),
        };
    }

    // ── Deep Sync ───────────────────────────────────────────────

    async deepSync(maxSchemes?: number): Promise<GrowwScraperStats> {
        log.info(`Starting deep sync (max: ${maxSchemes || 'all'})`);

        const searchIds = await growwSchemeService.getSearchIdsNeedingDeepSync(7, maxSchemes);
        log.info(`Found ${searchIds.length} schemes needing deep sync`);

        if (!searchIds.length) {
            log.info('No schemes need deep sync');
            return { ...this.stats };
        }

        await this.runInBatches(searchIds, 3, 3000, async searchId => {
            try {
                await this.deepSyncScheme(searchId);
                this.stats.schemesDeepSynced++;
                if (this.stats.schemesDeepSynced % 50 === 0) {
                    log.info(`  Deep synced ${this.stats.schemesDeepSynced}/${searchIds.length}`);
                }
            } catch (err: any) {
                const msg = `Deep sync error for ${searchId}: ${err.message}`;
                log.error(msg);
                this.stats.errors.push(msg);
                // Mark as failed so we don't retry immediately
                await growwSchemeService.updateOne({ searchId }, { $set: { deepSyncFailed: true, deepSyncError: err.message } });
            }
        });

        log.info(`Deep sync complete`, this.stats);
        return { ...this.stats };
    }

    private async deepSyncScheme(searchId: string): Promise<void> {
        const url = `${this.baseUrl}/v1/api/data/mf/web/v4/scheme/search/${searchId}`;
        const data = await this.fetchJson(url);

        const overlay = this.mapDeepSyncOverlay(data);

        await growwSchemeService.updateOne(
            { searchId },
            {
                $set: {
                    ...overlay,
                    lastDeepSyncAt: new Date(),
                    deepSyncFailed: false,
                    deepSyncError: null,
                },
            }
        );
    }

    private mapDeepSyncOverlay(data: any): Partial<GrowwScheme> {
        const overlay: Partial<GrowwScheme> = {};
        const scheme = data?.scheme_data || data;

        // ISIN
        overlay.isin = scheme?.isin || scheme?.isin_number || null;
        overlay.benchmarkName = scheme?.benchmark_name || scheme?.benchmark || null;
        overlay.exitLoad = scheme?.exit_load || null;
        overlay.stampDuty = scheme?.stamp_duty || null;
        overlay.launchDate = scheme?.launch_date || scheme?.inception_date || null;
        overlay.lockInPeriod = scheme?.lock_in_period || null;
        overlay.expenseRatio = scheme?.expense_ratio ?? null;

        // Returns — merge/overwrite with deeper data
        const returnStats = scheme?.return_stats || scheme?.returns;
        if (returnStats) {
            const r: GrowwSchemeReturns = {};
            if (returnStats.ret_1d != null) r.ret1d = returnStats.ret_1d;
            if (returnStats.ret_1w != null) r.ret1w = returnStats.ret_1w;
            if (returnStats.ret_1m != null) r.ret1m = returnStats.ret_1m;
            if (returnStats.ret_3m != null) r.ret3m = returnStats.ret_3m;
            if (returnStats.ret_6m != null) r.ret6m = returnStats.ret_6m;
            if (returnStats.ret_1y != null) r.ret1y = returnStats.ret_1y;
            if (returnStats.ret_3y != null) r.ret3y = returnStats.ret_3y;
            if (returnStats.ret_5y != null) r.ret5y = returnStats.ret_5y;
            if (returnStats.ret_7y != null) r.ret7y = returnStats.ret_7y;
            if (returnStats.ret_10y != null) r.ret10y = returnStats.ret_10y;
            if (returnStats.ret_since_created != null) r.retSinceCreated = returnStats.ret_since_created;
            if (Object.keys(r).length) overlay.returns = r;
        }

        // SIP Returns
        const sipStats = scheme?.sip_return_stats || scheme?.sip_returns;
        if (sipStats) {
            const s: GrowwSIPReturns = {};
            if (sipStats.sip_3m != null) s.sip3m = sipStats.sip_3m;
            if (sipStats.sip_6m != null) s.sip6m = sipStats.sip_6m;
            if (sipStats.sip_1y != null) s.sip1y = sipStats.sip_1y;
            if (sipStats.sip_3y != null) s.sip3y = sipStats.sip_3y;
            if (sipStats.sip_5y != null) s.sip5y = sipStats.sip_5y;
            if (sipStats.sip_10y != null) s.sip10y = sipStats.sip_10y;
            if (Object.keys(s).length) overlay.sipReturns = s;
        }

        // Risk stats
        const risk = scheme?.risk_stats || scheme?.risk_rating;
        if (risk) {
            const rs: GrowwRiskStats = {};
            if (risk.sharpe != null) rs.sharpe = risk.sharpe;
            if (risk.beta != null) rs.beta = risk.beta;
            if (risk.std_dev != null) rs.stdDev = risk.std_dev;
            if (risk.alpha != null) rs.alpha = risk.alpha;
            if (risk.sortino != null) rs.sortino = risk.sortino;
            if (risk.info_ratio != null) rs.infoRatio = risk.info_ratio;
            if (risk.mean_return != null) rs.meanReturn = risk.mean_return;
            if (Object.keys(rs).length) overlay.riskStats = rs;
        }

        // Holdings
        const holdings = scheme?.holdings || scheme?.top_holdings;
        if (Array.isArray(holdings) && holdings.length) {
            overlay.holdings = holdings.map(
                (h: any): GrowwHolding => ({
                    company: h.company_name || h.name,
                    sector: h.sector,
                    instrument: h.instrument_type || h.instrument,
                    rating: h.rating,
                    corpusPer: h.corpus_per ?? h.percentage,
                    marketValue: h.market_value,
                })
            );
        }

        // Fund manager details
        const managers = scheme?.fund_manager_details || scheme?.fund_managers;
        if (Array.isArray(managers) && managers.length) {
            overlay.fundManagerDetails = managers.map(
                (m: any): GrowwFundManager => ({
                    name: m.name || m.fund_manager_name,
                    education: m.education || m.qualification,
                    experience: m.experience,
                    dateFrom: m.date_from || m.managing_since,
                })
            );
        }

        // Category rank
        const rank = scheme?.category_rank || scheme?.rank_in_category;
        if (rank) {
            overlay.categoryRank = {
                category: rank.category || rank.category_name,
                rank: rank.rank,
                totalFunds: rank.total_funds || rank.total,
            } as GrowwCategoryRank;
        }

        // Category avg returns
        const catAvg = scheme?.category_avg_returns;
        if (Array.isArray(catAvg) && catAvg.length) {
            overlay.categoryAvgReturns = catAvg.map(
                (c: any): GrowwCategoryAvgReturn => ({
                    period: c.period,
                    categoryAvg: c.category_avg,
                    schemeReturn: c.scheme_return,
                })
            );
        }

        // Expense history (last 30 entries)
        const expHistory = scheme?.expense_history || scheme?.expense_ratio_history;
        if (Array.isArray(expHistory) && expHistory.length) {
            overlay.expenseHistory = expHistory.slice(-30).map(
                (e: any): GrowwExpenseHistoryEntry => ({
                    date: e.date,
                    expenseRatio: e.expense_ratio ?? e.value,
                })
            );
        }

        return overlay;
    }

    // ── Full Sync ───────────────────────────────────────────────

    async fullSync(deepSyncMax?: number): Promise<GrowwScraperStats> {
        log.info('Starting full sync (light + deep)');
        this.stats = { amcsProcessed: 0, schemesFromLightSync: 0, schemesDeepSynced: 0, errors: [] };

        await this.lightSync();
        await this.deepSync(deepSyncMax);

        log.info('Full sync complete', this.stats);
        return { ...this.stats };
    }

    getStats(): GrowwScraperStats {
        return { ...this.stats };
    }
}
