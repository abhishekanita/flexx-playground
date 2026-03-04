/**
 * What-If Scenarios Engine.
 *
 * Runs all available scenarios, scores them by relevance,
 * and returns the top 3-4 most impactful for this user.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfResult, WhatIfScenario } from '@/types/analysis';
import { FundMetadata, BenchmarkStats } from '@/types/analysis/enrichment.type';
import { AMFIMasterProvider } from '../enrichment/amfi-master.provider';
import { NAVProvider } from '../enrichment/nav.provider';
import { computeFDvsMF } from './fd-vs-mf.scenario';
import { computeWorstFundRemoved } from './worst-fund-removed.scenario';
import { computeDirectVsRegular } from './direct-vs-regular.scenario';
import { computeSIPvsLumpsum } from './sip-vs-lumpsum.scenario';
import { computeStartedEarlier } from './started-earlier.scenario';
import { computeTopFundInCategory } from './top-fund-in-category.scenario';
import { computeIndexFundAlt } from './index-fund-alt.scenario';
import { computeIfBoughtStocks } from './if-bought-stocks.scenario';
import { computeCoffeeMoneySIP } from './coffee-money-sip.scenario';
import { computeCrorepatiCountdown } from './crorepati-countdown.scenario';
import { computeInflationErosion } from './inflation-erosion.scenario';
import { computePPFComparison } from './ppf-comparison.scenario';
import { computeEMIRedirect } from './emi-redirect.scenario';

const MAX_SCENARIOS = 6;

export class WhatIfEngine {
    /**
     * Run all available what-if scenarios and return the top results.
     */
    static async compute(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
        amfiMaster?: AMFIMasterProvider,
        navProvider?: NAVProvider,
        metadata?: Map<string, FundMetadata>,
        benchmarks?: Map<string, BenchmarkStats>,
    ): Promise<WhatIfResult> {
        const scenarios: WhatIfScenario[] = [];

        // ── Sync scenarios ──
        const fdVsMf = computeFDvsMF(data, analysis);
        if (fdVsMf) scenarios.push(fdVsMf);

        const worstRemoved = computeWorstFundRemoved(data, analysis);
        if (worstRemoved) scenarios.push(worstRemoved);

        const directVsRegular = computeDirectVsRegular(data, analysis);
        if (directVsRegular) scenarios.push(directVsRegular);

        const coffeeSip = computeCoffeeMoneySIP(data, analysis);
        if (coffeeSip) scenarios.push(coffeeSip);

        const crorepati = computeCrorepatiCountdown(data, analysis);
        if (crorepati) scenarios.push(crorepati);

        const inflationErosion = computeInflationErosion(data, analysis);
        if (inflationErosion) scenarios.push(inflationErosion);

        const ppfComparison = computePPFComparison(data, analysis);
        if (ppfComparison) scenarios.push(ppfComparison);

        const emiRedirect = computeEMIRedirect(data, analysis);
        if (emiRedirect) scenarios.push(emiRedirect);

        if (metadata && metadata.size > 0) {
            const topFund = computeTopFundInCategory(data, analysis, metadata);
            if (topFund) scenarios.push(topFund);
        }

        if (benchmarks && benchmarks.size > 0) {
            const indexAlt = computeIndexFundAlt(data, analysis, benchmarks);
            if (indexAlt) scenarios.push(indexAlt);
        }

        // ── Async scenarios (only if providers available) ──
        if (amfiMaster && navProvider) {
            const asyncResults = await Promise.allSettled([
                computeSIPvsLumpsum(data, analysis, amfiMaster, navProvider),
                computeStartedEarlier(data, analysis, amfiMaster, navProvider),
            ]);

            for (const result of asyncResults) {
                if (result.status === 'fulfilled' && result.value) {
                    scenarios.push(result.value);
                }
            }
        }

        if (benchmarks && benchmarks.size > 0) {
            try {
                const stocks = await computeIfBoughtStocks(data, analysis, benchmarks);
                if (stocks) scenarios.push(stocks);
            } catch { /* skip on failure */ }
        }

        // Sort by relevance score (highest first) and take top N
        scenarios.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return {
            scenarios: scenarios.slice(0, MAX_SCENARIOS),
        };
    }
}
