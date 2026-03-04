import { PortfolioAnalysis } from '@/types/analysis';
import { BehavioralSignals } from '@/core/analyse/modules/dashboard-data.computer';
import { InsightKey, InsightCategory, InsightFrequency, ConditionResult } from '@/types/advisory/insight-state.type';

export type ConditionEvaluator = (analysis: PortfolioAnalysis, behavioral?: BehavioralSignals) => ConditionResult;

export interface InsightMeta {
    category: InsightCategory;
    frequencyType: InsightFrequency;
}

// ── Metadata Registry ────────────────────────────────────────────────────────

export const INSIGHT_METADATA: Record<InsightKey, InsightMeta> = {
    // Health
    regular_plan_cost:        { category: 'health', frequencyType: 'ONCE' },
    overlap_warning:          { category: 'health', frequencyType: 'TRIGGERED' },
    fund_house_concentration: { category: 'health', frequencyType: 'ONCE' },
    no_nominees:              { category: 'health', frequencyType: 'ONCE' },
    fund_manager_change:      { category: 'health', frequencyType: 'TRIGGERED' },
    benchmark_weekly:         { category: 'health', frequencyType: 'WEEKLY' },
    best_worst_fund_weekly:   { category: 'health', frequencyType: 'WEEKLY' },
    risk_reward_monthly:      { category: 'health', frequencyType: 'MONTHLY' },
    asset_allocation_drift:   { category: 'health', frequencyType: 'TRIGGERED' },
    // Tax
    ltcg_boundary_30d:        { category: 'tax', frequencyType: 'TRIGGERED' },
    ltcg_exemption_80pct:     { category: 'tax', frequencyType: 'ONCE' },
    tax_harvest_seasonal:     { category: 'tax', frequencyType: 'TRIGGERED' },
    elss_unlock_30d:          { category: 'tax', frequencyType: 'TRIGGERED' },
    // Behavioral
    investor_profile:         { category: 'behavioral', frequencyType: 'ONCE' },
    market_crash_behavioral:  { category: 'behavioral', frequencyType: 'TRIGGERED' },
    sip_missed:               { category: 'behavioral', frequencyType: 'TRIGGERED' },
    portfolio_neglect:        { category: 'behavioral', frequencyType: 'ONCE' },
    too_many_funds:           { category: 'behavioral', frequencyType: 'ONCE' },
};

// ── Health Condition Evaluators ──────────────────────────────────────────────

function evalRegularPlanCost(analysis: PortfolioAnalysis): ConditionResult {
    const regulars = analysis.activeHoldings.filter(h => h.plan === 'Regular');
    const totalRegularMV = regulars.reduce((s, h) => s + h.marketValue, 0);
    const annualSavings = analysis.terAnalysis?.potentialAnnualSavings ?? 0;
    return {
        met: regulars.length > 0,
        value: { regularCount: regulars.length, totalRegularMV, annualSavings },
        score: regulars.length > 0 ? Math.min(90, 50 + regulars.length * 10) : 0,
    };
}

function evalOverlapWarning(analysis: PortfolioAnalysis): ConditionResult {
    const warnings = analysis.overlapAnalysis?.highOverlapWarnings ?? [];
    const pairs = analysis.overlapAnalysis?.pairwiseOverlap.filter(p => p.overlapPct > 40) ?? [];
    return {
        met: warnings.length > 0,
        value: { warnings, highOverlapPairs: pairs.length },
        score: warnings.length > 0 ? Math.min(85, 50 + warnings.length * 15) : 0,
    };
}

function evalFundHouseConcentration(analysis: PortfolioAnalysis): ConditionResult {
    const fundHouses = analysis.portfolioSummary.fundHouseSummary;
    const concentrated = fundHouses.filter(f => f.weight > 50);
    return {
        met: concentrated.length > 0,
        value: concentrated.length > 0 ? { fundHouse: concentrated[0].fundHouse, weight: concentrated[0].weight } : null,
        score: concentrated.length > 0 ? 60 : 0,
    };
}

function evalNoNominees(analysis: PortfolioAnalysis): ConditionResult {
    const withoutNominee = analysis.activeHoldings.filter(h => !h.hasNominee);
    return {
        met: withoutNominee.length > 0,
        value: { count: withoutNominee.length, folios: withoutNominee.map(h => h.folioNumber) },
        score: withoutNominee.length > 0 ? 70 : 0,
    };
}

