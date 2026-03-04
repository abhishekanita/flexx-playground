export interface RealWorldEquivalent {
    emoji: string;
    label: string;
    displayCount: string;
    subtext: string;
}

export interface FundRaceEntry {
    schemeName: string;
    shortName: string;
    gainPct: number;
    xirr: number | null;
    marketValueRs: number;
    plan: string;
    color: string;
    xirrReliability: string;
}

export interface PortfolioMapBlock {
    schemeName: string;
    shortName: string;
    weightPct: number;
    gainPct: number;
    marketValueRs: number;
    color: string;
}

export interface HeatmapMonth {
    month: number;
    investedRs: number;
    withdrawnRs: number;
}

export interface HeatmapYear {
    year: string;
    totalInvestedRs: number;
    totalWithdrawnRs: number;
    months: HeatmapMonth[];
}

export interface BenchmarkBar {
    name: string;
    xirr: number;
    isPortfolio: boolean;
    color: string;
}

export interface FundCard {
    schemeName: string;
    shortName: string;
    gainPct: number;
    xirr: number | null;
    xirrReliability: string;
    marketValueRs: number;
    weightPct: number;
    plan: string;
    holdingDays: number;
    personality: string;
    personalityDescription: string;
    benchmarkGapPp: number | null;
    benchmarkName: string | null;
    color: string;
    isRegular: boolean;
}

export interface ClosedFundSummary {
    schemeName: string;
    shortName: string;
    investedRs: number;
    redeemedRs: number;
    pnlRs: number;
    pnlPct: number;
}

// ── Sector Allocation ────────────────────────────────────────────────────────

export interface DashboardSectorBar {
    sector: string;
    portfolioWeight: number;
    equityWeight: number;
    color: string;
}

export interface DashboardSectorAllocation {
    sectors: DashboardSectorBar[];
    othersWeight: number;
    totalSectorsCount: number;
}

// ── Top Holdings ─────────────────────────────────────────────────────────────

export interface DashboardHoldingRow {
    companyName: string;
    portfolioWeight: number;
    equityWeight: number;
}

export interface DashboardConcentrationRisk {
    top5Weight: number;
    top10Weight: number;
    herfindahlIndex: number;
}

export interface DashboardTopHoldings {
    holdings: DashboardHoldingRow[];
    concentrationRisk: DashboardConcentrationRisk;
    totalCompaniesCount: number;
}

// ── Asset & Market Cap ───────────────────────────────────────────────────────

export interface DashboardAssetBar {
    assetClass: string;
    marketValueRs: number;
    weight: number;
    color: string;
}

export interface DashboardMarketCapBar {
    bucket: string;
    portfolioWeight: number;
    equityWeight: number;
    color: string;
}

// ── Dashboard Data ───────────────────────────────────────────────────────────

export interface DashboardData {
    heroStats: {
        currentValueRs: number;
        unrealisedGainRs: number;
        unrealisedGainPct: number;
        xirr: number;
        activeFunds: number;
        lifetimePnLRs: number;
        lifetimePnLPct: number;
    };
    realWorldEquivalents: RealWorldEquivalent[];
    fundRace: FundRaceEntry[];
    portfolioMap: PortfolioMapBlock[];
    heatmap: HeatmapYear[];
    benchmarkBars: BenchmarkBar[];
    fundCards: FundCard[];
    closedFunds: ClosedFundSummary[];
    sectorAllocation: DashboardSectorAllocation | null;
    topHoldings: DashboardTopHoldings | null;
    assetAllocation: DashboardAssetBar[] | null;
    marketCapDistribution: DashboardMarketCapBar[] | null;
}
