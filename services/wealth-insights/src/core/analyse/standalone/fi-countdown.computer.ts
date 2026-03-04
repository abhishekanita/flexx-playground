/**
 * FI Countdown — "When can I stop working?"
 * Projects financial independence date based on current portfolio,
 * SIP run-rate, estimated expenses, and a 3.5% safe withdrawal rate.
 */

import { PortfolioAnalysis } from '@/types/analysis';
import { FICountdownResult, FIProjection } from '@/types/analysis/fi-countdown.type';
import { solveMonthsToTarget } from '@/core/analyse/helpers/financial-math';

const SWR = 0.035; // 3.5% Safe Withdrawal Rate for India

export function computeFICountdown(analysis: PortfolioAnalysis): FICountdownResult | null {
    const currentValue = analysis.portfolioSummary.totalMarketValue;
    const portfolioXIRR = analysis.xirrAnalysis.portfolioXIRR;

    // Guard: no meaningful data
    if (portfolioXIRR <= 0 || currentValue <= 0) return null;

    // ── Compute monthly SIP run-rate (same pattern as crorepati-countdown) ────
    let monthlySIP = 0;
    if (analysis.sipAnalysis && !analysis.sipAnalysis.isLumpsumOnly) {
        for (const scheme of analysis.sipAnalysis.sipSchemes) {
            if (scheme.sipFrequency === 'Monthly') {
                monthlySIP += scheme.sipAmount;
            } else if (scheme.sipFrequency === 'Weekly') {
                monthlySIP += scheme.sipAmount * 4;
            } else if (scheme.sipFrequency === 'Quarterly') {
                monthlySIP += scheme.sipAmount / 3;
            }
        }
    }

    // ── Monthly expenses heuristic ────────────────────────────────────────────
    let monthlyExpenses: number;
    if (monthlySIP > 0) {
        monthlyExpenses = 3 * monthlySIP; // default heuristic
    } else {
        monthlyExpenses = (currentValue * 0.04) / 12; // lumpsum fallback
    }

    // ── FI Target ─────────────────────────────────────────────────────────────
    const fiTarget = (monthlyExpenses * 12) / SWR;
    const progressPct = Math.min(100, (currentValue / fiTarget) * 100);

    // ── Build 5 projections ───────────────────────────────────────────────────
    const projections: FIProjection[] = [];
    const now = new Date();

    const scenarios: {
        label: string;
        sipDelta: number;
        rateDelta: number;
        expensesDelta: number;
        recalcTarget: boolean;
        isBear: boolean;
        isBaseline: boolean;
    }[] = [
        { label: 'Current pace', sipDelta: 0, rateDelta: 0, expensesDelta: 0, recalcTarget: false, isBear: false, isBaseline: true },
        { label: 'SIP +₹5K', sipDelta: 5000, rateDelta: 0, expensesDelta: 0, recalcTarget: false, isBear: false, isBaseline: false },
        { label: 'SIP +₹10K', sipDelta: 10000, rateDelta: 0, expensesDelta: 0, recalcTarget: false, isBear: false, isBaseline: false },
        { label: 'Expenses -₹10K', sipDelta: 0, rateDelta: 0, expensesDelta: -10000, recalcTarget: true, isBear: false, isBaseline: false },
        { label: 'Bear case', sipDelta: 0, rateDelta: -3, expensesDelta: 0, recalcTarget: false, isBear: true, isBaseline: false },
    ];

    for (const s of scenarios) {
        const sip = monthlySIP + s.sipDelta;
        const rate = portfolioXIRR + s.rateDelta;
        const expenses = monthlyExpenses + s.expensesDelta;
        const target = s.recalcTarget ? (expenses * 12) / SWR : fiTarget;

        if (rate <= 0) continue; // skip impossible projections

        const monthlyRate = Math.pow(1 + rate / 100, 1 / 12) - 1;
        let months: number;

        if (currentValue >= target) {
            months = 0;
        } else if (sip > 0) {
            months = solveMonthsToTarget(currentValue, sip, monthlyRate, target);
        } else {
            months = Math.log(target / currentValue) / Math.log(1 + monthlyRate);
        }

        if (!isFinite(months) || months > 600) continue; // >50 years, skip

        const projectedDate = new Date(now);
        projectedDate.setMonth(projectedDate.getMonth() + Math.ceil(months));

        projections.push({
            label: s.label,
            monthlySIP: Math.round(sip),
            annualRate: Math.round(rate * 100) / 100,
            monthlyExpenses: Math.round(expenses),
            fiTarget: Math.round(target),
            monthsToFI: Math.ceil(months),
            yearsToFI: Math.round((months / 12) * 10) / 10,
            projectedDate: projectedDate.toISOString().slice(0, 10),
            isBearCase: s.isBear,
            isBaseline: s.isBaseline,
        });
    }

    // Return null if all projections exceed 50 years (empty)
    if (projections.length === 0) return null;

    return {
        currentValue: Math.round(currentValue),
        monthlySIP: Math.round(monthlySIP),
        monthlyExpenses: Math.round(monthlyExpenses),
        swr: SWR,
        fiTarget: Math.round(fiTarget),
        progressPct: Math.round(progressPct * 100) / 100,
        projections,
    };
}
