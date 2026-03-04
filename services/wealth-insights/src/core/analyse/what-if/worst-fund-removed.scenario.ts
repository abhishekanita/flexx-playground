/**
 * Worst Fund Removed scenario.
 *
 * Identifies the worst-performing scheme by XIRR and hypothetically
 * redirects those cashflows into the user's best-performing scheme.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';

export function computeWorstFundRemoved(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    // Get reliable scheme XIRRs with meaningful positions
    const reliableSchemes = analysis.xirrAnalysis.schemeXIRR.filter(
        (s) => s.marketValue > 0 && !isNaN(s.xirr) && s.reliability !== 'Insufficient',
    );

    if (reliableSchemes.length < 2) return null;

    const sorted = [...reliableSchemes].sort((a, b) => a.xirr - b.xirr);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];

    // If the worst fund is actually positive, less impactful
    if (worst.xirr > 5) return null; // not really an "underperformer" scenario

    // Find the worst fund's folio to get its invested amount
    const worstFolio = data.folios.find(
        (f) => f.scheme.current_name === worst.schemeName && f.closingUnitBalance > 0,
    );
    if (!worstFolio) return null;

    const worstInvested = worstFolio.transactions
        .filter((tx) => tx.amount !== null && tx.amount > 0 && ['Purchase', 'SIP', 'NFO Allotment', 'Switch In', 'STP In'].includes(tx.type))
        .reduce((s, tx) => s + tx.amount!, 0);

    if (worstInvested <= 0) return null;

    // Hypothetical: if the same amount had earned the best fund's XIRR
    // Simple compound approximation over the holding period
    const holdingYears = worst.holdingDays / 365.2425;
    const actualValue = worst.marketValue;
    const hypotheticalValue = worstInvested * Math.pow(1 + best.xirr / 100, holdingYears);

    const difference = hypotheticalValue - actualValue;
    const totalPortfolioMV = analysis.portfolioSummary.totalMarketValue;
    const hypotheticalPortfolioMV = totalPortfolioMV - actualValue + hypotheticalValue;

    const actualPortfolioXIRR = analysis.xirrAnalysis.portfolioXIRR;

    return {
        id: 'WORST_FUND_REMOVED',
        name: 'Worst Fund → Best Fund',
        description: `What if you had invested in ${best.schemeName} instead of ${worst.schemeName}?`,
        relevanceScore: computeRelevance(worst.xirr, difference, totalPortfolioMV),

        actual: {
            totalInvested: Math.round(worstInvested),
            currentValue: Math.round(actualValue),
            xirr: worst.xirr,
        },

        hypothetical: {
            totalInvested: Math.round(worstInvested),
            hypotheticalValue: Math.round(hypotheticalValue),
            hypotheticalXirr: best.xirr,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: worstInvested > 0
                ? Math.round((difference / worstInvested) * 10000) / 100
                : 0,
            userDidBetter: difference < 0,
        },

        dataPointsForNarrative: {
            worstFund: worst.schemeName,
            worstXirr: worst.xirr,
            worstValue: Math.round(actualValue),
            bestFund: best.schemeName,
            bestXirr: best.xirr,
            hypotheticalValue: Math.round(hypotheticalValue),
            invested: Math.round(worstInvested),
            holdingYears: Math.round(holdingYears * 10) / 10,
            opportunityCost: Math.round(difference),
            hypotheticalPortfolioMV: Math.round(hypotheticalPortfolioMV),
            portfolioImpactPct: Math.round((difference / totalPortfolioMV) * 10000) / 100,
            framing: `Your worst fund (${worst.schemeName} at ${worst.xirr.toFixed(1)}% XIRR) cost you ₹${Math.round(difference).toLocaleString('en-IN')}. If that money had been in ${best.schemeName} (${best.xirr.toFixed(1)}% XIRR), you'd have ₹${Math.round(hypotheticalValue).toLocaleString('en-IN')} instead of ₹${Math.round(actualValue).toLocaleString('en-IN')}.`,
        },
    };
}

function computeRelevance(worstXirr: number, difference: number, portfolioMV: number): number {
    // Higher relevance if worst fund has negative XIRR
    let score = 50;
    if (worstXirr < 0) score += 30;
    else if (worstXirr < 5) score += 15;

    // Higher relevance if the opportunity cost is a significant % of portfolio
    const impactPct = Math.abs(difference) / portfolioMV * 100;
    if (impactPct > 5) score += 20;
    else if (impactPct > 2) score += 10;

    return Math.min(score, 100);
}
