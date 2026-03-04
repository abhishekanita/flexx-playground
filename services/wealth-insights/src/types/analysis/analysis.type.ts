import {
    PortfolioSummaryResult,
    ActiveHolding,
    XIRRAnalysisResult,
    BenchmarkComparisonResult,
    SectorAnalysisResult,
    CompanyExposureResult,
    MarketCapAllocationResult,
    AssetAllocationResult,
    TransactionTimelineResult,
    CashflowAnalysisResult,
    TERAnalysisResult,
    CoverageResult,
    OverlapResult,
    RiskMetricsResult,
    TaxHarvestingResult,
    SIPAnalysisResult,
    RebalanceResult,
} from './analysis-sections.type';
import { WhatIfResult } from './what-if.type';
import { LLMInsightsResult } from './insights.type';
import { InsightCardsResult } from './insight-cards.type';
import { DashboardData } from './dashboard-data.type';

export interface PortfolioAnalysis {
    analysisId: string;
    requestId: string;
    investor: {
        name: string;
        email: string;
        pan: string;
    };
    statementPeriod: {
        from: string;
        to: string;
    };
    analysedAt: Date;
    asOfDate: string;

    // Core Analytics (11 modules)
    portfolioSummary: PortfolioSummaryResult;
    activeHoldings: ActiveHolding[];
    xirrAnalysis: XIRRAnalysisResult;
    benchmarkComparison: BenchmarkComparisonResult | null;
    sectorAnalysis: SectorAnalysisResult | null;
    companyExposure: CompanyExposureResult | null;
    marketCapAllocation: MarketCapAllocationResult | null;
    assetAllocation: AssetAllocationResult | null;
    transactionTimeline: TransactionTimelineResult;
    cashflowAnalysis: CashflowAnalysisResult;
    terAnalysis: TERAnalysisResult | null;
    coverageAnalysis: CoverageResult | null;

    // Advanced Analytics (5 modules)
    overlapAnalysis: OverlapResult | null;
    riskMetrics: RiskMetricsResult | null;
    taxHarvesting: TaxHarvestingResult | null;
    sipAnalysis: SIPAnalysisResult | null;
    rebalanceAnalysis: RebalanceResult | null;

    // What-If Scenarios (top 3-4 per user)
    whatIfScenarios: WhatIfResult | null;

    // LLM Insights (optional)
    insights: LLMInsightsResult | null;

    // Dashboard + InsightCards (new)
    dashboardData: DashboardData | null;
    insightCards: InsightCardsResult | null;

    // Metadata
    enrichmentMeta: {
        holdingsCoverage: number;
        benchmarkDataAvailable: boolean;
        marketCapCoverage: number;
        fundMetadataAvailable: boolean;
        inflationDataAvailable: boolean;
        dataSourcesUsed: string[];
    };
}
