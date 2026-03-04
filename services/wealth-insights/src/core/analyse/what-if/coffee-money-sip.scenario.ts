/**
 * Coffee Money SIP scenario.
 *
 * "What if your daily Rs 200 coffee money was a SIP?"
 * Computes the FV of a monthly SIP at the user's portfolio XIRR
 * from their first investment date to today.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { parseDate } from '../helpers/financial-math';

const DAILY_COFFEE = 200;
const MONTHLY_SIP = DAILY_COFFEE * 30; // Rs 6,000/month

export function computeCoffeeMoneySIP(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    const portfolioXIRR = analysis.xirrAnalysis.portfolioXIRR;
    if (!portfolioXIRR || isNaN(portfolioXIRR) || portfolioXIRR <= 0) return null;

    // Find earliest transaction date across all folios
    let earliestDate: Date | null = null;
    for (const folio of data.folios) {
        for (const tx of folio.transactions) {
            if (tx.amount === null || tx.amount <= 0) continue;
            const d = parseDate(tx.date);
            if (!earliestDate || d < earliestDate) earliestDate = d;
        }
    }
    if (!earliestDate) return null;

    const asOfDate = parseDate(analysis.asOfDate);
    const monthsInvested = Math.max(
        1,
        (asOfDate.getFullYear() - earliestDate.getFullYear()) * 12 +
            (asOfDate.getMonth() - earliestDate.getMonth()),
    );

    // FV of annuity: P * ((1+r)^n - 1) / r
    const monthlyRate = Math.pow(1 + portfolioXIRR / 100, 1 / 12) - 1;
    const fvFactor = (Math.pow(1 + monthlyRate, monthsInvested) - 1) / monthlyRate;
    const hypotheticalValue = Math.round(MONTHLY_SIP * fvFactor);

    const totalDays = Math.round(
        (asOfDate.getTime() - earliestDate.getTime()) / (24 * 60 * 60 * 1000),
    );
    const totalCoffeeSpend = DAILY_COFFEE * totalDays;
    const difference = hypotheticalValue - totalCoffeeSpend;

    return {
        id: 'COFFEE_MONEY_SIP',
        name: 'Coffee Money SIP',
        description: `What if your daily ₹${DAILY_COFFEE} coffee money was a SIP instead?`,
        relevanceScore: 85,

        actual: {
            totalInvested: totalCoffeeSpend,
            currentValue: totalCoffeeSpend, // coffee is consumed, worth 0
            xirr: 0,
        },

        hypothetical: {
            totalInvested: MONTHLY_SIP * monthsInvested,
            hypotheticalValue,
            hypotheticalXirr: portfolioXIRR,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference:
                totalCoffeeSpend > 0
                    ? Math.round((difference / totalCoffeeSpend) * 10000) / 100
                    : 0,
            userDidBetter: false, // coffee always loses
        },

        dataPointsForNarrative: {
            dailyCoffee: DAILY_COFFEE,
            monthlySIP: MONTHLY_SIP,
            monthsInvested,
            totalCoffeeSpend,
            hypotheticalValue,
            portfolioXIRR,
            framing: `Your daily ₹${DAILY_COFFEE} coffee over ${Math.round(totalDays / 365 * 10) / 10} years could have grown to ₹${hypotheticalValue.toLocaleString('en-IN')} as a SIP`,
        },
    };
}
