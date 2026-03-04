/**
 * Fund Change Trigger — fires when a fund's expense ratio or fund manager
 * has changed compared to previously known values.
 */

import { InsightCard } from '@/types/analysis/insight-cards.type';
import { FundMetadata } from '@/types/analysis/enrichment.type';

export interface FundChangeContext {
    currentMetadata: Map<string, FundMetadata>;
    previousMetadata: Map<string, FundMetadata>;
}

export function evaluateFundChanges(context: FundChangeContext): InsightCard[] {
    const cards: InsightCard[] = [];

    for (const [isin, current] of context.currentMetadata) {
        const previous = context.previousMetadata.get(isin);
        if (!previous) continue;

        // Check expense ratio change
        if (
            current.expenseRatio != null &&
            previous.expenseRatio != null &&
            Math.abs(current.expenseRatio - previous.expenseRatio) > 0.05
        ) {
            const increased = current.expenseRatio > previous.expenseRatio;
            const diff = Math.abs(current.expenseRatio - previous.expenseRatio);

            cards.push({
                id: `expense-change-${isin}`,
                type: 'risk',
                sentiment: increased ? 'warning' : 'positive',
                priority: increased ? 4 : 7,
                emoji: increased ? '📈' : '📉',
                title: increased ? '**Expense Ratio Up**' : '**Expense Ratio Down**',
                headline: `**${current.shortName || current.name}** expense ratio ${increased ? 'increased' : 'decreased'} by **${diff.toFixed(2)}%**`,
                context: increased
                    ? `Now at **${current.expenseRatio.toFixed(2)}%** (was ${previous.expenseRatio.toFixed(2)}%). *Higher costs eat into your returns.*`
                    : `Now at **${current.expenseRatio.toFixed(2)}%** (was ${previous.expenseRatio.toFixed(2)}%). *Good news — lower costs mean better returns.*`,
                tags: [
                    { label: 'Current', value: `${current.expenseRatio.toFixed(2)}%` },
                    { label: 'Previous', value: `${previous.expenseRatio.toFixed(2)}%` },
                ],
            });
        }

        // Check fund manager change
        if (
            current.fundManager &&
            previous.fundManager &&
            current.fundManager !== previous.fundManager
        ) {
            cards.push({
                id: `manager-change-${isin}`,
                type: 'risk',
                sentiment: 'warning',
                priority: 3,
                emoji: '👤',
                title: '**New Fund Manager**',
                headline: `**${current.shortName || current.name}** has a new fund manager: **${current.fundManager}**`,
                context: `Previously managed by **${previous.fundManager}**. *Fund manager changes can affect investment strategy and performance. Worth monitoring.*`,
                action: {
                    label: 'Review fund',
                    type: 'review',
                },
                tags: [
                    { label: 'New', value: current.fundManager.split(',')[0] },
                    { label: 'Previous', value: previous.fundManager.split(',')[0] },
                ],
            });
        }
    }

    return cards;
}
