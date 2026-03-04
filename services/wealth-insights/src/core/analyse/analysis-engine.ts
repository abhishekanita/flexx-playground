import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, ActiveHolding } from '@/types/analysis';
import { FundHoldingsSource, FundMetadata, MarketCapLookup, BenchmarkStats } from '@/types/analysis/enrichment.type';
import {
    PortfolioSummaryAnalyser,
    XIRRCalculator,
    TransactionTimelineAnalyser,
    CashflowAnalyser,
    BenchmarkAnalyser,
    SectorAnalyser,
    CompanyExposureAnalyser,
    MarketCapAnalyser,
    AssetAllocationAnalyser,
    TERAnalyser,
    CoverageAnalyser,
    SIPAnalyser,
    TaxHarvestingAnalyser,
    OverlapAnalyser,
    RiskMetricsAnalyser,
} from './modules';
import {
    BenchmarkProvider,
    AMFIMasterProvider,
    FundMetadataProvider,
    NAVProvider,
    HoldingsProvider,
    MarketCapResolver,
    GrowwDataProvider,
} from './enrichment';
import { mapSchemeToBenchmark, getUniqueBenchmarkTickers } from './helpers/benchmark-mapper';
import { DEFAULT_BENCHMARKS } from './enrichment/benchmark.provider';
import { LLMInsightsEngine, InsightsEngineResult, InsightsOptions } from './insights';
import { WhatIfEngine } from './what-if';
import { computeDashboardData } from './modules/dashboard-data.computer';
import { parseDate, daysBetween } from './helpers/financial-math';
import { randomUUID } from 'crypto';

export interface AnalysisOptions {
    /** Skip enrichment (external API calls). Only run Phase 1 pure-computation modules. */
    skipEnrichment?: boolean;
    /** Path to directory containing AMC portfolio disclosure Excel files. */
    holdingsDir?: string;
}

export class AnalysisEngine {
    private benchmarkProvider = new BenchmarkProvider();
    private amfiMaster = new AMFIMasterProvider();
    private metadataProvider = new FundMetadataProvider();
    private holdingsProvider = new HoldingsProvider();
    private marketCapResolver = new MarketCapResolver();
    private growwProvider = new GrowwDataProvider();
    private navProvider = new NAVProvider();
    private insightsEngine = new LLMInsightsEngine();

