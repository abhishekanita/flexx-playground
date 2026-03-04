/**
 * Overlap Analyser — pairwise fund overlap analysis.
 *
 * For each pair of active funds with holdings data, computes:
 *   - overlapPct = commonCompanies / unionSize * 100
 *   - commonWeight = Σ min(weight_A, weight_B) for shared holdings
 *   - Warning if overlapPct > 40%
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { OverlapResult, PairwiseOverlap } from '@/types/analysis';
import { FundHoldingsSource } from '@/types/analysis/enrichment.type';
import { normalizeCompany } from '../helpers/normalization';

type Folio = MFDetailedStatementData['folios'][number];

const OVERLAP_WARNING_THRESHOLD = 40;

interface SchemeHoldings {
    schemeName: string;
    /** Normalized company name → pctOfNAV */
    companies: Map<string, number>;
}

export class OverlapAnalyser {
    static analyse(
        data: MFDetailedStatementData,
        holdingsLookup: Map<string, FundHoldingsSource>,
    ): OverlapResult {
        // Build per-scheme equity holdings map (deduplicate across folios with same scheme)
        const schemeMap = new Map<string, SchemeHoldings>();

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const source = holdingsLookup.get(folio.scheme.isin);
            if (!source) continue;

            const schemeName = folio.scheme.current_name;
            if (schemeMap.has(schemeName)) continue; // dedup same scheme across folios

            const companies = new Map<string, number>();
            for (const h of source.holdings) {
                if (h.section !== 'equity' || h.pctOfNAV <= 0) continue;
                const key = normalizeCompany(h.instrument);
                if (key.length < 2) continue;
                companies.set(key, (companies.get(key) || 0) + h.pctOfNAV);
            }

            if (companies.size > 0) {
                schemeMap.set(schemeName, { schemeName, companies });
            }
        }

        // Pairwise comparison
        const schemes = [...schemeMap.values()];
        const pairwiseOverlap: PairwiseOverlap[] = [];
        const highOverlapWarnings: string[] = [];

        for (let i = 0; i < schemes.length; i++) {
            for (let j = i + 1; j < schemes.length; j++) {
                const a = schemes[i];
                const b = schemes[j];

                const keysA = new Set(a.companies.keys());
                const keysB = new Set(b.companies.keys());

                // Common companies
                const common = [...keysA].filter((k) => keysB.has(k));
                const union = new Set([...keysA, ...keysB]);

                if (union.size === 0) continue;

                const overlapPct = Math.round((common.length / union.size) * 10000) / 100;
                const commonWeight = common.reduce(
                    (sum, k) => sum + Math.min(a.companies.get(k)!, b.companies.get(k)!),
                    0,
                );

                pairwiseOverlap.push({
                    scheme1: a.schemeName,
                    scheme2: b.schemeName,
                    overlapPct,
                    commonCompanies: common.length,
                    commonWeight: Math.round(commonWeight * 100) / 100,
                });

                if (overlapPct > OVERLAP_WARNING_THRESHOLD) {
                    highOverlapWarnings.push(
                        `${a.schemeName} and ${b.schemeName} share ${overlapPct}% of holdings`,
                    );
                }
            }
        }

        // Sort by overlap descending
        pairwiseOverlap.sort((a, b) => b.overlapPct - a.overlapPct);

        return { pairwiseOverlap, highOverlapWarnings };
    }
}
