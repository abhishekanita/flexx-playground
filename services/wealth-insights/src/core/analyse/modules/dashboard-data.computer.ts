/**
 * Dashboard Data Computer — pure computation module.
 * Zero LLM calls. Produces all structured data needed for the dashboard page.
 */

import { PortfolioAnalysis } from '@/types/analysis';
import {
    DashboardData,
    RealWorldEquivalent,
    FundRaceEntry,
    HeatmapYear,
    BenchmarkBar,
    PortfolioMapBlock,
    ClosedFundSummary,
    FundCard,
    DashboardSectorAllocation,
    DashboardTopHoldings,
    DashboardAssetBar,
    DashboardMarketCapBar,
    PortfolioFitnessScore,
    UniqueNumbers,
    InvestorType,
} from '@/types/analysis/dashboard-data.type';
import { abbreviateFundName } from '@/core/analyse/helpers/fund-name';

export interface BehavioralSignals {
    panicSellCount: number;
    dipBuyCount: number;
    fomoBuyCount: number;
    avgHoldingMonths: number;
    sipConsistency: number; // 0-100
}

export function computeDashboardData(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): DashboardData {
    return {
        heroStats: computeHeroStats(analysis),
        realWorldEquivalents: computeRealWorldEquivalents(analysis),
        fundRace: computeFundRace(analysis),
        portfolioMap: computePortfolioMap(analysis),
        heatmap: computeHeatmap(analysis),
        benchmarkBars: computeBenchmarkBars(analysis),
        fundCards: computeFundCards(analysis),
        closedFunds: computeClosedFunds(analysis),
        sectorAllocation: computeSectorAllocation(analysis),
        topHoldings: computeTopHoldings(analysis),
        assetAllocation: computeAssetAllocation(analysis),
        marketCapDistribution: computeMarketCapDistribution(analysis),
        fitnessScore: computeFitnessScore(analysis, behavioral),
        uniqueNumbers: computeUniqueNumbers(analysis, behavioral),
    };
}

// ── Hero Stats ─────────────────────────────────────────────────────────────────

function computeHeroStats(analysis: PortfolioAnalysis) {
    const ps = analysis.portfolioSummary;
    const xi = analysis.xirrAnalysis;
    return {
        currentValueRs: ps.totalMarketValue,
        unrealisedGainRs: ps.totalUnrealisedGain,
        unrealisedGainPct: ps.totalUnrealisedGainPct,
        xirr: xi.portfolioXIRR,
        activeFunds: ps.activeFolioCount,
        lifetimePnLRs: ps.lifetimePnL,
        lifetimePnLPct: ps.lifetimeReturnPct ?? 0,
    };
}

// ── Real-World Equivalents ─────────────────────────────────────────────────────

interface EquivalentItem {
    emoji: string;
    label: string;
    unitCost: number;
    unit: string;
    unitLabel: (n: number) => string;
}

const EQUIVALENTS_SMALL: EquivalentItem[] = [
    { emoji: '🎬', label: 'Movie nights out', unitCost: 1500, unit: 'night', unitLabel: (n: number) => `${Math.floor(n)}×` },
    { emoji: '⛽', label: 'Full fuel tanks', unitCost: 5000, unit: 'tank', unitLabel: (n: number) => `${Math.floor(n)}×` },
    { emoji: '🛒', label: 'Weeks of groceries', unitCost: 8000, unit: 'week', unitLabel: (n: number) => `${Math.floor(n)}` },
    { emoji: '🏖️', label: 'Weekend getaways', unitCost: 12000, unit: 'trip', unitLabel: (n: number) => `${Math.floor(n)}×` },
    { emoji: '📱', label: 'Months of phone + OTT bills', unitCost: 2500, unit: 'month', unitLabel: (n: number) => `${Math.floor(n)}` },
    { emoji: '💳', label: 'EMI months covered', unitCost: 10000, unit: 'month', unitLabel: (n: number) => `${Math.floor(n)}` },
];

