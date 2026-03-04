import { PortfolioAnalysis } from '@/types/analysis';
import { BehavioralSignals } from '@/core/analyse/modules/dashboard-data.computer';
import { Actionable } from '@/types/advisory/actionable.type';

type ActionableEvaluator = (analysis: PortfolioAnalysis, behavioral?: BehavioralSignals) => Actionable | null;

function pl(n: number, singular: string, plural?: string): string {
    return n === 1 ? `1 ${singular}` : `${n} ${plural ?? singular + 's'}`;
}

// ── Evaluators ──────────────────────────────────────────────────────────────

function evalSwitchRegularToDirect(analysis: PortfolioAnalysis): Actionable | null {
    const regulars = analysis.activeHoldings.filter(h => h.plan === 'Regular');
    if (regulars.length === 0) return null;

    const totalRegularMV = regulars.reduce((s, h) => s + h.marketValue, 0);
    const annualSavings = analysis.terAnalysis?.potentialAnnualSavings ?? 0;

    return {
        id: 'switch_regular_to_direct',
        title: 'Switch Regular plans to Direct',
        description: `${pl(regulars.length, 'fund')} worth ₹${Math.round(totalRegularMV).toLocaleString(
            'en-IN'
        )} in Regular plans. Switching to Direct could save ~₹${Math.round(annualSavings).toLocaleString('en-IN')}/year in commissions.`,
        relevanceScore: Math.min(95, 60 + regulars.length * 8),
        condition: true,
        metadata: { regularCount: regulars.length, totalRegularMV, annualSavings, funds: regulars.map(r => r.schemeName) },
    };
}

function evalElssUnlockCalendar(analysis: PortfolioAnalysis): Actionable | null {
    const elss = analysis.activeHoldings.filter(
        h => h.schemeName.toLowerCase().includes('elss') || h.schemeName.toLowerCase().includes('tax saver')
    );
    if (elss.length === 0) return null;

    const upcoming = elss.filter(h => {
        const lockEnd = new Date(h.firstTransactionDate);
        lockEnd.setFullYear(lockEnd.getFullYear() + 3);
        const daysToUnlock = Math.ceil((lockEnd.getTime() - Date.now()) / 86400000);
        return daysToUnlock >= 0 && daysToUnlock <= 90;
    });

    if (upcoming.length === 0) return null;

    return {
        id: 'elss_unlock_calendar',
        title: 'ELSS lock-in ending soon',
        description: `${pl(
            upcoming.length,
            'ELSS holding'
        )} will unlock within 90 days. Review performance and decide whether to hold, switch, or redeem.`,
        relevanceScore: 65,
        condition: true,
        metadata: { funds: upcoming.map(h => ({ schemeName: h.schemeName, firstTxDate: h.firstTransactionDate })) },
    };
}

function evalTaxHarvestWindow(analysis: PortfolioAnalysis): Actionable | null {
    const month = new Date().getMonth() + 1;
    if (month < 1 || month > 3) return null;

    const remaining = analysis.taxHarvesting?.ltcgExemptionRemaining ?? 0;
    if (remaining <= 0) return null;

    return {
        id: 'tax_harvest_window',
        title: 'Harvest LTCG before March 31',
        description: `You have ₹${Math.round(remaining).toLocaleString(
            'en-IN'
        )} of unused LTCG exemption. Book gains tax-free before the financial year ends.`,
        relevanceScore: 85,
        condition: true,
        metadata: { remaining, month },
    };
}

function evalConsolidateOverlap(analysis: PortfolioAnalysis): Actionable | null {
    const highOverlap = analysis.overlapAnalysis?.pairwiseOverlap.filter(p => p.overlapPct > 40) ?? [];
    if (highOverlap.length === 0) return null;

    return {
        id: 'consolidate_overlap',
        title: 'Consolidate overlapping funds',
        description: `${pl(highOverlap.length, 'fund pair')} with >40% overlap. Consolidating could reduce fees and simplify tracking.`,
        relevanceScore: 70,
        condition: true,
        metadata: { pairs: highOverlap.map(p => ({ scheme1: p.scheme1, scheme2: p.scheme2, overlap: p.overlapPct })) },
    };
}