function evalFundManagerChange(_analysis: PortfolioAnalysis): ConditionResult {
    // Requires enrichment metadata diff — stubbed for Phase 1
    return { met: false, value: null, score: 0 };
}

function evalBenchmarkWeekly(analysis: PortfolioAnalysis): ConditionResult {
    const benchmarks = analysis.benchmarkComparison?.portfolioBenchmarks ?? [];
    const portfolioXirr = analysis.xirrAnalysis.portfolioXIRR;
    return {
        met: true, // always met — computed weekly
        value: { portfolioXirr, benchmarks: benchmarks.map(b => ({ name: b.benchmarkName, cagr: b.cagr })) },
        score: 40,
    };
}

function evalBestWorstFundWeekly(analysis: PortfolioAnalysis): ConditionResult {
    const sorted = [...analysis.activeHoldings].sort((a, b) => b.unrealisedGainPct - a.unrealisedGainPct);
    const best = sorted[0] ?? null;
    const worst = sorted[sorted.length - 1] ?? null;
    return {
        met: true,
        value: {
            best: best ? { schemeName: best.schemeName, gainPct: best.unrealisedGainPct } : null,
            worst: worst ? { schemeName: worst.schemeName, gainPct: worst.unrealisedGainPct } : null,
        },
        score: 35,
    };
}

function evalRiskRewardMonthly(analysis: PortfolioAnalysis): ConditionResult {
    const risk = analysis.riskMetrics;
    return {
        met: risk !== null,
        value: risk ? {
            sharpeRatio: risk.sharpeRatio,
            maxDrawdown: risk.maxDrawdown,
            volatility: risk.portfolioVolatility,
        } : null,
        score: risk ? 45 : 0,
    };
}

function evalAssetAllocationDrift(analysis: PortfolioAnalysis): ConditionResult {
    const drift = analysis.rebalanceAnalysis?.portfolioDrift ?? 0;
    return {
        met: drift > 10,
        value: { drift, needsRebalancing: analysis.rebalanceAnalysis?.needsRebalancing ?? false },
        score: drift > 10 ? Math.min(80, 50 + drift * 2) : 0,
    };
}

// ── Tax Condition Evaluators ────────────────────────────────────────────────

function evalLtcgBoundary30d(analysis: PortfolioAnalysis): ConditionResult {
    const opps = analysis.taxHarvesting?.opportunities.filter(
        o => o.daysToLTCG !== null && o.daysToLTCG >= 1 && o.daysToLTCG <= 30
    ) ?? [];
    return {
        met: opps.length > 0,
        value: opps.map(o => ({ schemeName: o.schemeName, daysToLTCG: o.daysToLTCG, gain: o.unrealisedGain })),
        score: opps.length > 0 ? 85 : 0,
    };
}

function evalLtcgExemption80pct(analysis: PortfolioAnalysis): ConditionResult {
    const used = analysis.taxHarvesting?.ltcgExemptionUsed ?? 0;
    const met = used > 100000; // 80% of 1.25L
    return {
        met,
        value: { ltcgUsed: used, remaining: analysis.taxHarvesting?.ltcgExemptionRemaining ?? 0 },
        score: met ? 75 : 0,
    };
}

function evalTaxHarvestSeasonal(analysis: PortfolioAnalysis): ConditionResult {
    const month = new Date().getMonth() + 1; // 1-12
    const isTaxSeason = month >= 1 && month <= 3;
    const remaining = analysis.taxHarvesting?.ltcgExemptionRemaining ?? 0;
    const met = isTaxSeason && remaining > 0;
    return {
        met,
        value: { month, remaining, isTaxSeason },
        score: met ? 80 : 0,
    };
}

function evalElssUnlock30d(analysis: PortfolioAnalysis): ConditionResult {
    // ELSS funds have 3-year lock-in PER INSTALLMENT (not per folio).
    // We use firstTransactionDate as an approximation for the oldest installment.
    // This means "some units in this holding are unlocking" — not all units.
    const elssHoldings = analysis.activeHoldings.filter(h =>
        h.schemeName.toLowerCase().includes('elss') || h.schemeName.toLowerCase().includes('tax saver')
    );
    const approaching = elssHoldings.filter(h => {
        // Check if the oldest installment's lock-in is ending within 30 days
        const lockEnd = new Date(h.firstTransactionDate);
        lockEnd.setFullYear(lockEnd.getFullYear() + 3);
        const daysToUnlock = Math.ceil((lockEnd.getTime() - Date.now()) / 86400000);
        return daysToUnlock >= 0 && daysToUnlock <= 30;
    });
    return {
        met: approaching.length > 0,
        value: approaching.map(h => ({
            schemeName: h.schemeName,
            firstTxDate: h.firstTransactionDate,
            marketValue: h.marketValue,
        })),
        score: approaching.length > 0 ? 70 : 0,
    };
}