const EQUIVALENTS_MEDIUM: EquivalentItem[] = [
    { emoji: '✈️', label: 'Return flights Delhi→Bali', unitCost: 32000, unit: 'trip', unitLabel: (n: number) => `${Math.floor(n)}×` },
    { emoji: '🛒', label: 'Months of groceries', unitCost: 20000, unit: 'month', unitLabel: (n: number) => `${Math.floor(n)}` },
    { emoji: '📱', label: 'iPhone 16 Pro coverage', unitCost: 134900, unit: 'phone', unitLabel: (n: number) => `${Math.round(n * 100)}%` },
    { emoji: '🎓', label: 'Months of school fees', unitCost: 15000, unit: 'month', unitLabel: (n: number) => `${Math.floor(n)}` },
    { emoji: '🎬', label: 'Years of OTT streaming', unitCost: 12000, unit: 'year', unitLabel: (n: number) => `${Math.floor(n)}` },
    { emoji: '⛽', label: 'Full fuel tanks', unitCost: 5000, unit: 'tank', unitLabel: (n: number) => `${Math.floor(n)}×` },
];

const EQUIVALENTS_LARGE: EquivalentItem[] = [
    { emoji: '🌍', label: 'International trips', unitCost: 250000, unit: 'trip', unitLabel: (n: number) => `${Math.floor(n)}×` },
    { emoji: '🚗', label: 'Car down payments', unitCost: 300000, unit: 'down payment', unitLabel: (n: number) => `${Math.round(n * 100)}%` },
    { emoji: '🏠', label: 'Years of rent covered', unitCost: 300000, unit: 'year', unitLabel: (n: number) => `${Math.floor(n)}` },
    { emoji: '💻', label: 'MacBook + iPhone combos', unitCost: 285000, unit: 'combo', unitLabel: (n: number) => `${Math.floor(n)}×` },
    { emoji: '💍', label: 'Wedding fund progress', unitCost: 1000000, unit: 'wedding', unitLabel: (n: number) => `${Math.round(n * 100)}%` },
    { emoji: '🎓', label: 'Years of college tuition', unitCost: 200000, unit: 'year', unitLabel: (n: number) => `${Math.floor(n)}` },
];

function selectCatalogue(gainRs: number): EquivalentItem[] {
    if (gainRs > 200000) return EQUIVALENTS_LARGE;
    if (gainRs >= 50000) return EQUIVALENTS_MEDIUM;
    return EQUIVALENTS_SMALL;
}

function computeRealWorldEquivalents(analysis: PortfolioAnalysis): RealWorldEquivalent[] {
    const gainRs = Math.max(0, analysis.portfolioSummary.totalUnrealisedGain);
    if (gainRs === 0) return [];

    const catalogue = selectCatalogue(gainRs);

    return catalogue
        .map(item => {
            const count = gainRs / item.unitCost;
            if (count < 0.5) return null; // Not meaningful enough
            return {
                emoji: item.emoji,
                label: item.label,
                displayCount: item.unitLabel(count),
                subtext: `At ₹${item.unitCost >= 100000 ? `${(item.unitCost / 100000).toFixed(1)}L` : `${(item.unitCost / 1000).toFixed(0)}K`} per ${item.unit}`,
            };
        })
        .filter((item): item is RealWorldEquivalent => item !== null)
        .slice(0, 4);
}

// ── Fund Race ──────────────────────────────────────────────────────────────────

function computeFundRace(analysis: PortfolioAnalysis): FundRaceEntry[] {
    return analysis.activeHoldings
        .filter(h => h.marketValue > 500)
        .map(h => {
            const schemeXirr = analysis.xirrAnalysis.schemeXIRR.find(s => s.schemeName === h.schemeName);
            return {
                schemeName: h.schemeName,
                shortName: abbreviateFundName(h.schemeName),
                gainPct: h.unrealisedGainPct,
                xirr: schemeXirr?.xirr ?? null,
                marketValueRs: h.marketValue,
                plan: h.plan,
                color: assignFundColor(h.unrealisedGainPct),
                xirrReliability: schemeXirr?.reliability ?? 'Unknown',
            };
        })
        .sort((a, b) => b.gainPct - a.gainPct);
}

// ── Portfolio Map ──────────────────────────────────────────────────────────────

function computePortfolioMap(analysis: PortfolioAnalysis): PortfolioMapBlock[] {
    return analysis.activeHoldings
        .filter(h => h.marketValue > 500 && h.weight > 0.5)
        .sort((a, b) => b.marketValue - a.marketValue)
        .map(h => ({
            schemeName: h.schemeName,
            shortName: abbreviateFundName(h.schemeName),
            weightPct: h.weight,
            gainPct: h.unrealisedGainPct,
            marketValueRs: h.marketValue,
            color: assignFundColor(h.unrealisedGainPct),
        }));
}

