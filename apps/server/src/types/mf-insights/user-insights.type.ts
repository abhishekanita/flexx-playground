import { InsightCardsResult } from './insight-cards.type';
import { DashboardData } from './dashboard-data.type';

export interface MFUserInsights {
    pan: string;
    email: string;
    version: number;
    generatedAt: Date;
    trigger: 'initial' | 'sync' | 'scheduled' | 'manual';

    dashboardData: DashboardData;

    insightCards: InsightCardsResult | null;
    insightCardsStatus: 'pending' | 'ready' | 'failed';

    nextScheduledRefresh: Date;
    llmCostUsd: number;
}
