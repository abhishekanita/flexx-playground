/**
 * FD vs Mutual Fund scenario.
 *
 * Replays the user's exact cashflows through a hypothetical bank FD
 * at 7% annual (quarterly compounding) with TDS at 30% for interest > ₹40,000.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { buildPortfolioCashflows } from '../helpers/cashflow-builder';
import { xirr as computeXirr, parseDate } from '../helpers/financial-math';

const FD_RATE = 0.07; // 7% annual
const QUARTERLY_RATE = Math.pow(1 + FD_RATE, 0.25) - 1; // quarterly compounding
const TDS_RATE = 0.30;
const TDS_EXEMPTION = 40000; // annual interest exemption

export function computeFDvsMF(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    const cashflows = buildPortfolioCashflows(data);
    if (cashflows.length === 0) return null;

    // Separate outflows (investments) from inflows (redemptions)
    const investments = cashflows
        .filter(([, amt]) => amt < 0)
        .map(([date, amt]) => ({ date, amount: Math.abs(amt) }))
        .sort((a, b) => a.date.getTime() - b.date.getTime());

    if (investments.length === 0) return null;

    const asOfDate = parseDate(analysis.asOfDate);

    // Simulate FD: each investment earns compound interest from its date to asOfDate
    let totalFDValue = 0;
    let totalInvested = 0;
    let totalInterestEarned = 0;

    for (const inv of investments) {
        const yearsHeld = (asOfDate.getTime() - inv.date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
        if (yearsHeld <= 0) continue;

        const quarters = Math.floor(yearsHeld * 4);
        const remainingFraction = yearsHeld * 4 - quarters;

        // Quarterly compounding
        let fdValue = inv.amount * Math.pow(1 + QUARTERLY_RATE, quarters);
        // Partial quarter
        fdValue *= (1 + QUARTERLY_RATE * remainingFraction);

        const interestEarned = fdValue - inv.amount;
        totalFDValue += fdValue;
        totalInvested += inv.amount;
        totalInterestEarned += interestEarned;
    }

    // Apply TDS: 30% on annual interest above ₹40,000
    const years = (asOfDate.getTime() - investments[0].date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
    const avgAnnualInterest = years > 0 ? totalInterestEarned / years : 0;
    let totalTDS = 0;
    if (avgAnnualInterest > TDS_EXEMPTION) {
        const taxablePerYear = avgAnnualInterest - TDS_EXEMPTION;
        totalTDS = taxablePerYear * TDS_RATE * years;
    }

    const fdValueAfterTDS = totalFDValue - totalTDS;

    // Actual MF value: current market value + any redemptions received
    const totalRedemptions = cashflows
        .filter(([, amt]) => amt > 0)
        .reduce((s, [, amt]) => s + amt, 0);
    const actualValue = analysis.portfolioSummary.totalMarketValue + totalRedemptions;

    // Compute FD XIRR using same cashflows but FD terminal value
    const fdCashflows: [Date, number][] = investments.map((inv) => [inv.date, -inv.amount]);
    fdCashflows.push([asOfDate, fdValueAfterTDS]);
    const fdXirr = computeXirr(fdCashflows) * 100;

    const difference = actualValue - fdValueAfterTDS;
    const userDidBetter = difference > 0;

    return {
        id: 'FD_VS_MF',
        name: 'FD vs Mutual Funds',
        description: 'What if you had put all your money in a bank FD at 7% instead?',
        relevanceScore: 90, // always highly relevant

        actual: {
            totalInvested,
            currentValue: Math.round(actualValue),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested,
            hypotheticalValue: Math.round(fdValueAfterTDS),
            hypotheticalXirr: isNaN(fdXirr) ? FD_RATE * 100 : Math.round(fdXirr * 100) / 100,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: totalInvested > 0
                ? Math.round((difference / totalInvested) * 10000) / 100
                : 0,
            userDidBetter,
        },

        dataPointsForNarrative: {
            fdRate: '7%',
            fdValueBeforeTDS: Math.round(totalFDValue),
            tdsDeducted: Math.round(totalTDS),
            fdValueAfterTDS: Math.round(fdValueAfterTDS),
            mfValue: Math.round(actualValue),
            mfXirr: analysis.xirrAnalysis.portfolioXIRR,
            totalInvested: Math.round(totalInvested),
            holdingYears: Math.round(years * 10) / 10,
            mfBeatFDBy: Math.round(difference),
            framing: userDidBetter
                ? `Your mutual funds earned ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} more than an FD would have`
                : `A bank FD would have earned ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} more than your mutual funds`,
        },
    };
}
