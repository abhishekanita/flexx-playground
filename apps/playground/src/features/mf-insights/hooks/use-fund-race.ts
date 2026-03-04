import { useState, useEffect } from 'react';
import { type FundRaceEntry } from '../types';

export function useFundRace(funds: FundRaceEntry[], visibleCount = 5) {
    const [animated, setAnimated] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);

    const maxGain = Math.max(...funds.map(f => Math.abs(f.gainPct)), 1);
    const hasMore = funds.length > visibleCount;
    const visible = expanded ? funds : funds.slice(0, visibleCount);

    return { animated, expanded, setExpanded, maxGain, hasMore, visible };
}
