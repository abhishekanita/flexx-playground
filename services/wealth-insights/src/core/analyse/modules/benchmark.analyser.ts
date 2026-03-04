/**
 * Benchmark comparison analyser.
 * Compares each scheme's XIRR against its appropriate benchmark CAGR.
 * Also computes portfolio-level benchmark stats.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import {
    BenchmarkComparisonResult,
    PortfolioBenchmark,
    FundVsBenchmark,
    XIRRAnalysisResult,
} from '@/types/analysis';
import { BenchmarkStats } from '@/types/analysis/enrichment.type';
import { AMFIMasterProvider } from '../enrichment/amfi-master.provider';
import { mapSchemeToBenchmark, BenchmarkMapping } from '../helpers/benchmark-mapper';

export class BenchmarkAnalyser {
    /**
     * Compare funds against their benchmarks.
     *
     * @param data - Parsed statement data
     * @param xirrResult - Pre-computed XIRR results
     * @param benchmarkData - Benchmark stats keyed by ticker
     * @param amfiMaster - AMFI master for category lookup
     */
    static analyse(
        data: MFDetailedStatementData,
        xirrResult: XIRRAnalysisResult,
        benchmarkData: Map<string, BenchmarkStats>,
        amfiMaster: AMFIMasterProvider | null,
    ): BenchmarkComparisonResult {
        // 1. Portfolio-level benchmarks
        const portfolioBenchmarks: PortfolioBenchmark[] = [];
        for (const [, stats] of benchmarkData) {
            portfolioBenchmarks.push({
                benchmarkName: stats.name,
                ticker: stats.ticker,
                startDate: stats.startDate,
                endDate: stats.endDate,
                totalReturn: stats.totalReturn,
                cagr: stats.cagr,
                volatility: stats.volatility,
                maxDrawdown: stats.maxDrawdown,
            });
        }

        // 2. Fund-level comparison
        const fundVsBenchmark: FundVsBenchmark[] = [];

        for (const scheme of xirrResult.schemeXIRR) {
            // Find category from AMFI
            const amfiScheme = amfiMaster?.findByISIN(scheme.isin);
            const category = amfiScheme?.schemeCategory || '';

            // Map to benchmark
            const mapping: BenchmarkMapping = mapSchemeToBenchmark(
                scheme.schemeName,
                category,
            );

            const benchStats = benchmarkData.get(mapping.ticker);
            if (!benchStats) continue;

            // Compute benchmark CAGR for this fund's holding period
            let benchmarkCAGR = benchStats.cagr;

            // Try to get benchmark CAGR for the fund's specific period
            if (scheme.firstTxDate) {
                const fromPrices = benchStats.prices.find((p) => p.date >= scheme.firstTxDate);
                const toPrices = [...benchStats.prices].reverse().find((p) => p.date <= benchStats.endDate);

                if (fromPrices && toPrices && fromPrices.date < toPrices.date) {
                    const years =
                        (new Date(toPrices.date).getTime() - new Date(fromPrices.date).getTime()) /
                        (365.2425 * 24 * 60 * 60 * 1000);
                    if (years > 0) {
                        benchmarkCAGR = (Math.pow(toPrices.close / fromPrices.close, 1 / years) - 1) * 100;
                    }
                }
            }

            const schemeXIRR = isNaN(scheme.xirr) ? 0 : scheme.xirr;
            const gap = schemeXIRR - benchmarkCAGR;

            fundVsBenchmark.push({
                fundHouse: scheme.fundHouse,
                schemeName: scheme.schemeName,
                marketValue: scheme.marketValue,
                benchmarkName: mapping.name,
                benchmarkTicker: mapping.ticker,
                schemeXIRR,
                benchmarkCAGR: Math.round(benchmarkCAGR * 100) / 100,
                gapPctPoints: Math.round(gap * 100) / 100,
                ageDays: scheme.holdingDays,
                netInvested: scheme.netInvested,
                // Only include in summary if meaningful (active, >30 days, significant position)
                includeInSummary:
                    scheme.marketValue > 1000 &&
                    scheme.holdingDays > 30 &&
                    scheme.reliability !== 'Insufficient',
            });
        }

        // Sort by gap (worst performers first for actionability)
        fundVsBenchmark.sort((a, b) => a.gapPctPoints - b.gapPctPoints);

        return { portfolioBenchmarks, fundVsBenchmark };
    }
}
