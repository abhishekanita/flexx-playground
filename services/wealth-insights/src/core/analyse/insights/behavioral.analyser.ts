/**
 * Behavioral Analyser — pre-computes investment behavior signals from transaction data.
 *
 * Pure computation, no LLM. The output feeds into the narrative generator
 * for human-readable interpretation.
 */

import { MFDetailedStatementData } from '@/types/statements/mf-statements.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { parseDate, daysBetween } from '../helpers/financial-math';

// ─── Output Types ────────────────────────────────────────────────────────────

export interface BehavioralSignals {
    investmentCadence: InvestmentCadence;
    amountPatterns: AmountPatterns;
    timingSignals: TimingSignals;
    emotionalSignals: EmotionalSignals;
    diversificationBehavior: DiversificationBehavior;
}

export interface InvestmentCadence {
    totalPurchases: number;
    totalRedemptions: number;
    avgDaysBetweenPurchases: number;
    stdDevDays: number;
    longestGapDays: number;
    longestGapPeriod: { from: string; to: string } | null;
    shortestGapDays: number;
    investmentMonths: number; // total months with at least one purchase
    totalMonthsInRange: number;
    consistencyScore: number; // 0-100, how regularly they invest
}

export interface AmountPatterns {
    avgPurchaseAmount: number;
    medianPurchaseAmount: number;
    minPurchaseAmount: number;
    maxPurchaseAmount: number;
    roundNumberBias: number; // 0-1, fraction of amounts that are round numbers
    increasingTrend: boolean; // are amounts increasing over time?
    trendDirection: 'increasing' | 'decreasing' | 'stable';
    totalPurchaseAmount: number;
    totalRedemptionAmount: number;
}

export interface TimingSignals {
    /** Purchases made when the scheme NAV was within 10% of its lowest recorded NAV in the portfolio */
    purchasesDuringDips: number;
    /** Purchases made when the scheme NAV was within 10% of its highest recorded NAV */
    purchasesDuringPeaks: number;
    /** Redemptions made when NAV was near lows — potential panic selling */
    redemptionsDuringDips: number;
    totalPurchasesWithNAV: number;
    dipBuyerScore: number; // 0-100
    peakBuyerScore: number; // 0-100
}

export interface EmotionalSignals {
    panicSelling: PanicSellEvent[];
    fomoChasing: FomoChaseEvent[];
    lossAversion: LossAversionSignal[];
}

export interface PanicSellEvent {
    scheme: string;
    date: string;
    navAtSale: number;
    avgPurchaseNav: number;
    navDropPct: number; // how far below avg purchase NAV
}

export interface FomoChaseEvent {
    scheme: string;
    date: string;
    navAtPurchase: number;
    priorMaxNav: number;
    nearPeakPct: number; // how close to the peak NAV
}

export interface LossAversionSignal {
    scheme: string;
    holdingMonthsAtLoss: number;
    unrealisedLossPct: number;
    stillHolding: boolean;
}

export interface DiversificationBehavior {
    fundHousesUsed: number;
    schemesInvested: number;
    activeSchemesNow: number;
    avgSchemesPerFundHouse: number;
    newFundFrequency: string; // "one new fund every X months"
}

// ─── Analyser ────────────────────────────────────────────────────────────────

export class BehavioralAnalyser {
    static analyse(
        data: MFDetailedStatementData,
        analysis: PortfolioAnalysis,
    ): BehavioralSignals {
        return {
            investmentCadence: this.computeCadence(data),
            amountPatterns: this.computeAmountPatterns(data),
            timingSignals: this.computeTimingSignals(data),
            emotionalSignals: this.computeEmotionalSignals(data),
            diversificationBehavior: this.computeDiversification(data),
        };
    }

    // ─── Investment Cadence ──────────────────────────────────────────────

