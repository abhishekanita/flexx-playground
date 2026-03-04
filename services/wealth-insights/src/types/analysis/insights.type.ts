// Re-export new InsightCards types
export { InsightCardsResult, InsightCard, LearnAbout } from './insight-cards.type';

export interface LLMInsightsResult {
    headline: string;
    performanceStory: string;
    holdingInsights: HoldingInsight[];
    behavioralObservation: string;
    whatIfNarratives: WhatIfNarrative[];
    riskExplanation: string;
    anomalies: AnomalyInsight[];
}

export interface HoldingInsight {
    schemeName: string;
    insight: string;
}

export interface WhatIfNarrative {
    scenarioId: string;
    narrative: string;
}

export interface AnomalyInsight {
    severity: 'critical' | 'warning' | 'info';
    category: 'compliance' | 'risk' | 'opportunity' | 'operational';
    title: string;
    explanation: string;
}

// ─── Recurring Insights ─────────────────────────────────────────────────────

export interface DailyInsight {
    date: string;
    type: 'portfolio_move' | 'scheme_high' | 'scheme_low' | 'market_event';
    title: string;
    detail: string;
    dataPoints: Record<string, string | number>;
}

export interface WeeklyInsight {
    weekEnding: string;
    type: 'category_rank_change' | 'aum_flow' | 'rating_change' | 'new_fund_launch';
    title: string;
    detail: string;
    dataPoints: Record<string, string | number>;
}

export interface MonthlyInsight {
    month: string;
    type: 'manager_change' | 'holdings_update' | 'rebalance_check' | 'ltcg_exemption' | 'ter_change';
    title: string;
    detail: string;
    dataPoints: Record<string, string | number>;
}