// ── Heatmap ────────────────────────────────────────────────────────────────────

function computeHeatmap(analysis: PortfolioAnalysis): HeatmapYear[] {
    const cf = analysis.cashflowAnalysis;
    if (!cf?.annualCashflows) return [];

    return cf.annualCashflows.map(y => {
        const monthlyInvested: Record<number, number> = {};
        const monthlyWithdrawn: Record<number, number> = {};

        for (let m = 1; m <= 12; m++) {
            monthlyInvested[m] = 0;
            monthlyWithdrawn[m] = 0;
        }

        // Pull monthly data from monthlyCashflows if present
        if (cf.monthlyCashflows) {
            for (const entry of cf.monthlyCashflows) {
                const [yearStr, monthStr] = entry.month.split('-');
                if (parseInt(yearStr) === y.year) {
                    const m = parseInt(monthStr);
                    monthlyInvested[m] = (monthlyInvested[m] ?? 0) + entry.invested;
                    monthlyWithdrawn[m] = (monthlyWithdrawn[m] ?? 0) + entry.withdrawn;
                }
            }
        }

        return {
            year: y.year.toString(),
            totalInvestedRs: y.invested,
            totalWithdrawnRs: y.withdrawn,
            months: Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                investedRs: monthlyInvested[i + 1] ?? 0,
                withdrawnRs: monthlyWithdrawn[i + 1] ?? 0,
            })),
        };
    });
}

// ── Benchmark Bars ─────────────────────────────────────────────────────────────

function computeBenchmarkBars(analysis: PortfolioAnalysis): BenchmarkBar[] {
    const bars: BenchmarkBar[] = [
        { name: 'Bank FD', xirr: 7.0, isPortfolio: false, color: '#64748b' },
        {
            name: 'Your Portfolio',
            xirr: analysis.xirrAnalysis.portfolioXIRR,
            isPortfolio: true,
            color: '#f59e0b',
        },
    ];

    if (analysis.benchmarkComparison?.portfolioBenchmarks) {
        for (const b of analysis.benchmarkComparison.portfolioBenchmarks) {
            bars.push({
                name: b.benchmarkName,
                xirr: b.cagr,
                isPortfolio: false,
                color: '#3b82f6',
            });
        }
    }

    return bars.sort((a, b) => a.xirr - b.xirr);
}

// ── Fund Cards ─────────────────────────────────────────────────────────────────

const FUND_PERSONALITIES = [
    { label: 'Superstar ⭐', minGain: 50, description: 'Exceptional gains' },
    { label: 'Strong performer 💪', minGain: 30, description: 'Beating most peers' },
    { label: 'Steady Eddie 🔄', minGain: 10, description: 'Consistent, reliable' },
    { label: 'Slowly cooking 🍳', minGain: 0, description: 'Positive but slow' },
    { label: 'Needs review 🔍', minGain: -Infinity, description: 'Underperforming' },
] as const;

function getFundPersonality(gainPct: number) {
    return FUND_PERSONALITIES.find(p => gainPct >= p.minGain) ?? FUND_PERSONALITIES[FUND_PERSONALITIES.length - 1];
}

function computeFundCards(analysis: PortfolioAnalysis): FundCard[] {
    return analysis.activeHoldings
        .filter(h => h.marketValue > 1)
        .sort((a, b) => b.marketValue - a.marketValue)
        .map(h => {
            const schemeXirr = analysis.xirrAnalysis.schemeXIRR.find(s => s.schemeName === h.schemeName);
            const personality = getFundPersonality(h.unrealisedGainPct);
            const benchmark = analysis.benchmarkComparison?.fundVsBenchmark.find(f => f.schemeName === h.schemeName);
            return {
                schemeName: h.schemeName,
                shortName: abbreviateFundName(h.schemeName),
                gainPct: h.unrealisedGainPct,
                xirr: schemeXirr?.xirr ?? null,
                xirrReliability: schemeXirr?.reliability ?? 'Unknown',
                marketValueRs: h.marketValue,
                weightPct: h.weight,
                plan: h.plan,
                holdingDays: h.holdingDays,
                personality: personality.label,
                personalityDescription: personality.description,
                benchmarkGapPp: benchmark?.gapPctPoints ?? null,
                benchmarkName: benchmark?.benchmarkName ?? null,
                color: assignFundColor(h.unrealisedGainPct),
                isRegular: h.plan === 'Regular',
            };
        });
}