    /**
     * Run full analysis on parsed statement data.
     */
    async analyse(
        data: MFDetailedStatementData,
        requestId?: string,
        options?: AnalysisOptions,
    ): Promise<PortfolioAnalysis> {
        const activeHoldings = this.buildActiveHoldings(data);
        const asOfDate = this.determineAsOfDate(data);

        // ── Phase 1: Core modules (pure computation, no external calls) ──
        const portfolioSummary = PortfolioSummaryAnalyser.analyse(data);
        const xirrAnalysis = XIRRCalculator.analyse(data, asOfDate);
        const transactionTimeline = TransactionTimelineAnalyser.analyse(data);
        const cashflowAnalysis = CashflowAnalyser.analyse(data);
        const sipAnalysis = SIPAnalyser.analyse(data);
        const taxHarvesting = TaxHarvestingAnalyser.analyse(data, asOfDate);

        // If enrichment is skipped, return Phase 1 results only
        if (options?.skipEnrichment) {
            return this.buildResult({
                requestId, data, asOfDate, activeHoldings,
                portfolioSummary, xirrAnalysis, transactionTimeline, cashflowAnalysis,
                sipAnalysis, taxHarvesting,
            });
        }

        // ── Phase 2: Enrichment + enrichment-dependent modules ──
        const enrichmentResult = await this.runEnrichment(data, asOfDate, options);

        // Benchmark comparison
        const benchmarkComparison = enrichmentResult.benchmarks.size > 0
            ? BenchmarkAnalyser.analyse(data, xirrAnalysis, enrichmentResult.benchmarks, this.amfiMaster)
            : null;

        // TER analysis (needs fund metadata)
        const terAnalysis = enrichmentResult.metadata.size > 0
            ? TERAnalyser.analyse(data, enrichmentResult.metadata)
            : null;

        // Holdings-dependent modules
        const holdingsLookup = enrichmentResult.holdingsLookup;
        const hasHoldings = holdingsLookup.size > 0;

        const sectorAnalysis = hasHoldings
            ? SectorAnalyser.analyse(data, holdingsLookup)
            : null;

        const companyExposure = hasHoldings
            ? CompanyExposureAnalyser.analyse(data, holdingsLookup)
            : null;

        const assetAllocation = hasHoldings
            ? AssetAllocationAnalyser.analyse(data, holdingsLookup)
            : null;

        const marketCapAllocation = hasHoldings && enrichmentResult.marketCaps.size > 0
            ? MarketCapAnalyser.analyse(data, holdingsLookup, enrichmentResult.marketCaps)
            : null;

        const coverageAnalysis = CoverageAnalyser.analyse(data, holdingsLookup);

        const overlapAnalysis = hasHoldings
            ? OverlapAnalyser.analyse(data, holdingsLookup)
            : null;

        const riskMetrics = await RiskMetricsAnalyser.analyse(
            data, enrichmentResult.growwSchemes, this.amfiMaster, this.navProvider,
        );

        const result = this.buildResult({
            requestId, data, asOfDate, activeHoldings,
            portfolioSummary, xirrAnalysis, transactionTimeline, cashflowAnalysis,
            sipAnalysis, taxHarvesting,
            benchmarkComparison, sectorAnalysis, companyExposure,
            marketCapAllocation, assetAllocation, terAnalysis, coverageAnalysis,
            overlapAnalysis, riskMetrics,
            enrichmentMeta: {
                holdingsCoverage: coverageAnalysis.holdingsCoveragePct,
                benchmarkDataAvailable: enrichmentResult.benchmarks.size > 0,
                marketCapCoverage: enrichmentResult.marketCaps.size > 0 ? 100 : 0,
                fundMetadataAvailable: enrichmentResult.metadata.size > 0,
                inflationDataAvailable: false,
                dataSourcesUsed: this.getDataSources(enrichmentResult),
            },
        });

        // ── What-If Scenarios (runs on completed analysis) ──
        result.whatIfScenarios = await WhatIfEngine.compute(
            data, result, this.amfiMaster, this.navProvider,
            enrichmentResult.metadata, enrichmentResult.benchmarks,
        );

        // ── Dashboard Data (pure computation, no LLM) ──
        result.dashboardData = computeDashboardData(result);

        return result;
    }

    /**
     * Generate LLM insights from a completed analysis.
     * Can be called separately after analyse() completes.
     */
    async generateInsights(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
        options?: InsightsOptions,
    ): Promise<InsightsEngineResult> {
        return this.insightsEngine.generateInsights(data, analysis, options);
    }

