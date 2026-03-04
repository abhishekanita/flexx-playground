/**
 * Company exposure analyser.
 * Identifies top company exposures across all funds via underlying holdings.
 * Computes concentration risk metrics (top 5/10/20, Herfindahl).
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import {
    CompanyExposureResult,
    CompanyExposure,
    ConcentrationRisk,
} from '@/types/analysis';
import { FundHoldingsSource } from '@/types/analysis/enrichment.type';
import { normalizeCompany } from '../helpers/normalization';

export class CompanyExposureAnalyser {
    /**
     * Analyse company-level exposure across the portfolio.
     */
    static analyse(
        data: MFDetailedStatementData,
        holdingsLookup: Map<string, FundHoldingsSource>,
    ): CompanyExposureResult {
        const totalMV = data.totalMarketValue;

        // Aggregate by normalized company name
        const companyMap = new Map<
            string,
            { instrumentName: string; isin: string; totalMV: number }
        >();

        let equityMV = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const holdings = holdingsLookup.get(folio.scheme.isin);
            if (!holdings) continue;

            const schemeMV = folio.snapshot.marketValue;

            for (const holding of holdings.holdings) {
                if (holding.section !== 'equity') continue;
                if (holding.pctOfNAV <= 0) continue;

                const weightedMV = schemeMV * (holding.pctOfNAV / 100);
                equityMV += weightedMV;

                const key = normalizeCompany(holding.instrument);
                const existing = companyMap.get(key);
                if (existing) {
                    existing.totalMV += weightedMV;
                    // Keep the ISIN from the holding with the most exposure
                    if (!existing.isin && holding.isin) existing.isin = holding.isin;
                } else {
                    companyMap.set(key, {
                        instrumentName: holding.instrument,
                        isin: holding.isin,
                        totalMV: weightedMV,
                    });
                }
            }
        }

        // Build sorted company list
        const companies: CompanyExposure[] = [...companyMap.entries()]
            .map(([key, val]) => ({
                companyKey: key,
                instrumentName: val.instrumentName,
                isin: val.isin,
                weightedMV: Math.round(val.totalMV * 100) / 100,
                portfolioWeight: totalMV > 0
                    ? Math.round((val.totalMV / totalMV) * 10000) / 100
                    : 0,
                equityWeight: equityMV > 0
                    ? Math.round((val.totalMV / equityMV) * 10000) / 100
                    : 0,
            }))
            .sort((a, b) => b.weightedMV - a.weightedMV);

        // Concentration risk
        const weights = companies.map((c) => c.portfolioWeight);
        const concentrationRisk = this.computeConcentration(weights);

        return { companies, concentrationRisk };
    }

    private static computeConcentration(weights: number[]): ConcentrationRisk {
        const top5 = weights.slice(0, 5).reduce((s, w) => s + w, 0);
        const top10 = weights.slice(0, 10).reduce((s, w) => s + w, 0);
        const top20 = weights.slice(0, 20).reduce((s, w) => s + w, 0);

        // Herfindahl-Hirschman Index (sum of squared weights)
        // Normalized to 0-10000 scale
        const hhi = weights.reduce((s, w) => s + (w / 100) ** 2, 0) * 10000;

        return {
            top5Weight: Math.round(top5 * 100) / 100,
            top10Weight: Math.round(top10 * 100) / 100,
            top20Weight: Math.round(top20 * 100) / 100,
            herfindahlIndex: Math.round(hhi * 100) / 100,
        };
    }
}
