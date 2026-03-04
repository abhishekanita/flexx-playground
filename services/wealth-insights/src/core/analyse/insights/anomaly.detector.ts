/**
 * Anomaly Detector — identifies portfolio-level anomalies and red flags.
 *
 * Pure computation, no LLM. Produces structured anomalies that the
 * narrative generator explains and prioritizes.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { AnomalyInsight } from '@/types/analysis/insights.type';
import { daysBetween, parseDate } from '../helpers/financial-math';

export interface DetectedAnomaly {
    id: string;
    severity: 'critical' | 'warning' | 'info';
    category: 'compliance' | 'risk' | 'opportunity' | 'operational';
    title: string;
    /** Raw data for LLM to narrate */
    dataPoints: Record<string, string | number | string[]>;
}

export class AnomalyDetector {
    static detect(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
    ): DetectedAnomaly[] {
        const anomalies: DetectedAnomaly[] = [];

        // High-signal checks first — order matters for card slot allocation
        anomalies.push(...this.checkNominees(data));
        anomalies.push(...this.checkMisleadingPositiveGain(analysis));
        anomalies.push(...this.checkTooManyFunds(analysis));
        anomalies.push(...this.checkStatementSnapshotMismatch(data, analysis));
        anomalies.push(...this.checkAllRegularPlan(data));
        anomalies.push(...this.checkGoldBeatingEquity(analysis));
        anomalies.push(...this.checkNoIndexFunds(analysis));
        // Standard checks
        anomalies.push(...this.checkMicroHoldings(data, analysis));
        anomalies.push(...this.checkFundHouseConcentration(analysis));
        anomalies.push(...this.checkDormantHoldings(data));
        anomalies.push(...this.checkCategoryDuplicates(data, analysis));
        anomalies.push(...this.checkSingleSchemeRisk(analysis));
        anomalies.push(...this.checkNoDebtAllocation(analysis));
        anomalies.push(...this.checkHighUnrealisedLoss(analysis));

        // Sort: critical first, then warning, then info
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        return anomalies;
    }

    /**
     * Convert detected anomalies to AnomalyInsight format (without LLM explanation).
     * Provides a default explanation that the LLM can later enhance.
     */
    static toInsights(anomalies: DetectedAnomaly[]): AnomalyInsight[] {
        return anomalies.map((a) => ({
            severity: a.severity,
            category: a.category,
            title: a.title,
            explanation: this.defaultExplanation(a),
        }));
    }

    // ─── Checks ─────────────────────────────────────────────────────────

    private static checkNominees(data: MFDetailedStatementData): DetectedAnomaly[] {
        const noNominees: string[] = [];
        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;
            if (!folio.investor.nominees || folio.investor.nominees.length === 0) {
                noNominees.push(folio.folioNumber);
            }
        }

        if (noNominees.length === 0) return [];