    private static computeCadence(data: MFDetailedStatementData): InvestmentCadence {
        // Collect all purchase dates (sorted)
        const purchaseDates: string[] = [];
        const redemptionCount = { count: 0 };

        for (const folio of data.folios) {
            for (const tx of folio.transactions) {
                if (tx.amount !== null && tx.amount > 0 && ['Purchase', 'SIP', 'NFO Allotment', 'Switch In', 'STP In'].includes(tx.type)) {
                    purchaseDates.push(tx.date);
                }
                if (tx.amount !== null && tx.amount < 0 || ['Redemption', 'SIP Redemption', 'SWP', 'Switch Out', 'STP Out'].includes(tx.type)) {
                    redemptionCount.count++;
                }
            }
        }

        purchaseDates.sort();
        const totalPurchases = purchaseDates.length;
        const totalRedemptions = redemptionCount.count;

        if (totalPurchases < 2) {
            return {
                totalPurchases,
                totalRedemptions,
                avgDaysBetweenPurchases: 0,
                stdDevDays: 0,
                longestGapDays: 0,
                longestGapPeriod: null,
                shortestGapDays: 0,
                investmentMonths: totalPurchases,
                totalMonthsInRange: 1,
                consistencyScore: totalPurchases > 0 ? 10 : 0,
            };
        }

        // Compute gaps between consecutive purchases
        const gaps: number[] = [];
        let longestGap = 0;
        let longestGapFrom = '';
        let longestGapTo = '';
        let shortestGap = Infinity;

        for (let i = 1; i < purchaseDates.length; i++) {
            const gap = daysBetween(parseDate(purchaseDates[i - 1]), parseDate(purchaseDates[i]));
            gaps.push(gap);
            if (gap > longestGap) {
                longestGap = gap;
                longestGapFrom = purchaseDates[i - 1];
                longestGapTo = purchaseDates[i];
            }
            if (gap < shortestGap) shortestGap = gap;
        }

        const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const variance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
        const stdDev = Math.sqrt(variance);

        // Count unique investment months
        const monthSet = new Set(purchaseDates.map((d) => d.slice(0, 7)));
        const investmentMonths = monthSet.size;

        // Total months in investment range
        const firstDate = parseDate(purchaseDates[0]);
        const lastDate = parseDate(purchaseDates[purchaseDates.length - 1]);
        const totalMonthsInRange = Math.max(1,
            (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
            (lastDate.getMonth() - firstDate.getMonth()) + 1,
        );

        // Consistency score: what % of months had at least one purchase
        const consistencyScore = Math.round((investmentMonths / totalMonthsInRange) * 100);

        return {
            totalPurchases,
            totalRedemptions,
            avgDaysBetweenPurchases: Math.round(avgGap),
            stdDevDays: Math.round(stdDev),
            longestGapDays: longestGap,
            longestGapPeriod: longestGapFrom ? { from: longestGapFrom, to: longestGapTo } : null,
            shortestGapDays: shortestGap === Infinity ? 0 : shortestGap,
            investmentMonths,
            totalMonthsInRange,
            consistencyScore,
        };
    }

    // ─── Amount Patterns ────────────────────────────────────────────────

    private static computeAmountPatterns(data: MFDetailedStatementData): AmountPatterns {
        const purchaseAmounts: { date: string; amount: number }[] = [];
        let totalRedemption = 0;

        for (const folio of data.folios) {
            for (const tx of folio.transactions) {
                if (tx.amount !== null && tx.amount > 0 && ['Purchase', 'SIP', 'NFO Allotment'].includes(tx.type)) {
                    purchaseAmounts.push({ date: tx.date, amount: tx.amount });
                }
                if (tx.amount !== null && tx.amount < 0) {
                    totalRedemption += Math.abs(tx.amount);
                }
            }
        }

        if (purchaseAmounts.length === 0) {
            return {
                avgPurchaseAmount: 0,
                medianPurchaseAmount: 0,
                minPurchaseAmount: 0,
                maxPurchaseAmount: 0,
                roundNumberBias: 0,
                increasingTrend: false,
                trendDirection: 'stable',
                totalPurchaseAmount: 0,
                totalRedemptionAmount: totalRedemption,
            };
        }

        const amounts = purchaseAmounts.map((p) => p.amount);
        const sorted = [...amounts].sort((a, b) => a - b);
        const total = amounts.reduce((s, a) => s + a, 0);

        // Median
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];

        // Round number bias: check if amounts are approximately round (within 0.1% to account for stamp duty)
        const roundCount = amounts.filter((a) => {
            // Check if amount is within 0.1% of a multiple of 500
            const nearest500 = Math.round(a / 500) * 500;
            return Math.abs(a - nearest500) / nearest500 < 0.001;
        }).length;
        const roundNumberBias = roundCount / amounts.length;

        // Trend: compare average of first half vs second half
        const halfIdx = Math.floor(purchaseAmounts.length / 2);
        let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
        if (purchaseAmounts.length >= 4) {
            // Sort by date for trend analysis
            const byDate = [...purchaseAmounts].sort((a, b) => a.date.localeCompare(b.date));
            const firstHalfAvg = byDate.slice(0, halfIdx).reduce((s, p) => s + p.amount, 0) / halfIdx;
            const secondHalfAvg = byDate.slice(halfIdx).reduce((s, p) => s + p.amount, 0) / (byDate.length - halfIdx);
            const changePct = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
            if (changePct > 15) trendDirection = 'increasing';
            else if (changePct < -15) trendDirection = 'decreasing';
        }

        return {
            avgPurchaseAmount: Math.round(total / amounts.length),
            medianPurchaseAmount: Math.round(median),
            minPurchaseAmount: sorted[0],
            maxPurchaseAmount: sorted[sorted.length - 1],
            roundNumberBias: Math.round(roundNumberBias * 100) / 100,
            increasingTrend: trendDirection === 'increasing',
            trendDirection,
            totalPurchaseAmount: Math.round(total),
            totalRedemptionAmount: Math.round(totalRedemption),
        };
    }