    /**
     * Run all enrichment fetches in parallel.
     */
    private async runEnrichment(
        data: MFDetailedStatementData,
        asOfDate: string,
        options?: AnalysisOptions,
    ) {
        // Determine date range for benchmarks
        let earliestTx = asOfDate;
        for (const folio of data.folios) {
            for (const tx of folio.transactions) {
                if (tx.date < earliestTx) earliestTx = tx.date;
            }
        }

        // Collect unique ISINs from active folios
        const activeISINs = data.folios
            .filter((f) => f.closingUnitBalance > 0)
            .map((f) => ({ isin: f.scheme.isin, schemeName: f.scheme.current_name }));

        // Determine all benchmark tickers needed from scheme mappings
        const schemeMappings = activeISINs.map((a) => mapSchemeToBenchmark(a.schemeName));
        const allBenchmarks = getUniqueBenchmarkTickers([
            ...DEFAULT_BENCHMARKS,
            ...schemeMappings,
        ]);

        // Load AMFI master first (needed as fallback for metadata)
        const amfiLoaded = await this.amfiMaster.load().then(() => true).catch(() => false);

        // Run benchmarks + metadata in parallel (metadata uses AMFI as fallback)
        const [benchmarks, metadata] = await Promise.all([
            this.fetchBenchmarks(allBenchmarks, earliestTx, asOfDate),
            this.metadataProvider.fetchBatch(
                activeISINs.map((a) => a.isin),
                amfiLoaded ? this.amfiMaster : undefined,
            ),
        ]);

        // Load holdings: Excel dir → MongoDB cache → Groww (fallback)
        let holdingsMap = new Map<string, FundHoldingsSource>();
        let holdingsLookup = new Map<string, FundHoldingsSource>();
        if (options?.holdingsDir) {
            holdingsMap = await this.holdingsProvider.loadFromDirectory(options.holdingsDir);
            holdingsLookup = this.holdingsProvider.buildSchemeHoldingsLookup(activeISINs, holdingsMap);
        } else {
            // Try loading from MongoDB cache (from a previous run with holdingsDir)
            holdingsMap = await this.holdingsProvider.loadFromCache();
            if (holdingsMap.size > 0) {
                holdingsLookup = this.holdingsProvider.buildSchemeHoldingsLookup(activeISINs, holdingsMap);
            }
        }

        // Fetch Groww data for all active ISINs (holdings + scheme metadata)
        const isinList = activeISINs.map((a) => a.isin);
        const growwResult = await this.growwProvider.fetchByISINs(isinList);
        let growwUsed = false;

        // Fill in missing holdings from Groww
        if (growwResult.holdingsLookup.size > 0) {
            for (const [isin, growwSource] of growwResult.holdingsLookup) {
                if (!holdingsLookup.has(isin)) {
                    holdingsLookup.set(isin, growwSource);
                    growwUsed = true;
                }
            }
        }

        // Augment FundMetadata with Groww scheme data where Kuvera is missing/incomplete
        if (growwResult.schemes.size > 0) {
            for (const [isin, growwScheme] of growwResult.schemes) {
                const meta = metadata.get(isin);
                if (meta) {
                    // Fill expense ratio if missing from Kuvera
                    if (meta.expenseRatio == null && growwScheme.expenseRatio != null) {
                        meta.expenseRatio = growwScheme.expenseRatio;
                    }
                    // Fill volatility from Groww stdDev if missing
                    if (meta.volatility == null && growwScheme.riskStats?.stdDev != null) {
                        meta.volatility = growwScheme.riskStats.stdDev;
                    }
                    // Fill fund manager if missing
                    if (!meta.fundManager && growwScheme.fundManagerDetails?.length) {
                        meta.fundManager = growwScheme.fundManagerDetails.map((m) => m.name).filter(Boolean).join(', ') || null;
                    }
                    // Fill category if missing
                    if (!meta.fundCategory && growwScheme.subCategory) {
                        meta.fundCategory = growwScheme.subCategory;
                    }
                    growwUsed = true;
                } else if (growwScheme) {
                    // No Kuvera metadata at all — create a basic FundMetadata from Groww
                    metadata.set(isin, {
                        code: growwScheme.searchId || '',
                        isin,
                        name: growwScheme.schemeName,
                        shortName: growwScheme.schemeName,
                        fundHouse: growwScheme.fundHouse,
                        fundHouseCode: '',
                        category: growwScheme.category || '',
                        fundCategory: growwScheme.subCategory || '',
                        fundType: growwScheme.schemeType || '',
                        plan: growwScheme.plan || '',
                        isDirect: (growwScheme.schemeName || '').toLowerCase().includes('direct'),
                        expenseRatio: growwScheme.expenseRatio ?? null,
                        expenseRatioDate: null,
                        fundManager: growwScheme.fundManagerDetails?.map((m) => m.name).filter(Boolean).join(', ') || null,
                        crisilRating: null,
                        investmentObjective: null,
                        portfolioTurnover: null,
                        maturityType: null,
                        aum: growwScheme.aum ?? null,
                        nav: growwScheme.nav != null ? { nav: growwScheme.nav, date: growwScheme.navDate || '' } : null,
                        returns: {
                            year1: growwScheme.returns?.ret1y,
                            year3: growwScheme.returns?.ret3y,
                            year5: growwScheme.returns?.ret5y,
                        },
                        volatility: growwScheme.riskStats?.stdDev ?? null,
                        lockInPeriod: null,
                        taxPeriod: null,
                        sipMin: growwScheme.minSipAmount ?? null,
                        sipMax: null,
                        lumpMin: growwScheme.minLumpsum ?? null,
                        lumpMax: null,
                        startDate: growwScheme.launchDate ?? null,
                        tags: [],
                        switchAllowed: false,
                        stpAllowed: false,
                        swpAllowed: false,
                        redemptionAllowed: true,
                        comparison: [],
                        fetchedAt: new Date(),
                    });
                    growwUsed = true;
                }
            }
        }

        // Resolve market caps for holdings (if we have holdings)
        let marketCaps = new Map<string, MarketCapLookup>();
        if (holdingsLookup.size > 0) {
            const equityISINs: { isin: string; instrument: string }[] = [];
            for (const [, source] of holdingsLookup) {
                for (const h of source.holdings) {
                    if (h.section === 'equity' && h.isin && h.pctOfNAV > 0.5) {
                        equityISINs.push({ isin: h.isin, instrument: h.instrument });
                    }
                }
            }
            if (equityISINs.length > 0) {
                marketCaps = await this.marketCapResolver.resolveBatch(equityISINs);
            }
        }

        return { benchmarks, metadata, holdingsMap, holdingsLookup, marketCaps, amfiLoaded, growwUsed, growwSchemes: growwResult.schemes };
    }