// ── Closed Funds ───────────────────────────────────────────────────────────────

function computeClosedFunds(analysis: PortfolioAnalysis): ClosedFundSummary[] {
    // Closed folios are those in cashflow analysis with zero balance
    // Build from transaction data if available
    const closedFolios = (analysis as any).portfolioSummary?.closedFolios;
    if (!closedFolios || !Array.isArray(closedFolios)) return [];

    return closedFolios.map((f: any) => ({
        schemeName: f.schemeName || '',
        shortName: abbreviateFundName(f.schemeName || ''),
        investedRs: f.totalInvested || 0,
        redeemedRs: f.totalRedeemed || 0,
        pnlRs: f.pnl || 0,
        pnlPct: f.pnlPct || 0,
    }));
}

// ── Sector Allocation ─────────────────────────────────────────────────────────

const SECTOR_COLORS: Record<string, string> = {
    'Financial Services': '#3b82f6',
    'Information Technology': '#8b5cf6',
    Healthcare: '#10b981',
    'Consumer Staples': '#f59e0b',
    'Consumer Discretionary': '#ec4899',
    Energy: '#ef4444',
    Materials: '#64748b',
    Industrials: '#06b6d4',
    Utilities: '#84cc16',
    'Communication Services': '#f97316',
    'Real Estate': '#a855f7',
    Others: '#94a3b8',
};

function getSectorColor(sector: string): string {
    return SECTOR_COLORS[sector] ?? SECTOR_COLORS['Others'];
}

function computeSectorAllocation(analysis: PortfolioAnalysis): DashboardSectorAllocation | null {
    const sectors = analysis.sectorAnalysis?.broadSectors;
    if (!sectors?.length) return null;

    const sorted = [...sectors].sort((a, b) => b.portfolioWeight - a.portfolioWeight);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    const othersWeight = rest.reduce((sum, s) => sum + s.portfolioWeight, 0);

    return {
        sectors: top.map(s => ({
            sector: s.sector,
            portfolioWeight: s.portfolioWeight,
            equityWeight: s.equityWeight,
            color: getSectorColor(s.sector),
        })),
        othersWeight,
        totalSectorsCount: sectors.length,
    };
}

// ── Top Holdings ──────────────────────────────────────────────────────────────

function computeTopHoldings(analysis: PortfolioAnalysis): DashboardTopHoldings | null {
    const exposure = analysis.companyExposure;
    if (!exposure?.companies?.length) return null;

    const sorted = [...exposure.companies].sort((a, b) => b.portfolioWeight - a.portfolioWeight);
    const top10 = sorted.slice(0, 10);

    return {
        holdings: top10.map(c => ({
            companyName: c.instrumentName,
            portfolioWeight: c.portfolioWeight,
            equityWeight: c.equityWeight,
        })),
        concentrationRisk: {
            top5Weight: exposure.concentrationRisk.top5Weight,
            top10Weight: exposure.concentrationRisk.top10Weight,
            herfindahlIndex: exposure.concentrationRisk.herfindahlIndex,
        },
        totalCompaniesCount: exposure.companies.length,
    };
}

// ── Asset Allocation ──────────────────────────────────────────────────────────

const ASSET_COLORS: Record<string, string> = {
    Equity: '#3b82f6',
    Debt: '#10b981',
    Others: '#94a3b8',
};

function computeAssetAllocation(analysis: PortfolioAnalysis): DashboardAssetBar[] | null {
    const overall = analysis.assetAllocation?.overall;
    if (!overall?.length) return null;

    return overall.map(a => ({
        assetClass: a.assetClass,
        marketValueRs: a.marketValue,
        weight: a.weight,
        color: ASSET_COLORS[a.assetClass] ?? ASSET_COLORS['Others'],
    }));
}

// ── Market Cap Distribution ───────────────────────────────────────────────────

const MCAP_COLORS: Record<string, string> = {
    'Large Cap': '#3b82f6',
    'Mid Cap': '#8b5cf6',
    'Small Cap': '#f59e0b',
    'Global Equity': '#10b981',
    Unclassified: '#94a3b8',
};

