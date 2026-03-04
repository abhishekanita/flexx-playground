/**
 * Market cap allocation analyser.
 * Classifies underlying equity holdings into Large/Mid/Small/Global.
 * Uses market cap data resolved from Yahoo Finance.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import {
    MarketCapAllocationResult,
    MarketCapAllocation,
    SchemeMarketCapAllocation,
    MarketCapBucket,
} from '@/types/analysis';
import { FundHoldingsSource, MarketCapLookup } from '@/types/analysis/enrichment.type';

const BUCKETS: MarketCapBucket[] = ['Large Cap', 'Mid Cap', 'Small Cap', 'Global Equity', 'Unclassified'];

export class MarketCapAnalyser {
    /**
     * Analyse market cap allocation across the portfolio.
     */
    static analyse(
        data: MFDetailedStatementData,
        holdingsLookup: Map<string, FundHoldingsSource>,
        marketCapMap: Map<string, MarketCapLookup>,
    ): MarketCapAllocationResult {
        const totalMV = data.totalMarketValue;
        const bucketMV: Record<string, number> = {};
        const schemeAllocations: SchemeMarketCapAllocation[] = [];
        let totalEquityMV = 0;

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const holdings = holdingsLookup.get(folio.scheme.isin);
            if (!holdings) continue;

            const schemeMV = folio.snapshot.marketValue;
            const schemeBucketMV: Record<string, number> = {};
            let schemeEquityMV = 0;

            for (const holding of holdings.holdings) {
                if (holding.section !== 'equity') continue;
                if (holding.pctOfNAV <= 0) continue;

                const weightedMV = schemeMV * (holding.pctOfNAV / 100);
                schemeEquityMV += weightedMV;
                totalEquityMV += weightedMV;

                // Get market cap bucket for this holding
                const mcapLookup = marketCapMap.get(holding.isin);
                const bucket: MarketCapBucket = mcapLookup?.bucket || 'Unclassified';

                bucketMV[bucket] = (bucketMV[bucket] || 0) + weightedMV;
                schemeBucketMV[bucket] = (schemeBucketMV[bucket] || 0) + weightedMV;
            }

            // Record per-scheme allocations
            for (const [bucket, mv] of Object.entries(schemeBucketMV)) {
                schemeAllocations.push({
                    fundHouse: folio.fundHouse,
                    schemeName: folio.scheme.current_name,
                    bucket: bucket as MarketCapBucket,
                    marketValue: Math.round(mv * 100) / 100,
                    schemeEquityWeight: schemeEquityMV > 0
                        ? Math.round((mv / schemeEquityMV) * 10000) / 100
                        : 0,
                    portfolioWeight: totalMV > 0
                        ? Math.round((mv / totalMV) * 10000) / 100
                        : 0,
                });
            }
        }

        // Build overall allocation
        const overall: MarketCapAllocation[] = BUCKETS
            .map((bucket) => ({
                bucket,
                marketValue: Math.round((bucketMV[bucket] || 0) * 100) / 100,
                portfolioWeight: totalMV > 0
                    ? Math.round(((bucketMV[bucket] || 0) / totalMV) * 10000) / 100
                    : 0,
                equityWeight: totalEquityMV > 0
                    ? Math.round(((bucketMV[bucket] || 0) / totalEquityMV) * 10000) / 100
                    : 0,
            }))
            .filter((a) => a.marketValue > 0)
            .sort((a, b) => b.marketValue - a.marketValue);

        return {
            overall,
            byScheme: schemeAllocations.sort((a, b) => b.marketValue - a.marketValue),
        };
    }
}
