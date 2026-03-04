/**
 * Direct vs Regular plan scenario.
 *
 * Estimates the compound cost of Regular plan commissions using
 * industry-average TER spreads. Works even without fund metadata.
 *
 * For Direct holders: frames as "you saved ₹X"
 * For Regular holders: frames as "you're paying ₹X in hidden commissions"
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { parseDate, daysBetween } from '../helpers/financial-math';

// Industry-average TER spreads (Regular - Direct)
const EQUITY_TER_SPREAD = 0.008; // 0.8% for equity funds
const DEBT_TER_SPREAD = 0.003; // 0.3% for debt/liquid funds
const INDEX_TER_SPREAD = 0.003; // 0.3% for index funds (lower commission)
const GOLD_TER_SPREAD = 0.004; // 0.4% for gold funds

function getTERSpread(schemeName: string): number {
    const name = schemeName.toLowerCase();
    if (name.includes('index') || name.includes('nifty') || name.includes('sensex')) return INDEX_TER_SPREAD;
    if (name.includes('gold') || name.includes('silver') || name.includes('commodit')) return GOLD_TER_SPREAD;
    if (name.includes('liquid') || name.includes('overnight') || name.includes('money market') || name.includes('debt')) return DEBT_TER_SPREAD;
    return EQUITY_TER_SPREAD; // default for equity funds
}

export function computeDirectVsRegular(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): WhatIfScenario | null {
    const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0);
    if (activeFolios.length === 0) return null;

    const regularFolios = activeFolios.filter((f) => f.scheme.plan === 'Regular');
    const directFolios = activeFolios.filter((f) => f.scheme.plan === 'Direct');

    const isMainlyRegular = regularFolios.length > directFolios.length;

    let totalActualMV = 0;
    let totalHypotheticalMV = 0;
    let totalAnnualSavings = 0;
    const schemeDetails: { scheme: string; plan: string; mv: number; spread: number; annualCost: number; lifetimeCost: number; holdingYears: number }[] = [];

    for (const folio of activeFolios) {
        const mv = folio.snapshot.marketValue;
        if (mv <= 0) continue;

        totalActualMV += mv;

        const spread = getTERSpread(folio.scheme.current_name);
        const annualCost = mv * spread;

        // Compute holding period for compound effect
        const firstTx = folio.transactions[0];
        const holdingYears = firstTx
            ? daysBetween(parseDate(firstTx.date), new Date()) / 365.2425
            : 1;

        if (folio.scheme.plan === 'Regular') {
            // Regular plan: estimate what the value WOULD have been with Direct
            // The TER spread compounds: hypothetical = actual * (1 + spread)^years
            const hypotheticalMV = mv * Math.pow(1 + spread, holdingYears);
            const lifetimeCost = hypotheticalMV - mv;
            totalHypotheticalMV += hypotheticalMV;
            totalAnnualSavings += annualCost;

            schemeDetails.push({
                scheme: folio.scheme.current_name,
                plan: 'Regular',
                mv: Math.round(mv),
                spread: Math.round(spread * 10000) / 100, // as %
                annualCost: Math.round(annualCost),
                lifetimeCost: Math.round(lifetimeCost),
                holdingYears: Math.round(holdingYears * 10) / 10,
            });
        } else {
            // Direct plan: estimate what value WOULD have been with Regular (less)
            const hypotheticalMV = mv / Math.pow(1 + spread, holdingYears);
            const lifetimeSaved = mv - hypotheticalMV;
            totalHypotheticalMV += mv; // Direct plans are already optimal
            totalAnnualSavings += 0; // no savings needed

            schemeDetails.push({
                scheme: folio.scheme.current_name,
                plan: 'Direct',
                mv: Math.round(mv),
                spread: Math.round(spread * 10000) / 100,
                annualCost: 0,
                lifetimeCost: -Math.round(lifetimeSaved), // negative = saved
                holdingYears: Math.round(holdingYears * 10) / 10,
            });
        }
    }

    if (totalActualMV <= 0) return null;

    // Calculate total lifetime commission paid/saved
    const totalLifetimeCost = schemeDetails
        .filter((s) => s.plan === 'Regular')
        .reduce((sum, s) => sum + s.lifetimeCost, 0);
    const totalLifetimeSaved = schemeDetails
        .filter((s) => s.plan === 'Direct')
        .reduce((sum, s) => sum + Math.abs(s.lifetimeCost), 0);

    const difference = isMainlyRegular ? totalLifetimeCost : totalLifetimeSaved;

    // For "you could save" framing: project 10-year impact
    const regularMV = regularFolios.reduce((s, f) => s + f.snapshot.marketValue, 0);
    const avgSpread = regularMV > 0
        ? regularFolios.reduce((s, f) => s + getTERSpread(f.scheme.current_name) * f.snapshot.marketValue, 0) / regularMV
        : EQUITY_TER_SPREAD;
    const tenYearImpact = regularMV * (Math.pow(1 + avgSpread, 10) - 1);

    return {
        id: 'DIRECT_VS_REGULAR',
        name: isMainlyRegular ? 'Hidden Commission Cost' : 'Smart Choice: Direct Plans',
        description: isMainlyRegular
            ? 'How much are you paying in distributor commissions through Regular plans?'
            : 'How much have you saved by choosing Direct plans?',
        relevanceScore: isMainlyRegular ? 95 : 70, // high urgency for Regular holders

        actual: {
            totalInvested: Math.round(analysis.portfolioSummary.totalInvested),
            currentValue: Math.round(totalActualMV),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(analysis.portfolioSummary.totalInvested),
            hypotheticalValue: Math.round(isMainlyRegular ? totalActualMV + totalLifetimeCost : totalActualMV),
            hypotheticalXirr: 0, // not easily computed without NAV history
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: totalActualMV > 0
                ? Math.round((difference / totalActualMV) * 10000) / 100
                : 0,
            userDidBetter: !isMainlyRegular,
        },

        dataPointsForNarrative: {
            regularCount: regularFolios.length,
            directCount: directFolios.length,
            totalActive: activeFolios.length,
            regularMV: Math.round(regularMV),
            totalLifetimeCommission: Math.round(totalLifetimeCost),
            totalLifetimeSaved: Math.round(totalLifetimeSaved),
            annualCommission: Math.round(totalAnnualSavings),
            tenYearProjectedCost: Math.round(tenYearImpact),
            avgSpreadPct: Math.round(avgSpread * 10000) / 100,
            topCostScheme: schemeDetails
                .filter((s) => s.plan === 'Regular')
                .sort((a, b) => b.lifetimeCost - a.lifetimeCost)[0]?.scheme || 'N/A',
            framing: isMainlyRegular
                ? `You've paid an estimated ₹${Math.round(totalLifetimeCost).toLocaleString('en-IN')} in hidden commissions. Over the next 10 years, Regular plans will cost you ₹${Math.round(tenYearImpact).toLocaleString('en-IN')} more.`
                : `By choosing Direct plans, you've saved approximately ₹${Math.round(totalLifetimeSaved).toLocaleString('en-IN')} in distributor commissions.`,
        },
    };
}
