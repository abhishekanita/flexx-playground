/**
 * Shadow Index — "What if every rupee went to Nifty 50?"
 * Computes a shadow portfolio where all investments tracked Nifty 50,
 * then compares actual vs shadow to reveal alpha (or lack of it).
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { ShadowIndexResult, ShadowFund } from '@/types/analysis/shadow-index.type';
import { abbreviateFundName } from '@/core/analyse/helpers/fund-name';

export function computeShadowIndex(
    data: MFDetailedStatementData,
    analysis: PortfolioAnalysis,
): ShadowIndexResult {
    // ── Nifty rate from benchmark data, fallback 12% ──────────────────────────
    const niftyRate = analysis.benchmarkComparison?.portfolioBenchmarks
        ?.find(b => b.benchmarkName.toLowerCase().includes('nifty'))?.cagr ?? 12;

    const now = new Date();

    // ── Portfolio-level shadow ─────────────────────────────────────────────────
    const portfolioCashflows = buildPortfolioCashflows(data);
    let shadowValue = 0;
    for (const cf of portfolioCashflows) {
        const years = (now.getTime() - cf.date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
        shadowValue += Math.abs(cf.amount) * Math.pow(1 + niftyRate / 100, years);
    }

    const actualValue = analysis.portfolioSummary.totalMarketValue;
    const totalRedemptions = analysis.portfolioSummary.totalWithdrawn;
    const alpha = actualValue + totalRedemptions - shadowValue;

    // ── Per-fund breakdown (active folios only) ───────────────────────────────
    const fundBreakdown: ShadowFund[] = [];
    for (const folio of data.folios) {
        if (folio.closingUnitBalance <= 0) continue;

        const folioCashflows = buildFolioCashflows(folio);
        let fundShadow = 0;
        for (const cf of folioCashflows) {
            const years = (now.getTime() - cf.date.getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
            fundShadow += Math.abs(cf.amount) * Math.pow(1 + niftyRate / 100, years);
        }

        const fundActual = folio.snapshot.marketValue;
        const fundAlpha = fundActual - fundShadow;

        fundBreakdown.push({
            schemeName: folio.scheme.current_name || folio.scheme.schemeName,
            shortName: abbreviateFundName(folio.scheme.current_name || folio.scheme.schemeName),
            actualValue: Math.round(fundActual),
            shadowValue: Math.round(fundShadow),
            alpha: Math.round(fundAlpha),
        });
    }

    // Sort by alpha descending
    fundBreakdown.sort((a, b) => b.alpha - a.alpha);

    const topAlphaGenerators = fundBreakdown.filter(f => f.alpha > 0).slice(0, 3);
    const bottomAlphaGenerators = fundBreakdown.filter(f => f.alpha <= 0).slice(-3).reverse();

    return {
        niftyRate,
        portfolioLevel: {
            actualValue: Math.round(actualValue),
            shadowValue: Math.round(shadowValue),
            totalRedemptions: Math.round(totalRedemptions),
            alpha: Math.round(alpha),
        },
        fundBreakdown,
        topAlphaGenerators,
        bottomAlphaGenerators,
    };
}

interface SimpleCashflow {
    date: Date;
    amount: number;
}

/** Build portfolio-level cashflows: filter to outflows only (investments). */
function buildPortfolioCashflows(data: MFDetailedStatementData): SimpleCashflow[] {
    const cashflows: SimpleCashflow[] = [];
    for (const folio of data.folios) {
        for (const tx of folio.transactions) {
            // Outflows: purchases, SIPs, switch-ins — amount is negative or units are positive
            if (tx.amount != null && tx.amount > 0 && tx.units > 0) {
                cashflows.push({ date: new Date(tx.date), amount: tx.amount });
            }
        }
    }
    return cashflows;
}

/** Build folio-level cashflows: filter to outflows only. */
function buildFolioCashflows(folio: MFDetailedStatementData['folios'][0]): SimpleCashflow[] {
    const cashflows: SimpleCashflow[] = [];
    for (const tx of folio.transactions) {
        if (tx.amount != null && tx.amount > 0 && tx.units > 0) {
            cashflows.push({ date: new Date(tx.date), amount: tx.amount });
        }
    }
    return cashflows;
}
