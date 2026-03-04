/**
 * NAV Milestone Trigger — fires when a user's scheme NAV hits an all-time high.
 */

import { InsightCard } from '@/types/analysis/insight-cards.type';
import { AMFIMasterProvider } from '../../enrichment/amfi-master.provider';
import { NAVProvider } from '../../enrichment/nav.provider';

export interface InsightTrigger {
    id: string;
    frequency: 'daily' | 'weekly' | 'monthly';
    evaluate(context: TriggerContext): Promise<InsightCard[]>;
}

export interface TriggerContext {
    schemeISINs: string[];
    amfiMaster: AMFIMasterProvider;
    navProvider: NAVProvider;
    asOfDate: string;
}

export const navMilestoneTrigger: InsightTrigger = {
    id: 'nav-milestone',
    frequency: 'daily',

    async evaluate(context: TriggerContext): Promise<InsightCard[]> {
        const cards: InsightCard[] = [];

        for (const isin of context.schemeISINs) {
            const schemeCode = context.amfiMaster.getSchemeCode(isin);
            if (!schemeCode) continue;

            const history = await context.navProvider.fetchNAVHistory(schemeCode);
            if (!history || history.navHistory.length < 30) continue;

            const navs = history.navHistory.map((p) => p.nav);
            const latestNAV = navs[navs.length - 1];
            const previousMax = Math.max(...navs.slice(0, -1));

            if (latestNAV > previousMax && previousMax > 0) {
                const pctAbove = ((latestNAV / previousMax) - 1) * 100;

                cards.push({
                    id: `nav-ath-${isin}`,
                    type: 'performance',
                    sentiment: 'positive',
                    priority: 5,
                    emoji: '🏔️',
                    title: '**All-Time High**',
                    headline: `**${history.schemeName}** just hit a new all-time high NAV of **₹${latestNAV.toFixed(2)}**`,
                    context: `That's **${pctAbove.toFixed(1)}%** above its previous peak. *A good sign for your investment.*`,
                    tags: [
                        { label: 'NAV', value: `₹${latestNAV.toFixed(2)}` },
                        { label: 'Previous Peak', value: `₹${previousMax.toFixed(2)}` },
                    ],
                });
            }
        }

        return cards;
    },
};