    private async fetchBenchmarks(
        benchmarkSet: { ticker: string; name: string }[],
        startDate: string,
        endDate: string,
    ): Promise<Map<string, BenchmarkStats>> {
        try {
            return await this.benchmarkProvider.fetchBenchmarkSet(benchmarkSet, startDate, endDate);
        } catch (err) {
            console.warn('[AnalysisEngine] Benchmark fetch failed:', (err as Error).message);
            return new Map();
        }
    }

    private buildActiveHoldings(data: MFDetailedStatementData): ActiveHolding[] {
        const totalMV = data.totalMarketValue;
        const holdings: ActiveHolding[] = [];

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const firstTx = folio.transactions[0];
            const lastTx = folio.transactions[folio.transactions.length - 1];
            const firstTxDate = firstTx?.date || '';
            const lastTxDate = lastTx?.date || '';
            const navDate = folio.snapshot.navDate;
            const holdingDays = firstTxDate && navDate
                ? daysBetween(parseDate(firstTxDate), parseDate(navDate))
                : 0;

            const unrealisedGain = folio.snapshot.marketValue - folio.snapshot.totalCostValue;
            const unrealisedGainPct =
                folio.snapshot.totalCostValue > 0
                    ? (unrealisedGain / folio.snapshot.totalCostValue) * 100
                    : 0;

            const hasNominee = folio.investor.nominees && folio.investor.nominees.length > 0;

            holdings.push({
                fundHouse: folio.fundHouse,
                schemeName: folio.scheme.current_name,
                isin: folio.scheme.isin,
                folioNumber: folio.folioNumber,
                plan: folio.scheme.plan,
                option: folio.scheme.option,
                navDate: folio.snapshot.navDate,
                nav: folio.snapshot.nav,
                closingUnits: folio.closingUnitBalance,
                marketValue: folio.snapshot.marketValue,
                costValue: folio.snapshot.totalCostValue,
                unrealisedGain,
                unrealisedGainPct: Math.round(unrealisedGainPct * 100) / 100,
                weight: totalMV > 0
                    ? Math.round((folio.snapshot.marketValue / totalMV) * 10000) / 100
                    : 0,
                firstTransactionDate: firstTxDate,
                lastTransactionDate: lastTxDate,
                holdingDays,
                hasNominee,
            });
        }

