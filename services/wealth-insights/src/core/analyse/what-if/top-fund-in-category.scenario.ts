/**
 * Top Fund in Category scenario.
 *
 * For each active fund, uses FundMetadata.comparison[] to find the
 * top-performing peer by 3Y return. Approximates hypothetical value
 * if the user had been in the top peer instead.
 *
 * Sync — uses pre-fetched metadata, no new API calls.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { FundMetadata } from '@/types/analysis/enrichment.type';
import { parseDate, daysBetween } from '../helpers/financial-math';

export function computeTopFundInCategory(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
    metadata: Map<string, FundMetadata>,
): WhatIfScenario | null {
    if (metadata.size === 0) return null;

    const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0);
    if (activeFolios.length === 0) return null;

    let totalActualMV = 0;
    let totalHypotheticalMV = 0;
    let totalInvested = 0;
    let underperformanceCount = 0;
    let bestPeerName = '';
    let biggestGap = 0;

    for (const folio of activeFolios) {
        const meta = metadata.get(folio.scheme.isin);
        if (!meta || !meta.comparison || meta.comparison.length === 0) continue;

        // Find top peer by 3Y return (fallback to 1Y)
        const topPeer = [...meta.comparison]
            .filter((p) => p.year3 != null || p.year1 != null)
            .sort((a, b) => (b.year3 ?? b.year1 ?? 0) - (a.year3 ?? a.year1 ?? 0))[0];

        if (!topPeer) continue;

        // Use the return period that the data actually covers (3Y or 1Y)
        const has3Y = topPeer.year3 != null;
        const topReturn = has3Y ? topPeer.year3! : (topPeer.year1 ?? 0);
        const actualReturn = has3Y ? (meta.returns?.year3 ?? 0) : (meta.returns?.year1 ?? 0);
        const returnPeriodYears = has3Y ? 3 : 1;

        if (topReturn <= actualReturn) continue; // Fund is already top or better

        const mv = folio.snapshot.marketValue;
        const costValue = folio.snapshot.totalCostValue;
        if (mv <= 0 || costValue <= 0) continue;

        // Cap compounding at the return's source period — don't extrapolate 3Y returns over 7+ years
        const firstTx = folio.transactions[0];
        const actualHoldingYears = firstTx
            ? daysBetween(parseDate(firstTx.date), new Date()) / 365.2425
            : returnPeriodYears;
        const holdingYears = Math.min(actualHoldingYears, returnPeriodYears);

        // Hypothetical: costValue grown at top peer's rate, but only for the capped period
        // Then grow the remaining years at actual return rate
        const hypotheticalForPeriod = costValue * Math.pow(1 + topReturn / 100, holdingYears);
        const remainingYears = actualHoldingYears - holdingYears;
        const hypotheticalMV = remainingYears > 0
            ? hypotheticalForPeriod * Math.pow(1 + actualReturn / 100, remainingYears)
            : hypotheticalForPeriod;

        totalActualMV += mv;
        totalHypotheticalMV += hypotheticalMV;
        totalInvested += costValue;
        underperformanceCount++;

        const gap = topReturn - actualReturn;
        if (gap > biggestGap) {
            biggestGap = gap;
            bestPeerName = topPeer.shortName || topPeer.name;
        }
    }

    if (underperformanceCount === 0 || totalInvested <= 0) return null;

    const difference = totalHypotheticalMV - totalActualMV;

    // Relevance: higher if underperformance gap is significant
    const relevanceScore = biggestGap > 5 ? 80 : biggestGap > 2 ? 65 : 55;

    return {
        id: 'TOP_FUND_IN_CATEGORY',
        name: 'Top Fund in Category',
        description: 'What if each fund had been the top performer in its category?',
        relevanceScore,

        actual: {
            totalInvested: Math.round(totalInvested),
            currentValue: Math.round(totalActualMV),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(totalInvested),
            hypotheticalValue: Math.round(totalHypotheticalMV),
            hypotheticalXirr: 0,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: totalInvested > 0
                ? Math.round((difference / totalInvested) * 10000) / 100
                : 0,
            userDidBetter: difference < 0,
        },

        dataPointsForNarrative: {
            underperformingFunds: underperformanceCount,
            bestPeer: bestPeerName,
            biggestGapPctPoints: Math.round(biggestGap * 100) / 100,
            actualValue: Math.round(totalActualMV),
            hypotheticalValue: Math.round(totalHypotheticalMV),
            framing: difference > 0
                ? `If you had picked category toppers, your portfolio could be ₹${Math.round(difference).toLocaleString('en-IN')} more. The biggest gap was ${biggestGap.toFixed(1)} percentage points (${bestPeerName})`
                : `Your fund selection is strong — category toppers wouldn't have done much better`,
        },
    };
}