// ── Behavioral Condition Evaluators ─────────────────────────────────────────

function evalInvestorProfile(_analysis: PortfolioAnalysis): ConditionResult {
    return { met: true, value: null, score: 50 }; // always met on first analysis
}

function evalMarketCrashBehavioral(_analysis: PortfolioAnalysis): ConditionResult {
    // DISABLED: was using all-time maxDrawdown (always fires — Nifty's all-time MDD is ~-60%).
    // Needs a proper recent-drawdown signal (e.g. currentDrawdownFromPeak or 30-day return)
    // to avoid permanent false alarms. Re-enable once PortfolioBenchmark has a recentDrawdown field.
    return { met: false, value: null, score: 0 };
}

function evalSipMissed(analysis: PortfolioAnalysis): ConditionResult {
    const missed = analysis.sipAnalysis?.sipSchemes.filter(s => s.missedMonths > 0) ?? [];
    return {
        met: missed.length > 0,
        value: missed.map(s => ({ schemeName: s.schemeName, missedMonths: s.missedMonths, regularityScore: s.regularityScore })),
        score: missed.length > 0 ? Math.min(70, 40 + missed.length * 10) : 0,
    };
}

function evalPortfolioNeglect(analysis: PortfolioAnalysis): ConditionResult {
    const now = Date.now();
    // Exclude funds that have active SIPs (they're being regularly invested in)
    const sipSchemeNames = new Set(
        (analysis.sipAnalysis?.sipSchemes ?? []).map(s => s.schemeName)
    );
    const neglected = analysis.activeHoldings.filter(h => {
        if (sipSchemeNames.has(h.schemeName)) return false; // has active SIP — not neglected
        const lastTx = new Date(h.lastTransactionDate).getTime();
        const daysSinceLastTx = (now - lastTx) / 86400000;
        return h.holdingDays > 365 && daysSinceLastTx > 365; // 1 year, not 6 months
    });
    return {
        met: neglected.length > 0,
        value: neglected.map(h => ({ schemeName: h.schemeName, holdingDays: h.holdingDays, lastTxDate: h.lastTransactionDate })),
        score: neglected.length > 0 ? 55 : 0,
    };
}

function evalTooManyFunds(analysis: PortfolioAnalysis): ConditionResult {
    const count = analysis.portfolioSummary.activeFolioCount;
    return {
        met: count > 10,
        value: { activeFolioCount: count },
        score: count > 10 ? Math.min(65, 40 + (count - 10) * 5) : 0,
    };
}

// ── Condition Registry ──────────────────────────────────────────────────────

export const CONDITION_REGISTRY: Record<InsightKey, ConditionEvaluator> = {
    // Health
    regular_plan_cost: evalRegularPlanCost,
    overlap_warning: evalOverlapWarning,
    fund_house_concentration: evalFundHouseConcentration,
    no_nominees: evalNoNominees,
    fund_manager_change: evalFundManagerChange,
    benchmark_weekly: evalBenchmarkWeekly,
    best_worst_fund_weekly: evalBestWorstFundWeekly,
    risk_reward_monthly: evalRiskRewardMonthly,
    asset_allocation_drift: evalAssetAllocationDrift,
    // Tax
    ltcg_boundary_30d: evalLtcgBoundary30d,
    ltcg_exemption_80pct: evalLtcgExemption80pct,
    tax_harvest_seasonal: evalTaxHarvestSeasonal,
    elss_unlock_30d: evalElssUnlock30d,
    // Behavioral
    investor_profile: evalInvestorProfile,
    market_crash_behavioral: evalMarketCrashBehavioral,
    sip_missed: evalSipMissed,
    portfolio_neglect: evalPortfolioNeglect,
    too_many_funds: evalTooManyFunds,
};
