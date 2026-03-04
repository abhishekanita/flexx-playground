/**
 * Peer Percentile — "Am I doing better than people like me?"
 * Compares user metrics against a hardcoded cohort of 100 dummy investors.
 */

import { PortfolioAnalysis } from '@/types/analysis';
import { PeerPercentileResult, PeerDimension } from '@/types/analysis/peer-percentile.type';
import { PEER_COHORT } from '@/data/peer-cohort';

export function computePeerPercentile(analysis: PortfolioAnalysis): PeerPercentileResult {
    const cohortSize = PEER_COHORT.length;

    // ── Extract user metrics ──────────────────────────────────────────────────

    // Discipline: avg regularityScore from sipSchemes, or 50 if lumpsum-only
    let discipline = 50;
    if (analysis.sipAnalysis && !analysis.sipAnalysis.isLumpsumOnly && analysis.sipAnalysis.sipSchemes.length > 0) {
        discipline = analysis.sipAnalysis.sipSchemes.reduce((s, sip) => s + sip.regularityScore, 0)
            / analysis.sipAnalysis.sipSchemes.length;
    }

    // Returns: portfolio XIRR
    const returns = analysis.xirrAnalysis.portfolioXIRR;

    // Diversification: fund count score + direct plan ratio
    const fundCount = analysis.activeHoldings.length;
    let fundCountScore: number;
    if (fundCount >= 3 && fundCount <= 10) fundCountScore = 100;
    else if (fundCount < 3) fundCountScore = Math.max(20, fundCount * 33);
    else fundCountScore = Math.max(20, 100 - (fundCount - 10) * 8); // penalty for >10

    const totalMV = analysis.activeHoldings.reduce((s, h) => s + h.marketValue, 0);
    const directMV = analysis.activeHoldings.filter(h => h.plan === 'Direct').reduce((s, h) => s + h.marketValue, 0);
    const directRatio = totalMV > 0 ? directMV / totalMV : 0;
    const diversification = fundCountScore * 0.6 + directRatio * 100 * 0.4;

    // Consistency: tenure months from earliest firstTransactionDate
    const now = new Date();
    const dates = analysis.activeHoldings
        .map(h => new Date(h.firstTransactionDate).getTime())
        .filter(d => !isNaN(d));
    const earliestMs = dates.length > 0 ? Math.min(...dates) : now.getTime();
    const tenureMonths = Math.max(1, Math.round((now.getTime() - earliestMs) / (30.44 * 24 * 60 * 60 * 1000)));

    // ── Compute percentiles ───────────────────────────────────────────────────

    const disciplinePercentile = percentile(PEER_COHORT.map(p => p.discipline), discipline);
    const returnsPercentile = percentile(PEER_COHORT.map(p => p.xirr), returns);
    const diversificationPercentile = percentile(
        PEER_COHORT.map(p => {
            let fcs: number;
            if (p.fundCount >= 3 && p.fundCount <= 10) fcs = 100;
            else if (p.fundCount < 3) fcs = Math.max(20, p.fundCount * 33);
            else fcs = Math.max(20, 100 - (p.fundCount - 10) * 8);
            return fcs * 0.6 + p.directRatio * 100 * 0.4;
        }),
        diversification,
    );
    const consistencyPercentile = percentile(PEER_COHORT.map(p => p.tenureMonths), tenureMonths);

    // ── Weighted overall ──────────────────────────────────────────────────────

    const dimensions: PeerDimension[] = [
        {
            key: 'discipline',
            label: 'Discipline',
            userValue: Math.round(discipline),
            percentile: disciplinePercentile,
            weight: 0.25,
            description: 'SIP regularity & consistency',
        },
        {
            key: 'returns',
            label: 'Returns',
            userValue: Math.round(returns * 100) / 100,
            percentile: returnsPercentile,
            weight: 0.30,
            description: 'Portfolio XIRR vs peers',
        },
        {
            key: 'diversification',
            label: 'Diversification',
            userValue: Math.round(diversification),
            percentile: diversificationPercentile,
            weight: 0.25,
            description: 'Fund count & direct plan ratio',
        },
        {
            key: 'consistency',
            label: 'Consistency',
            userValue: tenureMonths,
            percentile: consistencyPercentile,
            weight: 0.20,
            description: 'Investment tenure in months',
        },
    ];

    const overallPercentile = Math.round(
        dimensions.reduce((s, d) => s + d.percentile * d.weight, 0),
    );

    // Personality from dashboardData uniqueNumbers
    const personality = analysis.dashboardData?.uniqueNumbers?.investorType ?? 'Growing Investor';

    return {
        overallPercentile,
        personality,
        dimensions,
        cohortSize,
    };
}

/** Percentile: (count of cohort values <= user value) / cohortSize × 100 */
function percentile(cohortValues: number[], userValue: number): number {
    const count = cohortValues.filter(v => v <= userValue).length;
    return Math.round((count / cohortValues.length) * 100);
}
