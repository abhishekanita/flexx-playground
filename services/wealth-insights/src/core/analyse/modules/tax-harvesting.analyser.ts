/**
 * Tax Harvesting Analyser — FIFO lot-level tax analysis.
 *
 * Algorithm:
 *   1. For each active folio, build lot queue from purchase txns (date, units, costPerUnit)
 *   2. Process redemptions FIFO: consume oldest lots first
 *   3. Remaining lots = current holdings with original purchase dates
 *   4. Classify each lot: holdingDays >= 365 → LTCG, else STCG
 *   5. Compute unrealised gain per lot: (currentNAV × units) - (costPerUnit × units)
 *   6. Tax rates: LTCG 12.5%, STCG 20%, LTCG exemption ₹1.25L/year
 *   7. Aggregate per folio
 *   8. daysToLTCG: days until oldest STCG lot crosses 365-day mark
 *   9. harvestable: true if lot has positive gain
 *
 * Edge cases:
 *   - Bonus/Merger units → zero-cost lots
 *   - Switch In → treated as purchase
 *   - Dividend Reinvestment → new purchase lot at reinvestment NAV
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { TaxHarvestingResult, TaxHarvestOpportunity } from '@/types/analysis';
import { parseDate, daysBetween } from '../helpers/financial-math';

type Folio = MFDetailedStatementData['folios'][number];

const PURCHASE_TYPES = new Set([
    'Purchase', 'SIP', 'Switch In', 'STP In', 'NFO Allotment', 'Dividend Reinvestment',
]);
const ZERO_COST_TYPES = new Set(['Bonus', 'Merger']);
const REDEMPTION_TYPES = new Set([
    'Redemption', 'SIP Redemption', 'SWP', 'Switch Out', 'STP Out',
]);

// FY 2024-25 tax rates for equity MF
const LTCG_RATE = 0.125;   // 12.5%
const STCG_RATE = 0.20;    // 20%
const LTCG_EXEMPTION = 125000; // ₹1.25L per FY
const LTCG_THRESHOLD_DAYS = 365;

interface Lot {
    date: Date;
    units: number;
    costPerUnit: number;
}

export class TaxHarvestingAnalyser {
    static analyse(
        data: MFDetailedStatementData,
        asOfDate: string,
    ): TaxHarvestingResult {
        const asOf = parseDate(asOfDate);
        const opportunities: TaxHarvestOpportunity[] = [];
        let totalSTCG = 0;
        let totalLTCG = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const result = this.analyseFolio(folio, asOf);
            if (result) {
                opportunities.push(result);
                if (result.holdingPeriod === 'STCG') {
                    totalSTCG += result.unrealisedGain;
                } else {
                    totalLTCG += result.unrealisedGain;
                }
            }
        }

        // Compute exemption usage
        const positiveLTCG = Math.max(0, totalLTCG);
        const ltcgExemptionUsed = Math.min(positiveLTCG, LTCG_EXEMPTION);
        const ltcgExemptionRemaining = Math.max(0, LTCG_EXEMPTION - ltcgExemptionUsed);

        // Estimate tax
        const taxableLTCG = Math.max(0, positiveLTCG - LTCG_EXEMPTION);
        const taxableSTCG = Math.max(0, totalSTCG);
        const totalEstimatedTax = taxableLTCG * LTCG_RATE + taxableSTCG * STCG_RATE;

        return {
            opportunities,
            totalSTCG: Math.round(totalSTCG),
            totalLTCG: Math.round(totalLTCG),
            ltcgExemptionUsed: Math.round(ltcgExemptionUsed),
            ltcgExemptionRemaining: Math.round(ltcgExemptionRemaining),
            totalEstimatedTax: Math.round(totalEstimatedTax),
        };
    }

    private static analyseFolio(folio: Folio, asOf: Date): TaxHarvestOpportunity | null {
        const lots = this.buildRemainingLots(folio);
        if (lots.length === 0) return null;

        const currentNAV = folio.snapshot.nav;
        if (currentNAV <= 0) return null;

        let stcgGain = 0;
        let ltcgGain = 0;
        let stcgUnits = 0;
        let ltcgUnits = 0;
        let earliestSTCGDate: Date | null = null;

        for (const lot of lots) {
            const holdingDays = daysBetween(lot.date, asOf);
            const lotGain = (currentNAV - lot.costPerUnit) * lot.units;

            if (holdingDays > LTCG_THRESHOLD_DAYS) {
                ltcgGain += lotGain;
                ltcgUnits += lot.units;
            } else {
                stcgGain += lotGain;
                stcgUnits += lot.units;
                if (!earliestSTCGDate || lot.date < earliestSTCGDate) {
                    earliestSTCGDate = lot.date;
                }
            }
        }

        const totalUnrealisedGain = stcgGain + ltcgGain;

        // Determine dominant holding period
        const dominantPeriod: 'STCG' | 'LTCG' = stcgUnits > ltcgUnits ? 'STCG' : 'LTCG';

        // Days until oldest STCG lot becomes LTCG
        let daysToLTCG: number | null = null;
        if (earliestSTCGDate) {
            const holdingDays = daysBetween(earliestSTCGDate, asOf);
            daysToLTCG = Math.max(0, LTCG_THRESHOLD_DAYS + 1 - holdingDays);
        }

        // Estimate tax for this folio
        const estimatedTax =
            Math.max(0, stcgGain) * STCG_RATE +
            Math.max(0, ltcgGain) * LTCG_RATE;

        return {
            schemeName: folio.scheme.current_name,
            folioNumber: folio.folioNumber,
            unrealisedGain: Math.round(totalUnrealisedGain),
            holdingPeriod: dominantPeriod,
            estimatedTax: Math.round(estimatedTax),
            harvestable: totalUnrealisedGain > 0,
            daysToLTCG,
        };
    }

    /**
     * Build remaining lots after FIFO redemption processing.
     */
    private static buildRemainingLots(folio: Folio): Lot[] {
        const lots: Lot[] = [];

        // Sort transactions chronologically
        const sortedTxns = [...folio.transactions].sort((a, b) => a.date.localeCompare(b.date));

        for (const tx of sortedTxns) {
            if (PURCHASE_TYPES.has(tx.type)) {
                const units = Math.abs(tx.units);
                if (units <= 0) continue;

                const costPerUnit = tx.amount !== null && tx.amount > 0
                    ? Math.abs(tx.amount) / units
                    : (tx.nav ?? 0);

                lots.push({
                    date: parseDate(tx.date),
                    units,
                    costPerUnit,
                });
            } else if (ZERO_COST_TYPES.has(tx.type)) {
                const units = Math.abs(tx.units);
                if (units > 0) {
                    lots.push({
                        date: parseDate(tx.date),
                        units,
                        costPerUnit: 0,
                    });
                }
            } else if (REDEMPTION_TYPES.has(tx.type)) {
                // FIFO: consume oldest lots first
                let unitsToRedeem = Math.abs(tx.units);

                for (let i = 0; i < lots.length && unitsToRedeem > 0; i++) {
                    if (lots[i].units <= 0) continue;

                    if (lots[i].units <= unitsToRedeem) {
                        unitsToRedeem -= lots[i].units;
                        lots[i].units = 0;
                    } else {
                        lots[i].units -= unitsToRedeem;
                        unitsToRedeem = 0;
                    }
                }
            }
        }

        // Filter out fully consumed lots
        return lots.filter((lot) => lot.units > 0.001);
    }
}