        const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0).length;
        return [{
            id: 'NO_NOMINEES',
            severity: noNominees.length === activeFolios ? 'critical' : 'warning',
            category: 'compliance',
            title: `${noNominees.length} of ${activeFolios} active folios have no nominee`,
            dataPoints: {
                foliosWithoutNominee: noNominees.length,
                totalActiveFolios: activeFolios,
                affectedFolios: noNominees,
            },
        }];
    }

    private static checkMicroHoldings(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
    ): DetectedAnomaly[] {
        const microHoldings = analysis.activeHoldings
            .filter((h) => h.weight < 1 && h.marketValue > 0)
            .map((h) => ({
                scheme: h.schemeName,
                value: h.marketValue,
                weight: h.weight,
            }));

        if (microHoldings.length === 0) return [];

        const totalMicroMV = microHoldings.reduce((s, h) => s + h.value, 0);
        return [{
            id: 'MICRO_HOLDINGS',
            severity: 'info',
            category: 'operational',
            title: `${microHoldings.length} holdings are less than 1% of portfolio`,
            dataPoints: {
                count: microHoldings.length,
                totalValue: Math.round(totalMicroMV),
                schemes: microHoldings.map((h) => `${h.scheme} (₹${h.value.toLocaleString('en-IN')}, ${h.weight}%)`),
            },
        }];
    }

    private static checkFundHouseConcentration(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const concentrated = analysis.portfolioSummary.fundHouseSummary
            .filter((fh) => fh.weight > 25);

        if (concentrated.length === 0) return [];

        return concentrated.map((fh) => ({
            id: `FUND_HOUSE_CONCENTRATION_${fh.fundHouse.replace(/\s+/g, '_').toUpperCase()}`,
            severity: fh.weight > 50 ? 'warning' as const : 'info' as const,
            category: 'risk' as const,
            title: `${fh.fundHouse} accounts for ${fh.weight.toFixed(1)}% of portfolio`,
            dataPoints: {
                fundHouse: fh.fundHouse,
                weight: fh.weight,
                marketValue: Math.round(fh.marketValue),
            },
        }));
    }

    private static checkDormantHoldings(data: MFDetailedStatementData): DetectedAnomaly[] {
        const dormant: { scheme: string; monthsInactive: number; lastTxDate: string }[] = [];
        const now = new Date();

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            // Find last non-stamp-duty transaction
            const realTxs = folio.transactions.filter(
                (tx) => tx.type !== 'Stamp Duty' && tx.type !== 'Dividend Reinvestment',
            );
            if (realTxs.length === 0) continue;

            const lastTx = realTxs[realTxs.length - 1];
            const daysSince = daysBetween(parseDate(lastTx.date), now);
            const monthsSince = Math.round(daysSince / 30.44);

            if (monthsSince >= 12) {
                dormant.push({
                    scheme: folio.scheme.current_name,
                    monthsInactive: monthsSince,
                    lastTxDate: lastTx.date,
                });
            }
        }

        if (dormant.length === 0) return [];

        return [{
            id: 'DORMANT_HOLDINGS',
            severity: 'info',
            category: 'operational',
            title: `${dormant.length} holding(s) with no activity for 12+ months`,
            dataPoints: {
                count: dormant.length,
                schemes: dormant.map((d) => `${d.scheme} (${d.monthsInactive} months since last tx)`),
            },
        }];
    }

    private static checkCategoryDuplicates(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
    ): DetectedAnomaly[] {
        // Group active schemes by broad category keywords
        const categoryGroups = new Map<string, string[]>();

        for (const folio of data.folios) {
            if (folio.closingUnitBalance <= 0) continue;

            const name = folio.scheme.current_name.toLowerCase();
            let category = 'other';

            if (name.includes('elss') || name.includes('tax saver')) category = 'ELSS';
            else if (name.includes('large cap') || name.includes('largecap')) category = 'Large Cap';
            else if (name.includes('mid cap') || name.includes('midcap')) category = 'Mid Cap';
            else if (name.includes('small cap') || name.includes('smallcap')) category = 'Small Cap';
            else if (name.includes('flexi') || name.includes('multi')) category = 'Flexi/Multi Cap';
            else if (name.includes('nifty 50') || name.includes('index') || name.includes('nifty50')) category = 'Index';
            else if (name.includes('gold') || name.includes('silver')) category = 'Commodity';
            else if (name.includes('liquid') || name.includes('overnight') || name.includes('money market')) category = 'Liquid/Debt';

            if (category === 'other') continue;

            if (!categoryGroups.has(category)) categoryGroups.set(category, []);
            categoryGroups.get(category)!.push(folio.scheme.current_name);
        }

        const duplicates: DetectedAnomaly[] = [];
        for (const [category, schemes] of categoryGroups) {
            if (schemes.length >= 2) {
                duplicates.push({
                    id: `CATEGORY_DUPLICATE_${category.replace(/[\s/]+/g, '_').toUpperCase()}`,
                    severity: 'info',
                    category: 'operational',
                    title: `${schemes.length} funds in the same category: ${category}`,
                    dataPoints: {
                        category,
                        count: schemes.length,
                        schemes,
                    },
                });
            }
        }

        return duplicates;
    }

    private static checkSingleSchemeRisk(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const topHolding = analysis.activeHoldings[0];
        if (!topHolding || topHolding.weight < 30) return [];

        return [{
            id: 'SINGLE_SCHEME_CONCENTRATION',
            severity: topHolding.weight > 50 ? 'warning' : 'info',
            category: 'risk',
            title: `${topHolding.schemeName} is ${topHolding.weight}% of your portfolio`,
            dataPoints: {
                scheme: topHolding.schemeName,
                weight: topHolding.weight,
                marketValue: Math.round(topHolding.marketValue),
            },
        }];
    }

    private static checkAllRegularPlan(data: MFDetailedStatementData): DetectedAnomaly[] {
        const activeFolios = data.folios.filter((f) => f.closingUnitBalance > 0);
        const regularFolios = activeFolios.filter((f) => f.scheme.plan === 'Regular');

        if (regularFolios.length === 0) return [];
        if (regularFolios.length < activeFolios.length * 0.5) return []; // less than half

        // Estimate annual TER cost even without metadata
        // Industry average: equity Regular ~1.5-2.0% TER, Direct ~0.5-1.0%
        // Average spread ≈ 0.7% for equity, 0.3% for debt/liquid
        const regularMV = regularFolios.reduce((s, f) => s + f.snapshot.marketValue, 0);
        const estimatedAnnualCommission = Math.round(regularMV * 0.007); // 0.7% avg spread

        return [{
            id: 'ALL_REGULAR_PLAN',
            severity: regularFolios.length === activeFolios.length ? 'warning' : 'info',
            category: 'opportunity',
            title: `${regularFolios.length} of ${activeFolios.length} active funds are Regular plans — estimated ₹${estimatedAnnualCommission.toLocaleString('en-IN')}/year in hidden commissions`,
            dataPoints: {
                regularCount: regularFolios.length,
                totalActive: activeFolios.length,
                regularMarketValue: Math.round(regularMV),
                estimatedAnnualCommission,
                schemes: regularFolios.map((f) => f.scheme.current_name),
            },
        }];
    }

    private static checkNoDebtAllocation(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        if (!analysis.assetAllocation) return [];

        const debtAlloc = analysis.assetAllocation.overall.find((a) => a.assetClass === 'Debt');
        const equityAlloc = analysis.assetAllocation.overall.find((a) => a.assetClass === 'Equity');

        if (!equityAlloc || equityAlloc.weight < 80) return [];
        if (debtAlloc && debtAlloc.weight >= 10) return [];

        return [{
            id: 'NO_DEBT_ALLOCATION',
            severity: 'warning',
            category: 'risk',
            title: `Portfolio is ${equityAlloc.weight.toFixed(0)}% equity with minimal/no debt allocation`,
            dataPoints: {
                equityWeight: equityAlloc.weight,
                debtWeight: debtAlloc?.weight || 0,
                portfolioMV: Math.round(analysis.portfolioSummary.totalMarketValue),
                potentialDrawdown: Math.round(analysis.portfolioSummary.totalMarketValue * 0.2),
            },
        }];
    }

    private static checkHighUnrealisedLoss(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const losers = analysis.activeHoldings.filter((h) => h.unrealisedGainPct < -10);
        if (losers.length === 0) return [];

        return losers.map((h) => ({
            id: `HIGH_LOSS_${h.isin || h.schemeName.replace(/\s+/g, '_').toUpperCase()}`,
            severity: h.unrealisedGainPct < -20 ? 'warning' as const : 'info' as const,
            category: 'risk' as const,
            title: `${h.schemeName} is down ${Math.abs(h.unrealisedGainPct).toFixed(1)}%`,
            dataPoints: {
                scheme: h.schemeName,
                lossPct: h.unrealisedGainPct,
                costValue: Math.round(h.costValue),
                marketValue: Math.round(h.marketValue),
                unrealisedLoss: Math.round(Math.abs(h.unrealisedGain)),
            },
        }));
    }

    // ─── New Signal Detectors ─────────────────────────────────────────────

    private static checkMisleadingPositiveGain(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const ps = analysis.portfolioSummary;
        if (ps.lifetimePnL >= 0 || ps.totalUnrealisedGain <= 0) return [];

        return [{
            id: 'MISLEADING_POSITIVE_GAIN',
            severity: 'warning',
            category: 'risk',
            title: `Portfolio shows ₹${Math.round(ps.totalUnrealisedGain).toLocaleString('en-IN')} unrealised gain but lifetime P&L is -₹${Math.abs(Math.round(ps.lifetimePnL)).toLocaleString('en-IN')}`,
            dataPoints: {
                unrealisedGain: Math.round(ps.totalUnrealisedGain),
                lifetimePnL: Math.round(ps.lifetimePnL),
                totalInvested: Math.round(ps.totalInvested),
                totalMarketValue: Math.round(ps.totalMarketValue),
            },
        }];
    }

    private static checkNoIndexFunds(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const indexPattern = /index|nifty|sensex/i;
        const hasIndex = analysis.activeHoldings.some(h => indexPattern.test(h.schemeName));
        if (hasIndex) return [];

        return [{
            id: 'NO_INDEX_FUNDS',
            severity: 'info',
            category: 'opportunity',
            title: 'No index funds in portfolio',
            dataPoints: {
                activeFunds: analysis.activeHoldings.length,
                allActivelyManaged: 1,
            },
        }];
    }

    private static checkGoldBeatingEquity(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const schemeXIRRs = analysis.xirrAnalysis.schemeXIRR
            .filter(s => s.marketValue > 1000 && s.reliability === 'High' && !isNaN(s.xirr));
        if (schemeXIRRs.length < 2) return [];

        const sorted = [...schemeXIRRs].sort((a, b) => b.xirr - a.xirr);
        const top = sorted[0];
        const goldPattern = /gold|commodity|silver/i;
        if (!goldPattern.test(top.schemeName)) return [];

        // Check there are equity funds it's beating
        const equityFunds = sorted.filter(s => !goldPattern.test(s.schemeName));
        if (equityFunds.length === 0) return [];

        return [{
            id: 'GOLD_BEATING_EQUITY',
            severity: 'info',
            category: 'opportunity',
            title: `${top.schemeName.split(' ').slice(0, 3).join(' ')} (gold/commodity) is your top performer at ${top.xirr.toFixed(1)}% XIRR`,
            dataPoints: {
                goldFund: top.schemeName,
                goldXIRR: top.xirr,
                bestEquityFund: equityFunds[0].schemeName,
                bestEquityXIRR: equityFunds[0].xirr,
                gapPp: +(top.xirr - equityFunds[0].xirr).toFixed(1),
            },
        }];
    }

    private static checkTooManyFunds(analysis: PortfolioAnalysis): DetectedAnomaly[] {
        const count = analysis.activeHoldings.length;
        if (count <= 6) return [];

        return [{
            id: 'TOO_MANY_FUNDS',
            severity: count > 10 ? 'warning' : 'info',
            category: 'operational',
            title: `Portfolio has ${count} active funds — most experts recommend 3-4`,
            dataPoints: {
                activeFunds: count,
                recommendedMax: 4,
                microHoldings: analysis.activeHoldings.filter(h => h.weight < 2).length,
            },
        }];
    }

    private static checkStatementSnapshotMismatch(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
    ): DetectedAnomaly[] {
        const statementMV = data.totalMarketValue;
        const computedMV = analysis.portfolioSummary.totalMarketValue;
        if (!statementMV || !computedMV || computedMV === 0) return [];

        const divergence = Math.abs(statementMV - computedMV) / computedMV;
        if (divergence <= 0.15) return [];

        return [{
            id: 'STATEMENT_SNAPSHOT_MISMATCH',
            severity: divergence > 0.3 ? 'warning' : 'info',
            category: 'operational',
            title: `Statement total (₹${Math.round(statementMV).toLocaleString('en-IN')}) diverges ${(divergence * 100).toFixed(0)}% from computed (₹${Math.round(computedMV).toLocaleString('en-IN')})`,
            dataPoints: {
                statementMarketValue: Math.round(statementMV),
                computedMarketValue: Math.round(computedMV),
                divergencePct: +(divergence * 100).toFixed(1),
            },
        }];
    }

    // ─── Default explanations (used when LLM is not available) ──────────

    private static defaultExplanation(anomaly: DetectedAnomaly): string {
        switch (anomaly.id) {
            case 'NO_NOMINEES':
                return `${anomaly.dataPoints.foliosWithoutNominee} of your ${anomaly.dataPoints.totalActiveFolios} active folios have no nominee registered. This can cause significant delays for your family in accessing these funds. SEBI mandates nominee registration.`;
            case 'MICRO_HOLDINGS':
                return `${anomaly.dataPoints.count} holdings together worth ₹${(anomaly.dataPoints.totalValue as number).toLocaleString('en-IN')} contribute less than 1% each. Consider consolidating into larger positions for simpler portfolio management.`;
            case 'DORMANT_HOLDINGS':
                return `${anomaly.dataPoints.count} holding(s) have had no investment or withdrawal activity for over a year. Review if these still align with your investment goals.`;
            case 'ALL_REGULAR_PLAN':
                return `Regular plans pay commission to distributors via higher expense ratios (typically 0.5-1.0% more than Direct). On ₹${(anomaly.dataPoints.regularMarketValue as number).toLocaleString('en-IN')} in Regular plans, you're paying an estimated ₹${(anomaly.dataPoints.estimatedAnnualCommission as number).toLocaleString('en-IN')}/year in hidden commissions. Switching to Direct plans preserves this amount in your returns.`;
            case 'NO_DEBT_ALLOCATION':
                return `With ${anomaly.dataPoints.equityWeight}% in equity, a 20% market correction could temporarily reduce your portfolio by ₹${(anomaly.dataPoints.potentialDrawdown as number).toLocaleString('en-IN')}. Consider adding debt allocation for stability.`;
            case 'MISLEADING_POSITIVE_GAIN':
                return `Your current holdings show an unrealised gain of ₹${(anomaly.dataPoints.unrealisedGain as number).toLocaleString('en-IN')}, but factoring in past redemptions, your lifetime P&L is -₹${Math.abs(anomaly.dataPoints.lifetimePnL as number).toLocaleString('en-IN')}. The portfolio looks green today but has lost money overall.`;
            case 'NO_INDEX_FUNDS':
                return 'Your portfolio has no index funds. Low-cost index funds (e.g. Nifty 50, Nifty Next 50) consistently outperform most active funds over long periods while charging significantly lower fees.';
            case 'GOLD_BEATING_EQUITY':
                return `Your gold/commodity fund is outperforming all equity picks. This could signal that your equity fund selection needs review — a passive commodity shouldn't consistently beat actively managed equity.`;
            case 'TOO_MANY_FUNDS':
                return `With ${anomaly.dataPoints.activeFunds} active funds, you likely have significant overlap and are paying extra fees for near-identical exposure. Most experts recommend 3-4 well-chosen funds for optimal diversification without redundancy.`;
            case 'STATEMENT_SNAPSHOT_MISMATCH':
                return `The total market value on your CAMS statement (₹${(anomaly.dataPoints.statementMarketValue as number).toLocaleString('en-IN')}) differs by ${anomaly.dataPoints.divergencePct}% from the computed value. You may have holdings outside CAMS (demat, KFintech) that aren't captured here.`;
            default:
                return anomaly.title;
        }
    }
}
