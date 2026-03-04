import { PortfolioAnalysis } from '../analysis/analysis.type';
import { InsightCardsResult } from '../analysis/insight-cards.type';
import { DashboardData } from '../analysis/dashboard-data.type';

export interface MFUserInsights {
    pan: string;
    email: string;
    version: number;
    generatedAt: Date;
    trigger: 'initial' | 'sync' | 'scheduled' | 'manual';

    /** Pure computation -- always present */
    dashboardData: DashboardData;

    /** LLM-generated -- may be null if LLM unavailable */
    insightCards: InsightCardsResult | null;
    insightCardsStatus: 'pending' | 'ready' | 'failed';

    /** Full analysis blob */
    analysis: PortfolioAnalysis;

    /** Refresh metadata */
    nextScheduledRefresh: Date;
    llmCostUsd: number;
}
