/**
 * Sector analyser.
 * Maps underlying fund holdings to 11 broad sectors.
 * Computes portfolio-weighted sector allocation.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import {
    SectorAnalysisResult,
    SectorAllocation,
    SchemeSectorBreakdown,
} from '@/types/analysis';
import { FundHoldingsSource } from '@/types/analysis/enrichment.type';
import { classifySector, BroadSector, getAllSectors } from '../helpers/sector-classifier';

export class SectorAnalyser {
    /**
     * Analyse sector allocation across the portfolio.
     *
     * @param data - Parsed statement data
     * @param holdingsMap - Holdings data keyed by source key
     * @param holdingsLookup - Map from folio scheme name to matched holdings source
     */
    static analyse(
        data: MFDetailedStatementData,
        holdingsLookup: Map<string, FundHoldingsSource>,
    ): SectorAnalysisResult {
        const totalMV = data.totalMarketValue;
        const sectorMV: Record<string, number> = {};
        const detailedSectorMV: Record<string, number> = {};
        const breakdowns: SchemeSectorBreakdown[] = [];

        // Total equity MV across all mapped schemes
        let totalEquityMV = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const holdings = holdingsLookup.get(folio.scheme.isin);
            if (!holdings) continue;

            const schemeMV = folio.snapshot.marketValue;
            const equityHoldings = holdings.holdings.filter((h) => h.section === 'equity');
            const schemeEquityPct = holdings.assetTotals.equity / 100;
            const schemeEquityMV = schemeMV * schemeEquityPct;
            totalEquityMV += schemeEquityMV;

            for (const holding of equityHoldings) {
                const sector = classifySector(holding.industry);
                const weightedMV = schemeMV * (holding.pctOfNAV / 100);

                // Broad sector aggregation
                sectorMV[sector] = (sectorMV[sector] || 0) + weightedMV;

                // Detailed industry tracking
                const detailedKey = holding.industry || 'Unknown';
                detailedSectorMV[detailedKey] = (detailedSectorMV[detailedKey] || 0) + weightedMV;

                // Per-scheme breakdown
                breakdowns.push({
                    fundHouse: folio.fundHouse,
                    schemeName: folio.scheme.current_name,
                    sector,
                    weightedMV,
                    schemeEquityWeight: schemeEquityMV > 0
                        ? (weightedMV / schemeEquityMV) * 100
                        : 0,
                    portfolioWeight: totalMV > 0 ? (weightedMV / totalMV) * 100 : 0,
                });
            }
        }

        // Build broad sector allocations
        const broadSectors: SectorAllocation[] = getAllSectors()
            .map((sector) => ({
                sector,
                weightedMV: sectorMV[sector] || 0,
                portfolioWeight: totalMV > 0 ? ((sectorMV[sector] || 0) / totalMV) * 100 : 0,
                equityWeight: totalEquityMV > 0 ? ((sectorMV[sector] || 0) / totalEquityMV) * 100 : 0,
            }))
            .filter((s) => s.weightedMV > 0)
            .sort((a, b) => b.weightedMV - a.weightedMV);

        // Build detailed sector allocations
        const detailedSectors: SectorAllocation[] = Object.entries(detailedSectorMV)
            .map(([sector, mv]) => ({
                sector,
                weightedMV: mv,
                portfolioWeight: totalMV > 0 ? (mv / totalMV) * 100 : 0,
                equityWeight: totalEquityMV > 0 ? (mv / totalEquityMV) * 100 : 0,
            }))
            .sort((a, b) => b.weightedMV - a.weightedMV);

        return {
            broadSectors,
            detailedSectors,
            schemeSectorBreakdown: breakdowns.sort((a, b) => b.weightedMV - a.weightedMV),
        };
    }
}
