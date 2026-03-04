export type CardType =
    | 'performance'
    | 'behavior'
    | 'risk'
    | 'action'
    | 'fun_fact'
    | 'anomaly';

export type CardSentiment = 'positive' | 'negative' | 'warning' | 'neutral' | 'curious';

export interface LearnAbout {
    topic: string;
    preview: string;
    deepDive: string;
    analogy?: string;
}

export interface HighlightMetric {
    value: string;
    label: string;
    trend: 'up' | 'down' | 'neutral';
}

export interface CardAction {
    label: string;
    type: 'review' | 'learn' | 'act_now' | 'explore';
    urgent?: boolean;
}

export interface InsightCard {
    id: string;
    type: CardType;
    sentiment: CardSentiment;
    priority: number;
    emoji: string;
    title: string;
    headline: string;
    context: string;
    highlightMetric?: HighlightMetric;
    action?: CardAction;
    learnAbout?: LearnAbout;
    tags?: { label: string; value: string }[];
}

export interface InsightCardsResult {
    greeting: string;
    cards: InsightCard[];
    homeSummary: string;
}
