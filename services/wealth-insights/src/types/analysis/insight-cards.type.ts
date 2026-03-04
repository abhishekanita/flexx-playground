/**
 * InsightCard -- the primary unit of user-facing insights.
 * Every field that contains user-visible text uses **bold** and *italic* markdown.
 * The frontend MD component renders this -- do not strip markdown from these strings.
 */

export type CardType =
    | 'performance'
    | 'behavior'
    | 'risk'
    | 'action'
    | 'fun_fact'
    | 'anomaly';

export type CardSentiment = 'positive' | 'negative' | 'warning' | 'neutral' | 'curious';

export interface LearnAbout {
    /** Short label shown on card button. Max 5 words. */
    topic: string;
    /** One-sentence teaser. Shown as tooltip or preview. */
    preview: string;
    /** Full plain-English explainer, 3-5 sentences. No jargon. */
    deepDive: string;
    /** Optional analogy that makes the concept click. */
    analogy?: string;
}

export interface HighlightMetric {
    /** Formatted value: "₹24,000" or "17.8%" or "314 days" */
    value: string;
    /** What the value means: "earned for you" / "per year in fees" */
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
    /** 1 = show first. Action cards with urgent=true -> priority 1-3. */
    priority: number;
    emoji: string;
    /** Max 5 words. Uses **bold** / *italic* markdown. */
    title: string;
    /**
     * Main insight in plain English. 1-2 sentences.
     * MUST use **bold** for key numbers and *italic* for emphasis.
     */
    headline: string;
    /**
     * Context / follow-up. 1-2 sentences.
     * Also uses **bold** / *italic* markdown.
     */
    context: string;
    highlightMetric?: HighlightMetric;
    action?: CardAction;
    learnAbout?: LearnAbout;
    /** Max 3 tag pairs shown as small chips. */
    tags?: { label: string; value: string }[];
}

export interface InsightCardsResult {
    /**
     * Personal greeting shown at screen top.
     * Uses **bold** markdown for key numbers.
     */
    greeting: string;
    /** Cards sorted by priority ascending (1 = most important). */
    cards: InsightCard[];
    /**
     * 1-line summary for home screen / push notification. Max 15 words.
     */
    homeSummary: string;
}
