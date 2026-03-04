/**
 * If Bought Stocks scenario.
 *
 * Takes the top 5 equity holdings from companyExposure and hypothetically
 * replays proportional investment into Nifty 50 (as a proxy for direct stock
 * exposure) using actual benchmark price history.
 *
 * Educational scenario — shows what would happen investing in individual stocks
 * vs mutual funds. Uses SIP-aware replay (not lumpsum CAGR).
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis, WhatIfScenario } from '@/types/analysis';
import { BenchmarkStats } from '@/types/analysis/enrichment.type';

const PURCHASE_TYPES = new Set(['Purchase', 'SIP', 'Switch In', 'STP In', 'NFO Allotment']);

export async function computeIfBoughtStocks(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
    benchmarks: Map<string, BenchmarkStats>,
): Promise<WhatIfScenario | null> {
    if (!analysis.companyExposure) return null;

    const topCompanies = analysis.companyExposure.companies.slice(0, 5);
    if (topCompanies.length === 0) return null;

    const nifty = benchmarks.get('^NSEI');
    if (!nifty || nifty.prices.length < 30) return null;

    const totalMV = analysis.portfolioSummary.totalMarketValue;
    const totalInvested = analysis.portfolioSummary.totalInvested;
    if (totalMV <= 0 || totalInvested <= 0) return null;

    // Top 5 companies' combined weight
    const top5Weight = topCompanies.reduce((s, c) => s + c.portfolioWeight, 0) / 100;

    // Build Nifty price lookup: date string → close price
    const niftyPriceMap = new Map<string, number>();
    for (const p of nifty.prices) {
        niftyPriceMap.set(p.date, p.close);
    }

    // Find closest Nifty price for a given date
    const latestPrice = nifty.prices[nifty.prices.length - 1]?.close;
    if (!latestPrice || latestPrice <= 0) return null;

    function findNiftyPrice(dateStr: string): number | null {
        // Try exact date, then look back up to 7 days for weekends/holidays
        const d = new Date(dateStr);
        for (let offset = 0; offset <= 7; offset++) {
            const key = d.toISOString().slice(0, 10);
            const price = niftyPriceMap.get(key);
            if (price) return price;
            d.setDate(d.getDate() - 1);
        }
        return null;
    }

    // Replay each purchase transaction proportionally into Nifty
    let hypotheticalNiftyUnits = 0;
    let stockInvestedAmount = 0;

    for (const folio of data.folios) {
        if (folio.closingUnitBalance <= 0) continue;

        for (const tx of folio.transactions) {
            if (!PURCHASE_TYPES.has(tx.type) || tx.amount === null || tx.amount <= 0) continue;

            const niftyPrice = findNiftyPrice(tx.date);
            if (!niftyPrice) continue;

            // Invest the proportional amount (top 5 weight) into Nifty
            const proportionalAmount = tx.amount * top5Weight;
            hypotheticalNiftyUnits += proportionalAmount / niftyPrice;
            stockInvestedAmount += proportionalAmount;
        }
    }

    if (stockInvestedAmount <= 0 || hypotheticalNiftyUnits <= 0) return null;

    // Value accumulated Nifty units at latest price
    const hypotheticalStockMV = hypotheticalNiftyUnits * latestPrice;

    // Actual MF value for same proportion
    const actualProportionalMV = totalMV * top5Weight;

    const difference = hypotheticalStockMV - actualProportionalMV;

    return {
        id: 'IF_BOUGHT_STOCKS',
        name: 'Stocks vs Mutual Funds',
        description: 'What if you had invested proportionally in the Nifty 50 instead?',
        relevanceScore: 55,

        actual: {
            totalInvested: Math.round(stockInvestedAmount),
            currentValue: Math.round(actualProportionalMV),
            xirr: analysis.xirrAnalysis.portfolioXIRR,
        },

        hypothetical: {
            totalInvested: Math.round(stockInvestedAmount),
            hypotheticalValue: Math.round(hypotheticalStockMV),
            hypotheticalXirr: Math.round(nifty.cagr * 100) / 100,
        },

        difference: {
            absoluteAmount: Math.round(Math.abs(difference)),
            percentageDifference: stockInvestedAmount > 0
                ? Math.round((difference / stockInvestedAmount) * 10000) / 100
                : 0,
            userDidBetter: difference < 0,
        },

        dataPointsForNarrative: {
            top5Companies: topCompanies.map((c) => c.instrumentName).join(', '),
            top5Weight: Math.round(top5Weight * 10000) / 100,
            niftyCAGR: Math.round(nifty.cagr * 100) / 100,
            stockValue: Math.round(hypotheticalStockMV),
            mfValue: Math.round(actualProportionalMV),
            framing: difference > 0
                ? `A proportional Nifty 50 investment (replaying your SIP dates) could have earned ₹${Math.round(difference).toLocaleString('en-IN')} more — but with concentration risk and no diversification`
                : `Your mutual funds outperformed a Nifty 50 proxy by ₹${Math.round(Math.abs(difference)).toLocaleString('en-IN')} — active management added value`,
        },
    };
}
