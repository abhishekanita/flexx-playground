// ─── Portfolio Summary ───────────────────────────────────────────────────────

export interface PortfolioSummaryResult {
    totalCostValue: number;
    totalMarketValue: number;
    totalUnrealisedGain: number;
    totalUnrealisedGainPct: number;
    totalInvested: number;
    totalWithdrawn: number;
    lifetimePnL: number;
    lifetimeReturnPct: number;
    fundHouseSummary: FundHouseSummary[];
    activeFolioCount: number;
    closedFolioCount: number;
}

export interface FundHouseSummary {
    fundHouse: string;
    costValue: number;
    marketValue: number;
    gain: number;
    gainPct: number;
    weight: number; // % of total market value
}

// ─── Active Holdings ─────────────────────────────────────────────────────────

export interface ActiveHolding {
    fundHouse: string;
    schemeName: string;
    isin: string;
    folioNumber: string;
    plan: 'Direct' | 'Regular';
    option: string;
    navDate: string;
    nav: number;
    closingUnits: number;
    marketValue: number;
    costValue: number;
    unrealisedGain: number;
    unrealisedGainPct: number;
    weight: number; // % of total portfolio
    firstTransactionDate: string;
    lastTransactionDate: string;
    holdingDays: number;
    hasNominee: boolean;
}

// ─── XIRR ────────────────────────────────────────────────────────────────────

export interface XIRRAnalysisResult {
    portfolioXIRR: number;
    portfolioXIRRExCharges: number;
    schemeXIRR: SchemeXIRR[];
}

export interface SchemeXIRR {
    fundHouse: string;
    schemeName: string;
    folioNumber: string;
    isin: string;
    marketValue: number;
    xirr: number;
    firstTxDate: string;
    holdingDays: number;
    netInvested: number;
    reliability: 'High' | 'Medium Sample' | 'Low Sample' | 'Insufficient';
}

// ─── Benchmark Comparison ────────────────────────────────────────────────────

export interface BenchmarkComparisonResult {
    portfolioBenchmarks: PortfolioBenchmark[];
    fundVsBenchmark: FundVsBenchmark[];
}

export interface PortfolioBenchmark {
    benchmarkName: string;
    ticker: string;
    startDate: string;
    endDate: string;
    totalReturn: number;
    cagr: number;
    volatility: number;
    maxDrawdown: number;
}

export interface FundVsBenchmark {
    fundHouse: string;
    schemeName: string;
    marketValue: number;
    benchmarkName: string;
    benchmarkTicker: string;
    schemeXIRR: number;
    benchmarkCAGR: number;
    gapPctPoints: number;
    ageDays: number;
    netInvested: number;
    includeInSummary: boolean;
}

// ─── Sector Analysis ─────────────────────────────────────────────────────────

export interface SectorAnalysisResult {
    broadSectors: SectorAllocation[];
    detailedSectors: SectorAllocation[];
    schemeSectorBreakdown: SchemeSectorBreakdown[];
}

export interface SectorAllocation {
    sector: string;
    weightedMV: number;
    portfolioWeight: number;
    equityWeight: number;
}

export interface SchemeSectorBreakdown {
    fundHouse: string;
    schemeName: string;
    sector: string;
    weightedMV: number;
    schemeEquityWeight: number;
    portfolioWeight: number;
}

// ─── Company Exposure ────────────────────────────────────────────────────────

export interface CompanyExposureResult {
    companies: CompanyExposure[];
    concentrationRisk: ConcentrationRisk;
}

export interface CompanyExposure {
    companyKey: string;
    instrumentName: string;
    isin: string;
    weightedMV: number;
    portfolioWeight: number;
    equityWeight: number;
}

export interface ConcentrationRisk {
    top5Weight: number;
    top10Weight: number;
    top20Weight: number;
    herfindahlIndex: number;
}

// ─── Market Cap Allocation ───────────────────────────────────────────────────

export type MarketCapBucket = 'Large Cap' | 'Mid Cap' | 'Small Cap' | 'Global Equity' | 'Unclassified';

export interface MarketCapAllocationResult {
    overall: MarketCapAllocation[];
    byScheme: SchemeMarketCapAllocation[];
}

export interface MarketCapAllocation {
    bucket: MarketCapBucket;
    marketValue: number;
    portfolioWeight: number;
    equityWeight: number;
}

export interface SchemeMarketCapAllocation {
    fundHouse: string;
    schemeName: string;
    bucket: MarketCapBucket;
    marketValue: number;
    schemeEquityWeight: number;
    portfolioWeight: number;
}

// ─── Asset Allocation ────────────────────────────────────────────────────────

export type AssetClass = 'Equity' | 'Debt' | 'Others';

export interface AssetAllocationResult {
    overall: AssetClassAllocation[];
    equityTotalMV: number;
}

export interface AssetClassAllocation {
    assetClass: AssetClass;
    marketValue: number;
    weight: number;
}

// ─── Transaction Timeline ────────────────────────────────────────────────────

export interface TransactionTimelineResult {
    daily: DailyTimeline[];
    byFund: FundTimeline[];
    annualCashflows: AnnualCashflow[];
}

