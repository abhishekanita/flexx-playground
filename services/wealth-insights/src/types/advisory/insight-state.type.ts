export type InsightStatus = 'PENDING' | 'READY' | 'SHOWN' | 'DISMISSED' | 'SNOOZED';

export type InsightCategory = 'health' | 'tax' | 'behavioral' | 'whatif';

export type InsightFrequency = 'ONCE' | 'TRIGGERED' | 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';

export type InsightKey =
    // Health (9)
    | 'regular_plan_cost'
    | 'overlap_warning'
    | 'fund_house_concentration'
    | 'no_nominees'
    | 'fund_manager_change'
    | 'benchmark_weekly'
    | 'best_worst_fund_weekly'
    | 'risk_reward_monthly'
    | 'asset_allocation_drift'
    // Tax (4)
    | 'ltcg_boundary_30d'
    | 'ltcg_exemption_80pct'
    | 'tax_harvest_seasonal'
    | 'elss_unlock_30d'
    // Behavioral (5)
    | 'investor_profile'
    | 'market_crash_behavioral'
    | 'sip_missed'
    | 'portfolio_neglect'
    | 'too_many_funds';

export interface InsightState {
    pan: string;
    insightKey: InsightKey;
    category: InsightCategory;
    frequencyType: InsightFrequency;
    status: InsightStatus;
    conditionMet: boolean;
    conditionValue: any;
    relevanceScore: number; // 0-100
    firstTriggeredAt: Date | null;
    lastEvaluatedAt: Date;
    shownAt: Date | null;
    dismissedAt: Date | null;
    snoozeUntil: Date | null;
    cardJourneyId: string | null;
}

export interface ConditionResult {
    met: boolean;
    value: any;
    score: number; // relevance score 0-100
}
