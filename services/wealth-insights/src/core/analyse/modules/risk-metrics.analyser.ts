/**
 * Risk Metrics Analyser — per-scheme and portfolio-level risk statistics.
 *
 * Hybrid approach:
 *   1. Try pre-computed stats from Groww (sharpe, sortino, stdDev)
 *   2. Fallback: resolve scheme code via AMFI, fetch NAV history, compute from prices
 *
 * This module is async (needs NAV fetching for fallback path).
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { RiskMetricsResult, SchemeRiskMetric } from '@/types/analysis';
import { GrowwScheme } from '@/types/market';
import { AMFIMasterProvider } from '../enrichment/amfi-master.provider';
import { NAVProvider } from '../enrichment/nav.provider';
import {
    dailyReturns,
    volatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    drawdownRecoveryDays,
    cagr,
} from '../helpers/financial-math';

const DEFAULT_RISK_FREE_RATE = 0.065; // 6.5% Indian T-Bill proxy

export class RiskMetricsAnalyser {
    static async analyse(
        data: MFDetailedStatementData,
        growwSchemes: Map<string, GrowwScheme>,
        amfiMaster: AMFIMasterProvider,
        navProvider: NAVProvider,
        riskFreeRate = DEFAULT_RISK_FREE_RATE,
    ): Promise<RiskMetricsResult> {
        const metrics: SchemeRiskMetric[] = [];
        const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0);

        // Process each active folio
        const promises = activeFolios.map((folio) =>
            this.computeSchemeMetrics(
                folio.scheme.current_name,
                folio.scheme.isin,
                growwSchemes.get(folio.scheme.isin),
                amfiMaster,
                navProvider,
                riskFreeRate,
            ),
        );

        const results = await Promise.allSettled(promises);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                metrics.push(result.value);
            }
        }

        // Portfolio-level: market-value-weighted averages
        const totalMV = activeFolios.reduce((s, f) => s + f.snapshot.marketValue, 0);
        const mvMap = new Map<string, number>();
        for (const folio of activeFolios) {
            mvMap.set(folio.scheme.isin, (mvMap.get(folio.scheme.isin) || 0) + folio.snapshot.marketValue);
        }

        let portfolioVol = 0;
        let portfolioSharpe = 0;
        let portfolioSortino = 0;
        let portfolioMaxDD = 0;
        let portfolioRecovery: number | null = null;
        let weightSum = 0;

        for (const m of metrics) {
            const mv = mvMap.get(m.isin) || 0;
            const weight = totalMV > 0 ? mv / totalMV : 0;
            portfolioVol += m.volatility * weight;
            portfolioSharpe += m.sharpeRatio * weight;
            portfolioSortino += m.sortinoRatio * weight;
            portfolioMaxDD += m.maxDrawdown * weight;
            if (m.drawdownRecoveryDays !== null) {
                portfolioRecovery = Math.max(portfolioRecovery ?? 0, m.drawdownRecoveryDays);
            }
            weightSum += weight;
        }

        return {
            portfolioVolatility: Math.round(portfolioVol * 100) / 100,
            sharpeRatio: Math.round(portfolioSharpe * 100) / 100,
            sortinoRatio: Math.round(portfolioSortino * 100) / 100,
            maxDrawdown: Math.round(portfolioMaxDD * 100) / 100,
            drawdownRecoveryDays: portfolioRecovery,
            schemeRiskMetrics: metrics,
        };
    }

    private static async computeSchemeMetrics(
        schemeName: string,
        isin: string,
        groww: GrowwScheme | undefined,
        amfiMaster: AMFIMasterProvider,
        navProvider: NAVProvider,
        riskFreeRate: number,
    ): Promise<SchemeRiskMetric | null> {
        // Path 1: Use pre-computed Groww stats
        if (groww?.riskStats) {
            const stats = groww.riskStats;
            if (stats.stdDev != null && stats.sharpe != null) {
                return {
                    schemeName,
                    isin,
                    volatility: stats.stdDev,
                    sharpeRatio: stats.sharpe,
                    sortinoRatio: stats.sortino ?? 0,
                    maxDrawdown: 0, // Not available from Groww
                    drawdownRecoveryDays: null,
                    dataPoints: 0, // Pre-computed, no raw data points
                };
            }
        }

        // Path 2: Compute from NAV history
        const schemeCode = amfiMaster.getSchemeCode(isin);
        if (!schemeCode) return null;

        const history = await navProvider.fetchNAVHistory(schemeCode);
        if (!history || history.navHistory.length < 30) return null;

        const { dates, prices } = NAVProvider.extractPrices(history);
        const returns = dailyReturns(prices);

        if (returns.length < 20) return null;

        const vol = volatility(returns);
        const annualizedVol = vol / 100; // volatility() returns percentage

        // Approximate annualized return from price series
        const years = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (365.2425 * 24 * 60 * 60 * 1000);
        const annualizedReturn = years > 0
            ? cagr(prices[0], prices[prices.length - 1], years) / 100
            : 0;

        const sharp = sharpeRatio(annualizedReturn, riskFreeRate, annualizedVol);
        const sortino = sortinoRatio(annualizedReturn, riskFreeRate, returns);
        const mdd = maxDrawdown(prices);
        const recovery = drawdownRecoveryDays(prices, dates);

        return {
            schemeName,
            isin,
            volatility: Math.round(vol * 100) / 100,
            sharpeRatio: Math.round(sharp * 100) / 100,
            sortinoRatio: Math.round(sortino * 100) / 100,
            maxDrawdown: Math.round(mdd * 100) / 100,
            drawdownRecoveryDays: recovery,
            dataPoints: prices.length,
        };
    }
}
