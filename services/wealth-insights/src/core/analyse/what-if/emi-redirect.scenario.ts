/**
 * EMI Redirect scenario.
 *
 * "Your SIP amount invested for 10 more years = Rs X"
 * Projects the current monthly SIP run-rate forward 10 years at portfolio XIRR.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';

const PROJECTION_YEARS = 10;
const PROJECTION_MONTHS = PROJECTION_YEARS * 12;

export function computeEMIRedirect(
    _data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    if (!analysis.sipAnalysis || analysis.sipAnalysis.isLumpsumOnly) return null;

    const portfolioXIRR = analysis.xirrAnalysis.portfolioXIRR;
    if (!portfolioXIRR || isNaN(portfolioXIRR) || portfolioXIRR <= 0) return null;

    // Compute monthly SIP run-rate
    let monthlySIP = 0;
    for (const scheme of analysis.sipAnalysis.sipSchemes) {
        if (scheme.sipFrequency === 'Monthly') {
            monthlySIP += scheme.sipAmount;
        } else if (scheme.sipFrequency === 'Weekly') {
            monthlySIP += scheme.sipAmount * 4;
        } else if (scheme.sipFrequency === 'Quarterly') {
            monthlySIP += scheme.sipAmount / 3;
        }
    }

    if (monthlySIP <= 0) return null;

    // FV of annuity: SIP * ((1+r)^n - 1) / r
    const monthlyRate = Math.pow(1 + portfolioXIRR / 100, 1 / 12) - 1;
    const growthFactor = Math.pow(1 + monthlyRate, PROJECTION_MONTHS);
    const futureValue = Math.round(monthlySIP * (growthFactor - 1) / monthlyRate);

    const totalContributed = monthlySIP * PROJECTION_MONTHS;
    const pureGrowth = futureValue - totalContributed;

    return {
        id: 'EMI_REDIRECT',
        name: '10-Year SIP Projection',
        description: `Your ₹${Math.round(monthlySIP).toLocaleString('en-IN')}/mo SIP for 10 more years = ₹${futureValue.toLocaleString('en-IN')}`,
        relevanceScore: 70,

        actual: {
            totalInvested: Math.round(totalContributed),
            currentValue: Math.round(totalContributed), // base case: just saving without growth
            xirr: 0,
        },

        hypothetical: {
            totalInvested: Math.round(totalContributed),
            hypotheticalValue: futureValue,
            hypotheticalXirr: portfolioXIRR,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(pureGrowth)),
            percentageDifference:
                totalContributed > 0
                    ? Math.round((pureGrowth / totalContributed) * 10000) / 100
                    : 0,
            userDidBetter: false,
        },

        dataPointsForNarrative: {
            monthlySIP: Math.round(monthlySIP),
            projectionYears: PROJECTION_YEARS,
            totalContributed: Math.round(totalContributed),
            futureValue,
            pureGrowth: Math.round(pureGrowth),
            portfolioXIRR,
            growthMultiple: Math.round((futureValue / totalContributed) * 100) / 100,
            framing: `Keep your ₹${Math.round(monthlySIP).toLocaleString('en-IN')}/mo SIP going for 10 years and it grows to ₹${futureValue.toLocaleString('en-IN')} — that's ${Math.round((futureValue / totalContributed) * 10) / 10}x your money`,
        },
    };
}
