/**
 * Coverage analyser.
 * Tracks what % of portfolio market value has underlying holdings data mapped.
 * Useful for understanding data quality of enrichment-dependent analysis.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { CoverageResult } from '@/types/analysis';
import { FundHoldingsSource } from '@/types/analysis/enrichment.type';

export class CoverageAnalyser {
    /**
     * Compute holdings data coverage metrics.
     */
    static analyse(
        data: MFDetailedStatementData,
        holdingsLookup: Map<string, FundHoldingsSource>,
    ): CoverageResult {
        const totalMV = data.totalMarketValue;
        let coveredMV = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            if (holdingsLookup.has(folio.scheme.isin)) {
                coveredMV += folio.snapshot.marketValue;
            }
        }

        const unmappedMV = totalMV - coveredMV;

        return {
            holdingsCoverageMV: Math.round(coveredMV * 100) / 100,
            holdingsCoveragePct: totalMV > 0
                ? Math.round((coveredMV / totalMV) * 10000) / 100
                : 0,
            unmappedMV: Math.round(unmappedMV * 100) / 100,
            unmappedPct: totalMV > 0
                ? Math.round((unmappedMV / totalMV) * 10000) / 100
                : 0,
        };
    }
}
