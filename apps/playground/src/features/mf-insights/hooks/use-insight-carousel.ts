import { useState, useCallback } from 'react';
import type { InsightCard } from '../types';

export function useInsightCarousel(cards: InsightCard[]) {
    const [activeIndex, setActiveIndex] = useState(0);

    const next = useCallback(() => {
        setActiveIndex(i => (i + 1) % cards.length);
    }, [cards.length]);

    const prev = useCallback(() => {
        setActiveIndex(i => (i - 1 + cards.length) % cards.length);
    }, [cards.length]);

    return {
        activeIndex,
        activeCard: cards[activeIndex],
        next,
        prev,
        total: cards.length,
    };
}