export interface DailyTimeline {
    date: string;
    investedAmount: number;
    withdrawnAmount: number;
}

export interface FundTimeline {
    date: string;
    fundHouse: string;
    schemeName: string;
    investedAmount: number;
    withdrawnAmount: number;
}

export interface AnnualCashflow {
    year: number;
    invested: number;
    withdrawn: number;
    netCashflow: number;
}

// ─── Cashflow Analysis ──────────────────────────────────────────────────────

export interface CashflowAnalysisResult {
    totalInvested: number;
    totalWithdrawn: number;
    totalStampDuty: number;
    netCashflow: number;
    annualCashflows: AnnualCashflow[];
    monthlyCashflows: MonthlyCashflow[];
}

export interface MonthlyCashflow {
    month: string; // "YYYY-MM"
    invested: number;
    withdrawn: number;
    netCashflow: number;
}

// ─── TER Analysis ───────────────────────────────────────────────────────────

export interface TERAnalysisResult {
    schemes: SchemeTER[];
    potentialAnnualSavings: number;
    totalCommissionPaidAnnually: number;
}

export interface SchemeTER {
    schemeName: string;
    plan: 'Direct' | 'Regular';
    regularTER: number | null;
    directTER: number | null;
    terSpread: number | null;
    commissionRisk: 'High' | 'Medium' | 'Low' | 'Unknown';
    annualCostAmount: number; // marketValue * TER
}

// ─── Coverage ───────────────────────────────────────────────────────────────

export interface CoverageResult {
    holdingsCoverageMV: number;
    holdingsCoveragePct: number;
    unmappedMV: number;
    unmappedPct: number;
}

// ─── Overlap Analysis ───────────────────────────────────────────────────────

export interface OverlapResult {
    pairwiseOverlap: PairwiseOverlap[];
    highOverlapWarnings: string[];
}

export interface PairwiseOverlap {
    scheme1: string;
    scheme2: string;
    overlapPct: number;
    commonCompanies: number;
    commonWeight: number;
}

// ─── Risk Metrics ───────────────────────────────────────────────────────────

export interface RiskMetricsResult {
    portfolioVolatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    drawdownRecoveryDays: number | null;
    schemeRiskMetrics: SchemeRiskMetric[];
}

export interface SchemeRiskMetric {
    schemeName: string;
    isin: string;
    volatility: number;
    sharpeRatio: number;
    sortinoRatio: number;
    maxDrawdown: number;
    drawdownRecoveryDays: number | null;
    dataPoints: number;
}

// ─── Tax Harvesting ─────────────────────────────────────────────────────────

export interface TaxHarvestingResult {
    opportunities: TaxHarvestOpportunity[];
    totalSTCG: number;
    totalLTCG: number;
    ltcgExemptionUsed: number;
    ltcgExemptionRemaining: number;
    totalEstimatedTax: number;
}

export interface TaxHarvestOpportunity {
    schemeName: string;
    folioNumber: string;
    unrealisedGain: number;
    holdingPeriod: 'STCG' | 'LTCG';
    estimatedTax: number;
    harvestable: boolean;
    daysToLTCG: number | null; // days until oldest STCG lot becomes LTCG
}

// ─── SIP Analysis ───────────────────────────────────────────────────────────

export interface SIPAnalysisResult {
    sipSchemes: SIPScheme[];
    isLumpsumOnly: boolean;
    totalSIPInvested: number;
}

export interface SIPScheme {
    schemeName: string;
    sipAmount: number;
    sipFrequency: 'Monthly' | 'Weekly' | 'Quarterly' | 'Irregular';
    missedMonths: number;
    regularityScore: number; // 0-100
    totalSIPInvested: number;
    currentValue: number;
}

// ─── Rebalance Analysis ─────────────────────────────────────────────────────

export type RebalanceActionType =
    | 'SIP_REDIRECT'
    | 'NEW_MONEY'
    | 'LTCG_HARVEST'
    | 'TAX_LOSS_HARVEST'
    | 'LTCG_SELL'
    | 'STCG_SELL';

export type FundSignalType =
    | 'UNDERPERFORMING'
    | 'MANAGER_CHANGED'
    | 'AUM_DECLINING'
    | 'HIGH_OVERLAP'
    | 'OK';

export interface RebalanceResult {
    currentAllocation: AllocationDrift[];
    portfolioDrift: number;
    needsRebalancing: boolean;
    actions: RebalanceAction[];
    fundSignals: FundSignal[];
}

export interface AllocationDrift {
    dimension: 'Asset Class' | 'Market Cap' | 'Sector';
    bucket: string;
    currentPct: number;
    targetPct: number;
    driftPct: number;
}

export interface RebalanceAction {
    priority: number;
    type: RebalanceActionType;
    fromScheme?: string;
    toCategory: string;
    amount: number;
    taxImpact: number;
    exitLoadImpact: number;
    reason: string;
    monthsToFixViaSIP?: number;
}

export interface FundSignal {
    scheme: string;
    signal: FundSignalType;
    categoryRank: string | null;
    detail: string;
}