function computeMarketCapDistribution(analysis: PortfolioAnalysis): DashboardMarketCapBar[] | null {
    const overall = analysis.marketCapAllocation?.overall;
    if (!overall?.length) return null;

    return overall
        .filter(m => m.portfolioWeight > 0.5)
        .map(m => ({
            bucket: m.bucket,
            portfolioWeight: m.portfolioWeight,
            equityWeight: m.equityWeight,
            color: MCAP_COLORS[m.bucket] ?? MCAP_COLORS['Unclassified'],
        }));
}

// ── Fitness Score ─────────────────────────────────────────────────────────────

function computeFitnessScore(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): PortfolioFitnessScore {
    const performance = computePerformanceDimension(analysis);
    const efficiency = computeEfficiencyDimension(analysis);
    const structure = computeStructureDimension(analysis);
    const discipline = computeDisciplineDimension(analysis, behavioral);

    const composite = Math.round(performance * 0.35 + efficiency * 0.20 + structure * 0.25 + discipline * 0.20);

    let label: string;
    if (composite >= 80) label = 'Excellent';
    else if (composite >= 60) label = 'Good';
    else if (composite >= 40) label = 'Needs Work';
    else label = 'Poor';

    return {
        composite,
        label,
        dimensions: {
            performance: Math.round(performance),
            efficiency: Math.round(efficiency),
            structure: Math.round(structure),
            discipline: Math.round(discipline),
        },
    };
}

function computePerformanceDimension(analysis: PortfolioAnalysis): number {
    const portfolioXirr = analysis.xirrAnalysis.portfolioXIRR;
    // Nifty 50 CAGR from benchmark data, default 12%
    const niftyCagr = analysis.benchmarkComparison?.portfolioBenchmarks
        ?.find(b => b.benchmarkName.toLowerCase().includes('nifty'))?.cagr ?? 12;

    // Score: 50 at benchmark, +5 per % above, -5 per % below, clamped 0-100
    const gap = portfolioXirr - niftyCagr;
    return clamp(50 + gap * 5, 0, 100);
}

function computeEfficiencyDimension(analysis: PortfolioAnalysis): number {
    // Direct plan ratio
    const holdings = analysis.activeHoldings;
    if (holdings.length === 0) return 50;

    const totalMV = holdings.reduce((s, h) => s + h.marketValue, 0);
    const directMV = holdings.filter(h => h.plan === 'Direct').reduce((s, h) => s + h.marketValue, 0);
    const directRatio = totalMV > 0 ? directMV / totalMV : 0;

    // TER drag penalty
    let terDrag = 0;
    if (analysis.terAnalysis) {
        const totalAnnualCost = analysis.terAnalysis.schemes.reduce((s, t) => s + t.annualCostAmount, 0);
        terDrag = totalMV > 0 ? totalAnnualCost / totalMV : 0;
    }

    // Score: directRatio contributes 70pts, low TER contributes 30pts
    const directScore = directRatio * 70;
    const terScore = Math.max(0, 30 - terDrag * 1500); // 2% TER drag = 0 score
    return clamp(directScore + terScore, 0, 100);
}

function computeStructureDimension(analysis: PortfolioAnalysis): number {
    let score = 70; // start with decent base

    // Diversification bonus: more than 3 funds
    const fundCount = analysis.activeHoldings.length;
    if (fundCount >= 3 && fundCount <= 10) score += 10;
    if (fundCount > 10) score -= 5; // too many funds penalty

    // Overlap penalty
    if (analysis.overlapAnalysis) {
        const highOverlaps = analysis.overlapAnalysis.highOverlapWarnings.length;
        score -= highOverlaps * 8;
    }

    // Concentration penalty
    if (analysis.companyExposure) {
        const top5 = analysis.companyExposure.concentrationRisk.top5Weight;
        if (top5 > 50) score -= 15;
        else if (top5 > 35) score -= 5;
    }

    // Fund house concentration penalty
    const fundHouses = analysis.portfolioSummary.fundHouseSummary;
    const maxFHWeight = Math.max(...fundHouses.map(f => f.weight), 0);
    if (maxFHWeight > 70) score -= 15;
    else if (maxFHWeight > 50) score -= 5;

    return clamp(score, 0, 100);
}

