/**
 * Tax Boundary Trigger — fires when a holding is approaching the LTCG boundary
 * (< 30 days until a STCG lot crosses the 12-month mark).
 */

import { InsightCard } from '@/types/analysis/insight-cards.type';
import { PortfolioAnalysis } from '@/types/analysis';

export interface TaxBoundaryContext {
    lastAnalysis: PortfolioAnalysis;
    asOfDate: string;
}

export function evaluateTaxBoundary(context: TaxBoundaryContext): InsightCard[] {
    const cards: InsightCard[] = [];
    const taxHarvesting = context.lastAnalysis.taxHarvesting;

    if (!taxHarvesting) return cards;

    for (const opp of taxHarvesting.opportunities) {
        if (opp.daysToLTCG !== null && opp.daysToLTCG > 0 && opp.daysToLTCG <= 30) {
            const urgent = opp.daysToLTCG <= 7;

            cards.push({
                id: `tax-boundary-${opp.folioNumber}`,
                type: 'action',
                sentiment: 'warning',
                priority: urgent ? 2 : 4,
                emoji: '⏰',
                title: '**LTCG Boundary**',
                headline: `**${opp.schemeName}** crosses the 1-year mark in **${opp.daysToLTCG} days**`,
                context: opp.unrealisedGain > 0
                    ? `Unrealised gain of **₹${opp.unrealisedGain.toLocaleString('en-IN')}** will shift from *20% STCG* to *12.5% LTCG* tax. ${urgent ? '*Hold tight — almost there.*' : 'Consider waiting.'}`
                    : `This lot has an unrealised loss. Selling *before* the boundary could help offset other gains at the *higher STCG rate*.`,
                action: {
                    label: urgent ? 'Hold — almost LTCG' : 'Review tax impact',
                    type: urgent ? 'act_now' : 'review',
                    urgent,
                },
                tags: [
                    { label: 'Days Left', value: String(opp.daysToLTCG) },
                    { label: 'Gain', value: `₹${opp.unrealisedGain.toLocaleString('en-IN')}` },
                ],
            });
        }
    }

    return cards;
}
