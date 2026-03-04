/**
 * PPF vs Your MFs scenario.
 *
 * "What if you'd put it all in PPF instead?"
 * Replays exact portfolio cashflows into PPF at 7.1% p.a. compounded annually.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { buildPortfolioCashflows } from '../helpers/cashflow-builder';
import { xirr as computeXirr, parseDate } from '../helpers/financial-math';

const PPF_RATE = 0.071; // 7.1% per annum

export function computePPFComparison(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    const cashflows = buildPortfolioCashflows(data);
    if (cashflows.length === 0) return null;

    const investments = cashflows
        .filter(([, amt]) => amt < 0)
        .map(([date, amt]) => ({ date, amount: Math.abs(amt) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (investments.length === 0) return null;

    const asOfDate = parseDate(analysis.asOfDate);
    let totalPPFValue = 0;
    let totalInvested = 0;

    // Each contribution compounds at PPF rate annually from its date to today
    for (const inv of investments) {
        const years =
            (asOfDate.getTime() - inv.date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
        if (years <= 0) continue;

        const ppfValue = inv.amount * Math.pow(1 + PPF_RATE, years);
        totalPPFValue += ppfValue;
        totalInvested += inv.amount;
    }

    if (totalInvested <= 0) return null;

    // Actual MF value: market value + redemptions received
    const totalRedemptions = cashflows
        .filter(([, amt]) => amt > 0)
        .reduce((s, [, amt]) => s + amt, 0);
    const actualValue = analysis.portfolioSummary.totalMarketValue + totalRedemptions;

    // Compute PPF XIRR
    const ppfCashflows: [Date, number][] = investments.map((inv) => [inv.date, -inv.amount]);
    ppfCashflows.push([asOfDate, totalPPFValue]);
    const ppfXirr = computeXirr(ppfCashflows) * 100;

    const difference = actualValue - totalPPFValue;

    return {
        id: 'PPF_COMPARISON',
        name: 'PPF vs Your Mutual Funds',
        description: "What if you'd put it all in PPF instead?",
        relevanceScore: 75,

        actual: {
            totalInvested: Math.round(totalInvested),
            currentValue: Math.round(actualValue),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(totalInvested),
            hypotheticalValue: Math.round(totalPPFValue),
            hypotheticalXirr: isNaN(ppfXirr) ? PPF_RATE * 100 : Math.round(ppfXirr * 100) / 100,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference:
                totalInvested > 0
                    ? Math.round((difference / totalInvested) * 10000) / 100
                    : 0,
            userDidBetter: difference > 0,
        },

        dataPointsForNarrative: {
            ppfRate: '7.1%',
            ppfValue: Math.round(totalPPFValue),
            mfValue: Math.round(actualValue),
            totalInvested: Math.round(totalInvested),
            mfXirr: analysis.xirrAnalysis.portfolioXIRR,
            holdingYears:
                Math.round(
                    ((asOfDate.getTime() - investments[0].date.getTime()) /
                        (365.2425 * 24 * 60 * 60 * 1000)) *
                        10,
                ) / 10,
            framing:
                difference > 0
                    ? `Your mutual funds earned ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} more than PPF would have — risk paid off!`
                    : `PPF would have earned ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} more — but MFs still have upside potential`,
        },
    };
}
