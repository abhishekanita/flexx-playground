/**
 * Asset allocation analyser.
 * Computes the Equity / Debt / Others split from fund holdings data.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import {
    AssetAllocationResult,
    AssetClassAllocation,
    AssetClass,
} from '@/types/analysis';
import { FundHoldingsSource } from '@/types/analysis/enrichment.type';

export class AssetAllocationAnalyser {
    /**
     * Compute asset allocation from underlying fund holdings.
     */
    static analyse(
        data: MFDetailedStatementData,
        holdingsLookup: Map<string, FundHoldingsSource>,
    ): AssetAllocationResult {
        const totalMV = data.totalMarketValue;
        let equityMV = 0;
        let debtMV = 0;
        let othersMV = 0;
        let unmappedMV = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const schemeMV = folio.snapshot.marketValue;
            const holdings = holdingsLookup.get(folio.scheme.isin);

            if (!holdings) {
                // No holdings data - classify based on scheme name/category
                const assetClass = this.inferAssetClass(folio.scheme.current_name);
                if (assetClass === 'Equity') equityMV += schemeMV;
                else if (assetClass === 'Debt') debtMV += schemeMV;
                else othersMV += schemeMV;
                unmappedMV += schemeMV;
                continue;
            }

            // Use asset totals from holdings disclosure
            const { equity, debt, others } = holdings.assetTotals;
            equityMV += schemeMV * (equity / 100);
            debtMV += schemeMV * (debt / 100);
            othersMV += schemeMV * (others / 100);

            // If totals don't add to 100%, put remainder in others
            const totalPct = equity + debt + others;
            if (totalPct < 95) {
                // Significant gap - add remainder to others
                othersMV += schemeMV * ((100 - totalPct) / 100);
            }
        }

        const overall: AssetClassAllocation[] = [
            {
                assetClass: 'Equity' as AssetClass,
                marketValue: Math.round(equityMV * 100) / 100,
                weight: totalMV > 0 ? Math.round((equityMV / totalMV) * 10000) / 100 : 0,
            },
            {
                assetClass: 'Debt' as AssetClass,
                marketValue: Math.round(debtMV * 100) / 100,
                weight: totalMV > 0 ? Math.round((debtMV / totalMV) * 10000) / 100 : 0,
            },
            {
                assetClass: 'Others' as AssetClass,
                marketValue: Math.round(othersMV * 100) / 100,
                weight: totalMV > 0 ? Math.round((othersMV / totalMV) * 10000) / 100 : 0,
            },
        ].filter((a) => a.marketValue > 0);

        return {
            overall,
            equityTotalMV: Math.round(equityMV * 100) / 100,
        };
    }

    /**
     * Infer asset class from scheme name when holdings data is unavailable.
     */
    private static inferAssetClass(schemeName: string): AssetClass {
        const lower = schemeName.toLowerCase();

        // Debt indicators
        if (
            lower.includes('liquid') ||
            lower.includes('debt') ||
            lower.includes('money market') ||
            lower.includes('overnight') ||
            lower.includes('gilt') ||
            lower.includes('corporate bond') ||
            lower.includes('banking & psu') ||
            lower.includes('short duration') ||
            lower.includes('ultra short') ||
            lower.includes('low duration') ||
            lower.includes('medium duration') ||
            lower.includes('long duration') ||
            lower.includes('dynamic bond') ||
            lower.includes('credit risk') ||
            lower.includes('floater')
        ) {
            return 'Debt';
        }

        // Others indicators
        if (
            lower.includes('gold') ||
            lower.includes('silver') ||
            lower.includes('commodity') ||
            lower.includes('real estate') ||
            lower.includes('reit') ||
            lower.includes('invit')
        ) {
            return 'Others';
        }

        // Default to equity
        return 'Equity';
    }
}
