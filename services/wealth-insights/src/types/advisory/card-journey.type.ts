export type CardSlot = 'answer' | 'education' | 'your_data' | 'impact' | 'action';

export type LiveBindingFormat = 'currency' | 'percent' | 'number' | 'date' | 'text';

export interface LiveBinding {
    path: string;
    format: LiveBindingFormat;
    fallback: string;
}

export interface JourneyCard {
    slot: CardSlot;
    title: string;
    body: string; // supports {{placeholder}} tokens
    liveBindings?: Record<string, LiveBinding>;
    highlightValue?: string;
    highlightLabel?: string;
}

export interface CardJourney {
    pan: string;
    insightKey: string;
    cards: JourneyCard[];
    assembledAt: Date;
    snapshotValues: Record<string, any>;
}

export interface JourneyTemplate {
    insightKey: string;
    build: (conditionValue: any) => {
        cards: JourneyCard[];
        snapshotValues: Record<string, any>;
    };
}