function computeDisciplineDimension(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): number {
    let score = 60; // baseline for lumpsum-only investors

    // SIP regularity: blend with baseline (not overwrite)
    if (analysis.sipAnalysis && !analysis.sipAnalysis.isLumpsumOnly) {
        const sipSchemes = analysis.sipAnalysis.sipSchemes;
        if (sipSchemes.length > 0) {
            const avgRegularity = sipSchemes.reduce((s, sip) => s + sip.regularityScore, 0) / sipSchemes.length;
            // baseline 30, then scale regularity into remaining 70 pts
            score = 30 + (avgRegularity / 100) * 70;
        }
    }

    // Panic-free bonus from behavioral signals
    if (behavioral) {
        const panicWeight = behavioral.panicSellCount > 0 ? -10 : 10;
        score += panicWeight;
        if (behavioral.sipConsistency > 80) score += 10;
    }

    return clamp(score, 0, 100);
}

// ── Unique Numbers ───────────────────────────────────────────────────────────

function computeUniqueNumbers(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): UniqueNumbers {
    const now = new Date();

    // daysInvested: from earliest firstTransactionDate across all active holdings
    const dates = analysis.activeHoldings
        .map(h => new Date(h.firstTransactionDate).getTime())
        .filter(d => !isNaN(d));
    const earliestMs = dates.length > 0 ? Math.min(...dates) : now.getTime();
    const daysInvested = Math.max(1, Math.floor((now.getTime() - earliestMs) / 86400000));

    // dailyEarnings: unrealised gain / total days invested
    const dailyEarnings = daysInvested > 0 ? Math.round(analysis.portfolioSummary.totalUnrealisedGain / daysInvested) : 0;

    // investorType: derive from behavioral signals
    const investorType = deriveInvestorType(analysis, behavioral);

    // costOfInaction: sum of all what-if scenario differences where user did worse
    let costOfInaction = 0;
    if (analysis.whatIfScenarios?.scenarios) {
        for (const s of analysis.whatIfScenarios.scenarios) {
            if (!s.difference.userDidBetter && s.difference.absoluteAmount > 0) {
                costOfInaction += s.difference.absoluteAmount;
            }
        }
    }

    // loyaltyBadge: active holding with earliest firstTransactionDate
    let loyaltyBadge = null;
    if (analysis.activeHoldings.length > 0) {
        const oldest = analysis.activeHoldings.reduce((prev, curr) =>
            new Date(curr.firstTransactionDate) < new Date(prev.firstTransactionDate) ? curr : prev
        );
        loyaltyBadge = {
            schemeName: oldest.schemeName,
            holdingDays: oldest.holdingDays,
            firstTransactionDate: oldest.firstTransactionDate,
        };
    }

    return {
        daysInvested,
        dailyEarnings,
        bestDayGain: null, // Phase 1 — needs NAV series pass
        investorType,
        costOfInaction: Math.round(costOfInaction),
        loyaltyBadge,
    };
}

function deriveInvestorType(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): InvestorType {
    if (behavioral) {
        if (behavioral.panicSellCount > 2) return 'Panic Prone';
        if (behavioral.fomoBuyCount > 3) return 'FOMO Chaser';
        if (behavioral.dipBuyCount > 3) return 'Dip Buyer';
        if (behavioral.sipConsistency > 85 && behavioral.avgHoldingMonths > 24) return 'Steady Compounder';
    }

    // Fallback: derive from analysis data
    if (analysis.sipAnalysis && !analysis.sipAnalysis.isLumpsumOnly) {
        const avgReg = analysis.sipAnalysis.sipSchemes.reduce((s, sip) => s + sip.regularityScore, 0)
            / Math.max(1, analysis.sipAnalysis.sipSchemes.length);
        if (avgReg > 80) return 'Steady Compounder';
    }

    const avgHoldingDays = analysis.activeHoldings.reduce((s, h) => s + h.holdingDays, 0)
        / Math.max(1, analysis.activeHoldings.length);
    if (avgHoldingDays > 730) return 'Balanced Investor';

    return 'Growing Investor';
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function assignFundColor(gainPct: number): string {
    if (gainPct > 50) return '#f59e0b';
    if (gainPct > 30) return '#10b981';
    if (gainPct > 10) return '#3b82f6';
    if (gainPct >= 0) return '#8b5cf6';
    return '#ef4444';
}