    // ─── Timing Signals ─────────────────────────────────────────────────

    private static computeTimingSignals(data: MFDetailedStatementData): TimingSignals {
        let purchasesDuringDips = 0;
        let purchasesDuringPeaks = 0;
        let redemptionsDuringDips = 0;
        let totalPurchasesWithNAV = 0;

        for (const folio of data.folios) {
            // Collect all NAVs for this scheme to determine range
            const navs = folio.transactions
                .filter((tx) => tx.nav !== null && tx.nav > 0)
                .map((tx) => tx.nav!);

            if (navs.length < 3) continue;

            const minNav = Math.min(...navs);
            const maxNav = Math.max(...navs);
            const navRange = maxNav - minNav;
            if (navRange <= 0) continue;

            const dipThreshold = minNav + navRange * 0.2; // bottom 20%
            const peakThreshold = maxNav - navRange * 0.2; // top 20%

            for (const tx of folio.transactions) {
                if (tx.nav === null || tx.nav <= 0) continue;

                const isPurchase = tx.amount !== null && tx.amount > 0 &&
                    ['Purchase', 'SIP', 'NFO Allotment'].includes(tx.type);
                const isRedemption = ['Redemption', 'SIP Redemption', 'SWP'].includes(tx.type);

                if (isPurchase) {
                    totalPurchasesWithNAV++;
                    if (tx.nav <= dipThreshold) purchasesDuringDips++;
                    if (tx.nav >= peakThreshold) purchasesDuringPeaks++;
                }

                if (isRedemption && tx.nav <= dipThreshold) {
                    redemptionsDuringDips++;
                }
            }
        }

        const dipBuyerScore = totalPurchasesWithNAV > 0
            ? Math.round((purchasesDuringDips / totalPurchasesWithNAV) * 100)
            : 0;
        const peakBuyerScore = totalPurchasesWithNAV > 0
            ? Math.round((purchasesDuringPeaks / totalPurchasesWithNAV) * 100)
            : 0;

        return {
            purchasesDuringDips,
            purchasesDuringPeaks,
            redemptionsDuringDips,
            totalPurchasesWithNAV,
            dipBuyerScore,
            peakBuyerScore,
        };
    }

    // ─── Emotional Signals ──────────────────────────────────────────────

