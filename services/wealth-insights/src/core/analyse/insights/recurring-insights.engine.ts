/**
 * Recurring Insights Engine — generates time-sensitive InsightCards
 * by evaluating triggers on different schedules (daily, weekly, monthly).
 *
 * Unlike the narrative generator (LLM-based), this engine is purely
 * rule-based and deterministic. It checks market conditions, portfolio
 * state, and metadata changes to produce actionable cards.
 */

import { InsightCard } from '@/types/analysis/insight-cards.type';
import { PortfolioAnalysis } from '@/types/analysis';
import { FundMetadata, BenchmarkStats } from '@/types/analysis/enrichment.type';
import { AMFIMasterProvider } from '../enrichment/amfi-master.provider';
import { NAVProvider } from '../enrichment/nav.provider';
import { navMilestoneTrigger, TriggerContext } from './triggers/nav-milestone.trigger';
import { evaluateTaxBoundary } from './triggers/tax-boundary.trigger';
import { evaluateFundChanges } from './triggers/fund-change.trigger';
import { evaluateMarketEvents } from './triggers/market-event.trigger';

export class RecurringInsightsEngine {
    private amfiMaster: AMFIMasterProvider;
    private navProvider: NAVProvider;

    constructor(amfiMaster: AMFIMasterProvider, navProvider: NAVProvider) {
        this.amfiMaster = amfiMaster;
        this.navProvider = navProvider;
    }

    /**
     * Generate daily insights: NAV milestones, tax boundaries, market events.
     */
    async generateDailyInsights(
        schemeISINs: string[],
        lastAnalysis: PortfolioAnalysis,
        benchmarks?: Map<string, BenchmarkStats>,
    ): Promise<InsightCard[]> {
        const cards: InsightCard[] = [];
        const asOfDate = lastAnalysis.asOfDate;

        // NAV milestones (async — needs NAV history)
        const triggerContext: TriggerContext = {
            schemeISINs,
            amfiMaster: this.amfiMaster,
            navProvider: this.navProvider,
            asOfDate,
        };

        try {
            const navCards = await navMilestoneTrigger.evaluate(triggerContext);
            cards.push(...navCards);
        } catch { /* skip on failure */ }

        // Tax boundary alerts (sync)
        const taxCards = evaluateTaxBoundary({ lastAnalysis, asOfDate });
        cards.push(...taxCards);

        // Market events (sync)
        if (benchmarks && benchmarks.size > 0) {
            const marketCards = evaluateMarketEvents({ benchmarks });
            cards.push(...marketCards);
        }

        // Sort by priority (lower = more important)
        cards.sort((a, b) => a.priority - b.priority);

        return cards;
    }

    /**
     * Generate weekly insights: fund changes, SIP consistency.
     */
    async generateWeeklyInsights(
        schemeISINs: string[],
        lastAnalysis: PortfolioAnalysis,
        currentMetadata?: Map<string, FundMetadata>,
        previousMetadata?: Map<string, FundMetadata>,
    ): Promise<InsightCard[]> {
        const cards: InsightCard[] = [];

        // Fund metadata changes
        if (currentMetadata && previousMetadata) {
            const fundCards = evaluateFundChanges({ currentMetadata, previousMetadata });
            cards.push(...fundCards);
        }

        // SIP consistency check
        if (lastAnalysis.sipAnalysis) {
            for (const sip of lastAnalysis.sipAnalysis.sipSchemes) {
                if (sip.regularityScore < 70 && sip.missedMonths > 0) {
                    cards.push({
                        id: `sip-consistency-${sip.schemeName.slice(0, 20)}`,
                        type: 'behavior',
                        sentiment: 'warning',
                        priority: 6,
                        emoji: '📅',
                        title: '**SIP Consistency**',
                        headline: `You've missed **${sip.missedMonths} months** of SIP in **${sip.schemeName}**`,
                        context: `Your regularity score is **${sip.regularityScore}%**. *Consistent SIPs benefit from rupee cost averaging — even in down markets.*`,
                        action: {
                            label: 'Review SIP',
                            type: 'review',
                        },
                        tags: [
                            { label: 'Missed', value: `${sip.missedMonths} months` },
                            { label: 'Score', value: `${sip.regularityScore}%` },
                        ],
                    });
                }
            }
        }

        cards.sort((a, b) => a.priority - b.priority);
        return cards;
    }

    /**
     * Generate monthly insights: comprehensive portfolio health check signals.
     * Combines daily + weekly triggers with monthly-only checks.
     */
    async generateMonthlyInsights(
        schemeISINs: string[],
        lastAnalysis: PortfolioAnalysis,
        benchmarks?: Map<string, BenchmarkStats>,
        currentMetadata?: Map<string, FundMetadata>,
        previousMetadata?: Map<string, FundMetadata>,
    ): Promise<InsightCard[]> {
        const [dailyCards, weeklyCards] = await Promise.all([
            this.generateDailyInsights(schemeISINs, lastAnalysis, benchmarks),
            this.generateWeeklyInsights(schemeISINs, lastAnalysis, currentMetadata, previousMetadata),
        ]);

        const cards = [...dailyCards, ...weeklyCards];

        // Monthly-only: overlap warnings
        if (lastAnalysis.overlapAnalysis) {
            for (const warning of lastAnalysis.overlapAnalysis.highOverlapWarnings) {
                cards.push({
                    id: `overlap-warning-${cards.length}`,
                    type: 'risk',
                    sentiment: 'warning',
                    priority: 7,
                    emoji: '🔄',
                    title: '**Fund Overlap**',
                    headline: `**${warning}**`,
                    context: `High overlap means your diversification benefit is reduced. *Consider consolidating into fewer funds.*`,
                    action: {
                        label: 'Review overlap',
                        type: 'review',
                    },
                });
            }
        }

        // Deduplicate by card ID
        const seen = new Set<string>();
        const unique = cards.filter((c) => {
            if (seen.has(c.id)) return false;
            seen.add(c.id);
            return true;
        });

        unique.sort((a, b) => a.priority - b.priority);
        return unique;
    }
}
