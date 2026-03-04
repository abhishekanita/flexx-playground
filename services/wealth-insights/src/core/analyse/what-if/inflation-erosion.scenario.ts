/**
 * Inflation Erosion scenario.
 *
 * "Your Rs X gain is really only Rs Y after inflation"
 * Applies 6% CPI inflation to show the real (inflation-adjusted) returns.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { buildPortfolioCashflows } from '../helpers/cashflow-builder';
import { parseDate } from '../helpers/financial-math';

const CPI_RATE = 0.06; // 6% annual inflation

export function computeInflationErosion(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    const cashflows = buildPortfolioCashflows(data);
    if (cashflows.length === 0) return null;

    const portfolioXIRR = analysis.xirrAnalysis.portfolioXIRR;
    if (!portfolioXIRR || isNaN(portfolioXIRR)) return null;

    const totalInvested = analysis.portfolioSummary.totalInvested;
    const marketValue = analysis.portfolioSummary.totalMarketValue;
    const nominalGain = marketValue - totalInvested;
    if (totalInvested <= 0) return null;

    // Find first investment date for holding period
    const investments = cashflows
        .filter(([, amt]) => amt < 0)
        .sort((a, b) => a[0].getTime() - b[0].getTime());
    if (investments.length === 0) return null;

    const asOfDate = parseDate(analysis.asOfDate);
    const firstDate = investments[0][0];
    const years = (asOfDate.getTime() - firstDate.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
    if (years <= 0.5) return null; // need at least 6 months for meaningful inflation impact

    // Real XIRR: (1 + nominal) / (1 + inflation) - 1
    const nominalRate = portfolioXIRR / 100;
    const realRate = (1 + nominalRate) / (1 + CPI_RATE) - 1;
    const realXIRR = realRate * 100;

    // Real gain: current market value in today's purchasing power minus invested
    const inflationFactor = Math.pow(1 + CPI_RATE, years);
    const realMarketValue = marketValue / inflationFactor;
    const realGain = realMarketValue - totalInvested;

    const erosion = nominalGain - realGain;

    return {
        id: 'INFLATION_EROSION',
        name: 'Inflation Reality Check',
        description: `Your ₹${Math.round(nominalGain).toLocaleString('en-IN')} gain is really only ₹${Math.round(realGain).toLocaleString('en-IN')} after inflation`,
        relevanceScore: 80,

        actual: {
            totalInvested: Math.round(totalInvested),
            currentValue: Math.round(marketValue),
            xirr: portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(totalInvested),
            hypotheticalValue: Math.round(realMarketValue),
            hypotheticalXirr: Math.round(realXIRR * 100) / 100,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(erosion)),
            percentageDifference:
                totalInvested > 0
                    ? Math.round((erosion / totalInvested) * 10000) / 100
                    : 0,
            userDidBetter: false, // inflation always erodes
        },

        dataPointsForNarrative: {
            nominalGain: Math.round(nominalGain),
            realGain: Math.round(realGain),
            erosion: Math.round(erosion),
            nominalXIRR: portfolioXIRR,
            realXIRR: Math.round(realXIRR * 100) / 100,
            inflationRate: CPI_RATE * 100,
            holdingYears: Math.round(years * 10) / 10,
            inflationFactor: Math.round(inflationFactor * 1000) / 1000,
            framing: realXIRR > 0
                ? `Inflation ate ₹${Math.round(erosion).toLocaleString('en-IN')} of your gains — your real return is ${realXIRR.toFixed(1)}% vs nominal ${portfolioXIRR.toFixed(1)}%`
                : `After ${CPI_RATE * 100}% inflation, your portfolio is actually losing purchasing power`,
        },
    };
}