    private static computeEmotionalSignals(data: MFDetailedStatementData): EmotionalSignals {
        const panicSelling: PanicSellEvent[] = [];
        const fomoChasing: FomoChaseEvent[] = [];
        const lossAversion: LossAversionSignal[] = [];

        for (const folio of data.folios) {
            const purchases = folio.transactions.filter(
                (tx) => tx.amount !== null && tx.amount > 0 && ['Purchase', 'SIP'].includes(tx.type) && tx.nav !== null,
            );
            const redemptions = folio.transactions.filter(
                (tx) => ['Redemption', 'SIP Redemption', 'SWP'].includes(tx.type) && tx.nav !== null,
            );

            if (purchases.length === 0) continue;

            // Average purchase NAV (cost basis proxy)
            const avgPurchaseNav = purchases.reduce((s, tx) => s + tx.nav!, 0) / purchases.length;

            // Track running max NAV to detect FOMO
            let runningMaxNav = 0;
            const sortedTxs = [...folio.transactions]
                .filter((tx) => tx.nav !== null && tx.nav > 0)
                .sort((a, b) => a.date.localeCompare(b.date));

            for (const tx of sortedTxs) {
                const isPurchase = tx.amount !== null && tx.amount > 0 && ['Purchase', 'SIP'].includes(tx.type);
                // Check FOMO before updating running max — compare against prior high, not current
                // Only count if we have meaningful price history (at least 5 prior data points)
                if (isPurchase && runningMaxNav > 0 && tx.type === 'Purchase') {
                    const priorTxCount = sortedTxs.filter((t) => t.date < tx.date).length;
                    const nearPeakPct = (tx.nav! / runningMaxNav) * 100;
                    // If buying at/above prior ATH with enough history to be meaningful
                    if (nearPeakPct >= 98 && priorTxCount >= 5) {
                        fomoChasing.push({
                            scheme: folio.scheme.current_name,
                            date: tx.date,
                            navAtPurchase: tx.nav!,
                            priorMaxNav: runningMaxNav,
                            nearPeakPct: Math.round(nearPeakPct * 10) / 10,
                        });
                    }
                }
                // Update running max AFTER the check
                if (tx.nav! > runningMaxNav) runningMaxNav = tx.nav!;
            }

            // Panic selling: redemption when NAV is significantly below avg purchase NAV
            for (const tx of redemptions) {
                const navDropPct = ((avgPurchaseNav - tx.nav!) / avgPurchaseNav) * 100;
                if (navDropPct > 5) {
                    panicSelling.push({
                        scheme: folio.scheme.current_name,
                        date: tx.date,
                        navAtSale: tx.nav!,
                        avgPurchaseNav: Math.round(avgPurchaseNav * 100) / 100,
                        navDropPct: Math.round(navDropPct * 10) / 10,
                    });
                }
            }

            // Loss aversion: holding a losing position for a long time
            if (folio.closingUnitBalance > 0 && folio.snapshot.marketValue < folio.snapshot.totalCostValue) {
                const firstTx = folio.transactions[0];
                const holdingMonths = firstTx
                    ? Math.round(daysBetween(parseDate(firstTx.date), new Date()) / 30.44)
                    : 0;
                const lossPct = ((folio.snapshot.totalCostValue - folio.snapshot.marketValue) / folio.snapshot.totalCostValue) * 100;

                if (holdingMonths > 6 && lossPct > 3) {
                    lossAversion.push({
                        scheme: folio.scheme.current_name,
                        holdingMonthsAtLoss: holdingMonths,
                        unrealisedLossPct: Math.round(lossPct * 10) / 10,
                        stillHolding: true,
                    });
                }
            }
        }

        return { panicSelling, fomoChasing, lossAversion };
    }

    // ─── Diversification Behavior ───────────────────────────────────────

    private static computeDiversification(data: MFDetailedStatementData): DiversificationBehavior {
        const fundHouses = new Set<string>();
        const schemes = new Set<string>();
        let activeSchemes = 0;

        for (const folio of data.folios) {
            fundHouses.add(folio.fundHouse);
            schemes.add(folio.scheme.isin || folio.scheme.current_name);
            if (folio.closingUnitBalance > 0) activeSchemes++;
        }

        // Calculate how often they add a new fund
        const firstDates: string[] = [];
        for (const folio of data.folios) {
            const first = folio.transactions[0];
            if (first) firstDates.push(first.date);
        }
        firstDates.sort();

        let newFundFrequency = 'N/A';
        if (firstDates.length >= 2) {
            const totalDays = daysBetween(parseDate(firstDates[0]), parseDate(firstDates[firstDates.length - 1]));
            const monthsPerFund = totalDays / 30.44 / (firstDates.length - 1);
            if (monthsPerFund < 1.5) newFundFrequency = `every month`;
            else if (monthsPerFund < 4) newFundFrequency = `every ${Math.round(monthsPerFund)} months`;
            else if (monthsPerFund < 12) newFundFrequency = `every ${Math.round(monthsPerFund)} months`;
            else newFundFrequency = `about once a year`;
        }

        return {
            fundHousesUsed: fundHouses.size,
            schemesInvested: schemes.size,
            activeSchemesNow: activeSchemes,
            avgSchemesPerFundHouse: Math.round((schemes.size / fundHouses.size) * 10) / 10,
            newFundFrequency,
        };
    }
}
