/**
 * Market Event Trigger — fires when a benchmark drops > 5% recently,
 * signaling a potential buying opportunity.
 */

import { InsightCard } from '@/types/analysis/insight-cards.type';
import { BenchmarkStats } from '@/types/analysis/enrichment.type';

export interface MarketEventContext {
    benchmarks: Map<string, BenchmarkStats>;
}

const DROP_THRESHOLD = -5; // 5% drop
const LOOKBACK_DAYS = 5;

export function evaluateMarketEvents(context: MarketEventContext): InsightCard[] {
    const cards: InsightCard[] = [];

    for (const [ticker, benchmark] of context.benchmarks) {
        if (benchmark.prices.length < LOOKBACK_DAYS + 1) continue;

        const recent = benchmark.prices.slice(-LOOKBACK_DAYS - 1);
        const startPrice = recent[0].close;
        const endPrice = recent[recent.length - 1].close;

        if (startPrice <= 0) continue;

        const changePct = ((endPrice / startPrice) - 1) * 100;

        if (changePct < DROP_THRESHOLD) {
            const isDeep = changePct < -10;

            cards.push({
                id: `market-drop-${ticker}`,
                type: 'action',
                sentiment: isDeep ? 'negative' : 'warning',
                priority: isDeep ? 2 : 5,
                emoji: isDeep ? '📉' : '⚡',
                title: isDeep ? '**Market Correction**' : '**Market Dip**',
                headline: `**${benchmark.name}** dropped **${Math.abs(changePct).toFixed(1)}%** in the last ${LOOKBACK_DAYS} trading days`,
                context: isDeep
                    ? `Corrections of this magnitude are *uncommon*. If your investment horizon is long, this could be a *buying opportunity*. Don't panic sell.`
                    : `A **${Math.abs(changePct).toFixed(1)}%** dip is within normal volatility. *Consider adding to your SIPs if you have surplus funds.*`,
                action: {
                    label: isDeep ? 'Consider investing more' : 'Review SIPs',
                    type: isDeep ? 'act_now' : 'explore',
                    urgent: isDeep,
                },
                tags: [
                    { label: 'Index', value: benchmark.name },
                    { label: 'Drop', value: `${changePct.toFixed(1)}%` },
                ],
            });
        }
    }

    return cards;
}
