/**
 * Crorepati Countdown scenario.
 *
 * "When will you hit Rs 1 Crore?"
 * Finds the next milestone the user hasn't crossed and projects
 * when they'll reach it using current value + SIP run-rate at portfolio XIRR.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { solveMonthsToTarget } from '@/core/analyse/helpers/financial-math';

const MILESTONES = [
    { value: 10_00_000, label: '₹10 Lakh' },
    { value: 25_00_000, label: '₹25 Lakh' },
    { value: 50_00_000, label: '₹50 Lakh' },
    { value: 1_00_00_000, label: '₹1 Crore' },
    { value: 2_00_00_000, label: '₹2 Crore' },
    { value: 5_00_00_000, label: '₹5 Crore' },
];

export function computeCrorepatiCountdown(
    _data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    const currentValue = analysis.portfolioSummary.totalMarketValue;
    const portfolioXIRR = analysis.xirrAnalysis.portfolioXIRR;
    if (!portfolioXIRR || isNaN(portfolioXIRR) || portfolioXIRR <= 0) return null;
    if (currentValue <= 0) return null;

    // Skip if already above the highest milestone
    if (currentValue >= MILESTONES[MILESTONES.length - 1].value) return null;

    // Find next milestone
    const target = MILESTONES.find((m) => m.value > currentValue);
    if (!target) return null;

    // Compute monthly SIP run-rate from SIP analysis
    let monthlySIP = 0;
    if (analysis.sipAnalysis && !analysis.sipAnalysis.isLumpsumOnly) {
        for (const scheme of analysis.sipAnalysis.sipSchemes) {
            if (scheme.sipFrequency === 'Monthly') {
                monthlySIP += scheme.sipAmount;
            } else if (scheme.sipFrequency === 'Weekly') {
                monthlySIP += scheme.sipAmount * 4;
            } else if (scheme.sipFrequency === 'Quarterly') {
                monthlySIP += scheme.sipAmount / 3;
            }
        }
    }

    const monthlyRate = Math.pow(1 + portfolioXIRR / 100, 1 / 12) - 1;

    let monthsToTarget: number;
    if (monthlySIP > 0) {
        // FV = PV*(1+r)^n + SIP*((1+r)^n - 1)/r = target
        // Solve numerically since closed-form is complex with both PV and SIP
        monthsToTarget = solveMonthsToTarget(currentValue, monthlySIP, monthlyRate, target.value);
    } else {
        // Pure compounding: target = currentValue * (1+r)^n
        monthsToTarget = Math.log(target.value / currentValue) / Math.log(1 + monthlyRate);
    }

    if (!isFinite(monthsToTarget) || monthsToTarget <= 0 || monthsToTarget > 600) return null; // cap at 50 years

    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(monthsToTarget));

    const gap = target.value - currentValue;
    const yearsToTarget = Math.round(monthsToTarget / 12 * 10) / 10;

    return {
        id: 'CROREPATI_COUNTDOWN',
        name: `${target.label} Countdown`,
        description: `When will you hit ${target.label}?`,
        relevanceScore: 90,

        actual: {
            totalInvested: analysis.portfolioSummary.totalCostValue,
            currentValue: Math.round(currentValue),
            xirr: portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(monthlySIP * Math.ceil(monthsToTarget)),
            hypotheticalValue: target.value,
            hypotheticalXirr: portfolioXIRR,
        },

        difference: {
            absoluteAmount: Math.round(gap),
            percentageDifference: Math.round((gap / currentValue) * 10000) / 100,
            userDidBetter: false,
        },

        dataPointsForNarrative: {
            milestone: target.label,
            milestoneValue: target.value,
            currentValue: Math.round(currentValue),
            monthlySIP: Math.round(monthlySIP),
            monthsRemaining: Math.ceil(monthsToTarget),
            yearsRemaining: yearsToTarget,
            projectedDate: projectedDate.toISOString().slice(0, 10),
            projectedYear: projectedDate.getFullYear(),
            portfolioXIRR,
            framing: monthlySIP > 0
                ? `At your current pace (₹${Math.round(monthlySIP).toLocaleString('en-IN')}/mo SIP + ${portfolioXIRR.toFixed(1)}% returns), you'll hit ${target.label} by ${projectedDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} — ${Math.ceil(monthsToTarget) < 12 ? `${Math.ceil(monthsToTarget)} month${Math.ceil(monthsToTarget) === 1 ? '' : 's'}` : `${yearsToTarget} years`} away`
                : `At ${portfolioXIRR.toFixed(1)}% returns, your portfolio will reach ${target.label} in ${Math.ceil(monthsToTarget) < 12 ? `~${Math.ceil(monthsToTarget)} month${Math.ceil(monthsToTarget) === 1 ? '' : 's'}` : `~${yearsToTarget} years`}`,
        },
    };
}

