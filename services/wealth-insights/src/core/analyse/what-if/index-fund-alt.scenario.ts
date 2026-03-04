/**
 * Index Fund Alternative scenario.
 *
 * For each actively-managed fund, maps to the appropriate Nifty benchmark
 * and replays transactions using benchmark price history.
 * Compares hypothetical index value vs actual.
 *
 * Sync — uses pre-fetched benchmark data.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { BenchmarkStats } from '@/types/analysis/enrichment.type';
import { mapSchemeToBenchmark } from '../helpers/benchmark-mapper';
import { parseDate } from '../helpers/financial-math';

export function computeIndexFundAlt(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
    benchmarks: Map<string, BenchmarkStats>,
): WhatIfScenario | null {
    if (benchmarks.size === 0) return null;

    const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0);
    if (activeFolios.length === 0) return null;

    // Only compare actively-managed funds (exclude index/ETF funds)
    const activelyManaged = activeFolios.filter((f) => {
        const name = f.scheme.current_name.toLowerCase();
        return !name.includes('index') && !name.includes('etf') && !name.includes('nifty') && !name.includes('sensex');
    });

    if (activelyManaged.length === 0) return null;

    let totalActualMV = 0;
    let totalHypotheticalMV = 0;
    let totalInvested = 0;
    let indexBeatCount = 0;

    for (const folio of activelyManaged) {
        const mapping = mapSchemeToBenchmark(folio.scheme.current_name);
        const benchmark = benchmarks.get(mapping.ticker);
        if (!benchmark || benchmark.prices.length < 30) continue;

        // Build date→price lookup for benchmark
        const priceMap = new Map<string, number>();
        for (const p of benchmark.prices) {
            priceMap.set(p.date, p.close);
        }

        const latestPrice = benchmark.prices[benchmark.prices.length - 1]?.close;
        if (!latestPrice || latestPrice <= 0) continue;

        let actualInvested = 0;
        let hypotheticalUnits = 0;

        const purchaseTxns = folio.transactions.filter(
            (tx) => ['Purchase', 'SIP', 'Switch In', 'STP In', 'NFO Allotment'].includes(tx.type)
                && tx.amount !== null && tx.amount > 0,
        );

        for (const tx of purchaseTxns) {
            const amount = tx.amount!;
            actualInvested += amount;

            const benchmarkPrice = findClosestPrice(priceMap, tx.date);
            if (benchmarkPrice > 0) {
                hypotheticalUnits += amount / benchmarkPrice;
            }
        }

        if (actualInvested <= 0) continue;

        const hypotheticalMV = hypotheticalUnits * latestPrice;
        const actualMV = folio.snapshot.marketValue;

        totalActualMV += actualMV;
        totalHypotheticalMV += hypotheticalMV;
        totalInvested += actualInvested;

        if (hypotheticalMV > actualMV) indexBeatCount++;
    }

    if (totalInvested <= 0) return null;

    const difference = totalHypotheticalMV - totalActualMV;
    const indexBetter = difference > 0;

    // Higher relevance if active funds underperform benchmark
    const relevanceScore = indexBetter && indexBeatCount > 0 ? 80 : 50;

    return {
        id: 'INDEX_FUND_ALT',
        name: 'Index Fund Alternative',
        description: 'What if you had used index funds instead of actively-managed funds?',
        relevanceScore,

        actual: {
            totalInvested: Math.round(totalInvested),
            currentValue: Math.round(totalActualMV),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(totalInvested),
            hypotheticalValue: Math.round(totalHypotheticalMV),
            hypotheticalXirr: 0,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: totalInvested > 0
                ? Math.round((difference / totalInvested) * 10000) / 100
                : 0,
            userDidBetter: !indexBetter,
        },

        dataPointsForNarrative: {
            activeFundsCount: activelyManaged.length,
            indexBeatCount,
            totalInvested: Math.round(totalInvested),
            actualValue: Math.round(totalActualMV),
            hypotheticalValue: Math.round(totalHypotheticalMV),
            framing: indexBetter
                ? `Index funds would have outperformed ${indexBeatCount} of your ${activelyManaged.length} active funds, earning ₹${Math.round(difference).toLocaleString('en-IN')} more`
                : `Your active fund selection beat index funds by ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} — fund managers earned their fee`,
        },
    };
}

function findClosestPrice(priceMap: Map<string, number>, dateStr: string): number {
    for (let offset = 0; offset <= 5; offset++) {
        const d = new Date(dateStr);
        d.setDate(d.getDate() + offset);
        const price = priceMap.get(d.toISOString().slice(0, 10));
        if (price) return price;

        if (offset > 0) {
            const d2 = new Date(dateStr);
            d2.setDate(d2.getDate() - offset);
            const price2 = priceMap.get(d2.toISOString().slice(0, 10));
            if (price2) return price2;
        }
    }
    return 0;
}
