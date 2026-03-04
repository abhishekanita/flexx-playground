export * from './dashboard-data.type';
export * from './insight-cards.type';

export interface MFInsightsResponse {
    pan: string;
    email: string;
    version: number;
    generatedAt: string;
    trigger: 'initial' | 'sync' | 'scheduled' | 'manual';
    dashboardData: import('./dashboard-data.type').DashboardData;
    insightCards: import('./insight-cards.type').InsightCardsResult | null;
    insightCardsStatus: 'pending' | 'ready' | 'failed';
    nextScheduledRefresh: string;
    llmCostUsd: number;
}
