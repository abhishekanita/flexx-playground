/**
 * Started Earlier scenario.
 *
 * Shifts all user transactions back 12 months and replays them using
 * NAV history to compute what the portfolio would be worth if they
 * had started investing a year earlier.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { AMFIMasterProvider } from '../enrichment/amfi-master.provider';
import { NAVProvider } from '../enrichment/nav.provider';
import { parseDate } from '../helpers/financial-math';

const SHIFT_MONTHS = 12;

export async function computeStartedEarlier(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
    amfiMaster: AMFIMasterProvider,
    navProvider: NAVProvider,
): Promise<WhatIfScenario | null> {
    const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0);
    if (activeFolios.length === 0) return null;

    let totalActualValue = 0;
    let totalHypotheticalValue = 0;
    let totalInvested = 0;
    let schemesProcessed = 0;

    for (const folio of activeFolios) {
        const schemeCode = amfiMaster.getSchemeCode(folio.scheme.isin);
        if (!schemeCode) continue;

        const history = await navProvider.fetchNAVHistory(schemeCode);
        if (!history || history.navHistory.length < 60) continue;

        // Build date→NAV lookup
        const navMap = new Map<string, number>();
        for (const point of history.navHistory) {
            navMap.set(NAVProvider.toISO(point.date), point.nav);
        }

        const currentNAV = folio.snapshot.nav;
        let hypotheticalUnits = 0;
        let folioInvested = 0;

        const purchaseTxns = folio.transactions.filter(
            (tx) => ['Purchase', 'SIP', 'Switch In', 'STP In', 'NFO Allotment'].includes(tx.type)
                && tx.amount !== null && tx.amount > 0,
        );

        for (const tx of purchaseTxns) {
            const amount = tx.amount!;
            folioInvested += amount;

            // Shifted date: 12 months earlier
            const originalDate = parseDate(tx.date);
            const shiftedDate = new Date(originalDate);
            shiftedDate.setMonth(shiftedDate.getMonth() - SHIFT_MONTHS);
            const shiftedDateStr = shiftedDate.toISOString().slice(0, 10);

            const shiftedNAV = findClosestNAV(navMap, shiftedDateStr);
            if (shiftedNAV > 0) {
                hypotheticalUnits += amount / shiftedNAV;
            }
        }

        if (folioInvested > 0 && hypotheticalUnits > 0) {
            // Use real snapshot value (verifiable by user) instead of recalculating from purchases
            totalActualValue += folio.snapshot.marketValue;
            totalHypotheticalValue += hypotheticalUnits * currentNAV;
            totalInvested += folioInvested;
            schemesProcessed++;
        }
    }

    if (schemesProcessed === 0 || totalInvested <= 0) return null;

    const difference = totalHypotheticalValue - totalActualValue;

    return {
        id: 'STARTED_EARLIER',
        name: `Started ${SHIFT_MONTHS} Months Earlier`,
        description: `What if you had started investing ${SHIFT_MONTHS} months earlier with the same amounts?`,
        relevanceScore: 75,

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
            userDidBetter: difference < 0,
        },

        dataPointsForNarrative: {
            shiftMonths: SHIFT_MONTHS,
            schemesAnalysed: schemesProcessed,
            totalInvested: Math.round(totalInvested),
            actualValue: Math.round(totalActualValue),
            hypotheticalValue: Math.round(totalHypotheticalValue),
            gainDiff: Math.round(difference),
            framing: difference > 0
                ? `Starting ${SHIFT_MONTHS} months earlier would have given you ₹${Math.round(difference).toLocaleString('en-IN')} more — time in the market matters`
                : `Interestingly, starting ${SHIFT_MONTHS} months earlier wouldn't have helped — markets were higher then`,
        },
    };
}

function findClosestNAV(navMap: Map<string, number>, targetDate: string): number {
    for (let offset = 0; offset <= 5; offset++) {
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
