/**
 * SIP vs Lumpsum scenario.
 *
 * Finds lumpsum transactions (Purchase > ₹10k, not SIP-like) and hypothetically
 * splits each into 6 monthly SIPs. Uses NAV history to compute what the
 * hypothetical SIP units would have been worth.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { AMFIMasterProvider } from '../enrichment/amfi-master.provider';
import { NAVProvider } from '../enrichment/nav.provider';
import { parseDate, daysBetween } from '../helpers/financial-math';

const MIN_LUMPSUM_AMOUNT = 10000;
const SIP_SPLIT_MONTHS = 6;

export async function computeSIPvsLumpsum(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
    amfiMaster: AMFIMasterProvider,
    navProvider: NAVProvider,
): Promise<WhatIfScenario | null> {
    const asOfDate = parseDate(analysis.asOfDate);

    // Find lumpsum-like purchases (single large purchases, not part of SIP pattern)
    const lumpsumTxns: { folio: typeof data.folios[number]; amount: number; date: Date; nav: number }[] = [];

    for (const folio of data.folios) {
        if (folio.closingUnitBalance <= 0) continue;

        const purchases = folio.transactions.filter(
            (tx) => tx.type === 'Purchase' && tx.amount !== null && tx.amount > MIN_LUMPSUM_AMOUNT,
        );

        for (const tx of purchases) {
            lumpsumTxns.push({
                folio,
                amount: tx.amount!,
                date: parseDate(tx.date),
                nav: tx.nav ?? 0,
            });
        }
    }

    if (lumpsumTxns.length === 0) return null;

    let totalActualValue = 0;
    let totalHypotheticalValue = 0;
    let totalInvested = 0;

    for (const lump of lumpsumTxns) {
        if (lump.nav <= 0) continue;

        const schemeCode = amfiMaster.getSchemeCode(lump.folio.scheme.isin);
        if (!schemeCode) {
            // Fallback: approximate using current NAV growth
            totalActualValue += lump.amount;
            totalHypotheticalValue += lump.amount;
            totalInvested += lump.amount;
            continue;
        }

        const history = await navProvider.fetchNAVHistory(schemeCode);
        if (!history || history.navHistory.length < 30) {
            totalActualValue += lump.amount;
            totalHypotheticalValue += lump.amount;
            totalInvested += lump.amount;
            continue;
        }

        // Build date→NAV lookup
        const navMap = new Map<string, number>();
        for (const point of history.navHistory) {
            navMap.set(NAVProvider.toISO(point.date), point.nav);
        }

        // Actual: lumpsum bought at original NAV
        const actualUnits = lump.amount / lump.nav;
        const currentNAV = lump.folio.snapshot.nav;
        totalActualValue += actualUnits * currentNAV;

        // Hypothetical: split into SIP_SPLIT_MONTHS equal monthly installments
        const monthlyAmount = lump.amount / SIP_SPLIT_MONTHS;
        let hypotheticalUnits = 0;

        for (let m = 0; m < SIP_SPLIT_MONTHS; m++) {
            const sipDate = new Date(lump.date);
            sipDate.setMonth(sipDate.getMonth() + m);
            const sipDateStr = sipDate.toISOString().slice(0, 10);

            // Find closest available NAV
            const navOnDate = findClosestNAV(navMap, sipDateStr);
            if (navOnDate > 0) {
                hypotheticalUnits += monthlyAmount / navOnDate;
            }
        }

        totalHypotheticalValue += hypotheticalUnits * currentNAV;
        totalInvested += lump.amount;
    }

    if (totalInvested <= 0) return null;

    const difference = totalHypotheticalValue - totalActualValue;
    const sipBetter = difference > 0;

    return {
        id: 'SIP_VS_LUMPSUM',
        name: 'SIP vs Lumpsum',
        description: 'What if your lumpsum investments had been spread as monthly SIPs instead?',
        relevanceScore: lumpsumTxns.length >= 2 ? 75 : 55,

        actual: {
            totalInvested: Math.round(totalInvested),
            currentValue: Math.round(totalActualValue),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(totalInvested),
            hypotheticalValue: Math.round(totalHypotheticalValue),
            hypotheticalXirr: 0,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: totalInvested > 0
                ? Math.round((difference / totalInvested) * 10000) / 100
                : 0,
            userDidBetter: !sipBetter,
        },

        dataPointsForNarrative: {
            lumpsumCount: lumpsumTxns.length,
            totalLumpsumAmount: Math.round(totalInvested),
            sipMonths: SIP_SPLIT_MONTHS,
            actualValue: Math.round(totalActualValue),
            hypotheticalValue: Math.round(totalHypotheticalValue),
            framing: sipBetter
                ? `Spreading your ₹${Math.round(totalInvested).toLocaleString('en-IN')} across ${SIP_SPLIT_MONTHS}-month SIPs would have earned ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} more`
                : `Your lumpsum timing was good — SIPs would have earned ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} less`,
        },
    };
}

function findClosestNAV(navMap: Map<string, number>, targetDate: string): number {
    // Check exact date, then +/- 1,2,3 days
    for (let offset = 0; offset <= 3; offset++) {
        const d = new Date(targetDate);
        d.setDate(d.getDate() + offset);
        const nav = navMap.get(d.toISOString().slice(0, 10));
        if (nav) return nav;

        if (offset > 0) {
            const d2 = new Date(targetDate);
            d2.setDate(d2.getDate() - offset);
            const nav2 = navMap.get(d2.toISOString().slice(0, 10));
            if (nav2) return nav2;
        }
    }
    return 0;
}