function evalReviveExitDormant(analysis: PortfolioAnalysis): Actionable | null {
    const now = Date.now();
    const sipSchemeNames = new Set((analysis.sipAnalysis?.sipSchemes ?? []).map(s => s.schemeName));
    const dormant = analysis.activeHoldings.filter(h => {
        if (sipSchemeNames.has(h.schemeName)) return false;
        const lastTx = new Date(h.lastTransactionDate).getTime();
        const daysSinceLastTx = (now - lastTx) / 86400000;
        return daysSinceLastTx > 365;
    });

    if (dormant.length === 0) return null;

    return {
        id: 'revive_exit_dormant',
        title: 'Review dormant holdings',
        description: `${pl(
            dormant.length,
            'fund'
        )} with no activity for over a year. Review performance and decide to continue, add more, or exit.`,
        relevanceScore: 55,
        condition: true,
        metadata: {
            funds: dormant.map(h => ({ schemeName: h.schemeName, holdingDays: h.holdingDays, lastTxDate: h.lastTransactionDate })),
        },
    };
}

function evalRedirectMicroHoldings(analysis: PortfolioAnalysis): Actionable | null {
    const micro = analysis.activeHoldings.filter(h => h.marketValue < 2000 && h.weight < 1);
    if (micro.length === 0) return null;

    const totalMicroMV = micro.reduce((s, h) => s + h.marketValue, 0);

    return {
        id: 'redirect_micro_holdings',
        title: 'Clean up micro holdings',
        description: `${pl(
            micro.length,
            'fund'
        )} worth less than ₹2,000 each and under 1% of your portfolio. Consider redeeming and consolidating into your core funds.`,
        relevanceScore: 45,
        condition: true,
        metadata: {
            count: micro.length,
            totalMicroMV,
            funds: micro.map(h => ({ schemeName: h.schemeName, marketValue: h.marketValue, weight: h.weight })),
        },
    };
}

function evalRebalanceAfterDrift(analysis: PortfolioAnalysis): Actionable | null {
    const drift = analysis.rebalanceAnalysis?.portfolioDrift ?? 0;
    if (drift <= 10) return null;

    return {
        id: 'rebalance_after_drift',
        title: 'Rebalance your portfolio',
        description: `Your asset allocation has drifted ${drift.toFixed(1)}% from target. Rebalancing restores your intended risk profile.`,
        relevanceScore: Math.min(80, 50 + drift * 2),
        condition: true,
        metadata: { drift, actions: analysis.rebalanceAnalysis?.actions?.slice(0, 3) ?? [] },
    };
}

function evalAddBestPerformerDip(analysis: PortfolioAnalysis): Actionable | null {
    if (!analysis.benchmarkComparison) return null;

    // DISABLED: same issue as market_crash_behavioral — maxDrawdown is all-time, not recent.
    // Would always trigger since Nifty's all-time MDD is ~-60%. Re-enable once we have recentDrawdown.
    // For now, only show outperformers without the "dip" framing.
    return null;

    // return {
    //     id: 'add_best_performer_dip',
    //     title: 'Your outperforming funds during a correction',
    //     description: `${pl(outperformers.length, 'fund')} in your portfolio outperforming ${outperformers.length === 1 ? 'its' : 'their'} benchmark. Market corrections can be opportunities to review your allocation.`,
    //     relevanceScore: 60,
    //     condition: true,
    //     metadata: { topFund: outperformers[0].schemeName, gap: outperformers[0].gapPctPoints },
    // };
}

function evalSetSipIncreaseReminder(analysis: PortfolioAnalysis): Actionable | null {
    if (!analysis.sipAnalysis || analysis.sipAnalysis.isLumpsumOnly) return null;

    // Check if any SIP has been unchanged for 12+ months
    const stableSips = analysis.sipAnalysis.sipSchemes.filter(s => {
        // Use regularity as a proxy — a high regularity SIP that's been running long
        return s.regularityScore > 70 && s.totalSIPInvested > s.sipAmount * 12;
    });

    if (stableSips.length === 0) return null;

    return {
        id: 'set_sip_increase_reminder',
        title: 'Step up your SIPs',
        description: `${pl(
            stableSips.length,
            'SIP'
        )} running at the same amount for 12+ months. Consider a 10% annual step-up to keep pace with inflation.`,
        relevanceScore: 50,
        condition: true,
        metadata: { sips: stableSips.map(s => ({ schemeName: s.schemeName, sipAmount: s.sipAmount })) },
    };
}

// ── Main ────────────────────────────────────────────────────────────────────

const EVALUATORS: ActionableEvaluator[] = [
    evalSwitchRegularToDirect,
    evalElssUnlockCalendar,
    evalTaxHarvestWindow,
    evalConsolidateOverlap,
    evalReviveExitDormant,
    evalRedirectMicroHoldings,
    evalRebalanceAfterDrift,
    evalAddBestPerformerDip,
    evalSetSipIncreaseReminder,
];

export function computeActionables(analysis: PortfolioAnalysis, behavioral?: BehavioralSignals): Actionable[] {
    return EVALUATORS.map(evaluator => evaluator(analysis, behavioral))
        .filter((a): a is Actionable => a !== null && a.condition)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