        return holdings.sort((a, b) => b.weight - a.weight);
    }

    private determineAsOfDate(data: MFDetailedStatementData): string {
        let latest = '';
        for (const folio of data.folios) {
            if (folio.closingUnitBalance > 0 && folio.snapshot.navDate > latest) {
                latest = folio.snapshot.navDate;
            }
        }
        return latest || new Date().toISOString().slice(0, 10);
    }

    private getDataSources(enrichment: {
        benchmarks: Map<string, BenchmarkStats>;
        metadata: Map<string, FundMetadata>;
        holdingsMap: Map<string, FundHoldingsSource>;
        marketCaps: Map<string, MarketCapLookup>;
        amfiLoaded: boolean;
        growwUsed: boolean;
    }): string[] {
        const sources = ['parsed-statement'];
        if (enrichment.benchmarks.size > 0) sources.push('yahoo-finance-benchmarks');
        if (enrichment.metadata.size > 0) sources.push('kuvera-metadata');
        if (enrichment.holdingsMap.size > 0) sources.push('amc-portfolio-disclosure');
        if (enrichment.marketCaps.size > 0) sources.push('yahoo-finance-marketcap');
        if (enrichment.amfiLoaded) sources.push('amfi-master');
        if (enrichment.growwUsed) sources.push('groww-market-data');
        return sources;
    }

    private buildResult(params: {
        requestId?: string;
        data: MFDetailedStatementData;
        asOfDate: string;
        activeHoldings: ActiveHolding[];
        portfolioSummary: ReturnType<typeof PortfolioSummaryAnalyser.analyse>;
        xirrAnalysis: ReturnType<typeof XIRRCalculator.analyse>;
        transactionTimeline: ReturnType<typeof TransactionTimelineAnalyser.analyse>;
        cashflowAnalysis: ReturnType<typeof CashflowAnalyser.analyse>;
        sipAnalysis?: ReturnType<typeof SIPAnalyser.analyse> | null;
        taxHarvesting?: ReturnType<typeof TaxHarvestingAnalyser.analyse> | null;
        benchmarkComparison?: ReturnType<typeof BenchmarkAnalyser.analyse> | null;
        sectorAnalysis?: ReturnType<typeof SectorAnalyser.analyse> | null;
        companyExposure?: ReturnType<typeof CompanyExposureAnalyser.analyse> | null;
        marketCapAllocation?: ReturnType<typeof MarketCapAnalyser.analyse> | null;
        assetAllocation?: ReturnType<typeof AssetAllocationAnalyser.analyse> | null;
        terAnalysis?: ReturnType<typeof TERAnalyser.analyse> | null;
        coverageAnalysis?: ReturnType<typeof CoverageAnalyser.analyse> | null;
        overlapAnalysis?: ReturnType<typeof OverlapAnalyser.analyse> | null;
        riskMetrics?: Awaited<ReturnType<typeof RiskMetricsAnalyser.analyse>> | null;
        enrichmentMeta?: PortfolioAnalysis['enrichmentMeta'];
    }): PortfolioAnalysis {
        return {
            analysisId: randomUUID(),
            requestId: params.requestId || '',
            investor: {
                name: params.data.investor.name,
                email: params.data.investor.email,
                pan: params.data.investor.pan,
            },
            statementPeriod: params.data.statementPeriod,
            analysedAt: new Date(),
            asOfDate: params.asOfDate,

            // Phase 1
            portfolioSummary: params.portfolioSummary,
            activeHoldings: params.activeHoldings,
            xirrAnalysis: params.xirrAnalysis,
            transactionTimeline: params.transactionTimeline,
            cashflowAnalysis: params.cashflowAnalysis,

            // Phase 2
            benchmarkComparison: params.benchmarkComparison ?? null,
            sectorAnalysis: params.sectorAnalysis ?? null,
            companyExposure: params.companyExposure ?? null,
            marketCapAllocation: params.marketCapAllocation ?? null,
            assetAllocation: params.assetAllocation ?? null,
            terAnalysis: params.terAnalysis ?? null,
            coverageAnalysis: params.coverageAnalysis ?? null,

            // Phase 3+
            overlapAnalysis: params.overlapAnalysis ?? null,
            riskMetrics: params.riskMetrics ?? null,
            taxHarvesting: params.taxHarvesting ?? null,
            sipAnalysis: params.sipAnalysis ?? null,
            rebalanceAnalysis: null,
            whatIfScenarios: null,
            insights: null,
            dashboardData: null,
            insightCards: null,

            enrichmentMeta: params.enrichmentMeta ?? {
                holdingsCoverage: 0,
                benchmarkDataAvailable: false,
                marketCapCoverage: 0,
                fundMetadataAvailable: false,
                inflationDataAvailable: false,
                dataSourcesUsed: ['parsed-statement'],
            },
        };
    }
}
