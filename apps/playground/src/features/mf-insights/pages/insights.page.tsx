import { Skeleton } from '@/components/ui/skeleton';
import { useMFInsights } from '../hooks/use-mf-insights';
import { InsightCardComponent } from '../components/insight-card';
import { LearnSheet } from '../components/learn-sheet';
import { MD } from '../components/md';
import { BentoCard } from '../components/bento-card';
import { useState } from 'react';
import { cn } from '@/utils/utils';
import type { InsightCard, LearnAbout } from '../types';

function InsightsSkeleton() {
    return (
        <div className="space-y-5">
            <Skeleton className="h-16 w-full rounded-2xl" />
            <Skeleton className="h-9 w-80 rounded-full" />
            <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-32 rounded-2xl" />
                ))}
            </div>
        </div>
    );
}

const FILTER_TABS: { value: string; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'action', label: 'Actions' },
    { value: 'performance', label: 'Returns' },
    { value: 'risk', label: 'Risk' },
    { value: 'behavior', label: 'Habits' },
    { value: 'fun_fact', label: 'Fun' },
];

export const MFInsightsPage = () => {
    const { data, isLoading, error } = useMFInsights();
    const [activeTab, setActiveTab] = useState('all');
    const [learnOpen, setLearnOpen] = useState(false);
    const [activeLlearn, setActiveLearn] = useState<LearnAbout | null>(null);

    const insightCards = data?.insightCards;
    const status = data?.insightCardsStatus;

    const filteredCards = activeTab === 'all' ? insightCards?.cards || [] : (insightCards?.cards || []).filter(c => c.type === activeTab);

    const handleLearnClick = (card: InsightCard) => {
        if (card.learnAbout) {
            setActiveLearn(card.learnAbout);
            setLearnOpen(true);
        }
    };

    return (
        <div className="mx-auto max-w-5xl px-6 py-8 pb-20">
            {isLoading && <InsightsSkeleton />}

            {error && (
                <div className="text-center py-20">
                    <p className="text-sm text-muted-foreground">Failed to load insights.</p>
                </div>
            )}

            {status === 'failed' && (
                <div className="rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 shadow-sm px-5 py-4 mb-6">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                        AI insights are temporarily unavailable. Your dashboard data is still up to date.
                    </p>
                </div>
            )}

            {insightCards && (
                <div className="space-y-6">
                    {/* Greeting */}
                    <BentoCard variant="glass" className="px-7 py-6 relative overflow-hidden" index={0}>
                        <div
                            className="absolute -top-10 -left-10 w-40 h-40 pointer-events-none"
                            style={{
                                background: 'radial-gradient(circle, var(--mf-accent-light) 0%, transparent 70%)',
                                filter: 'blur(30px)',
                                opacity: 0.5,
                            }}
                        />
                        <p className="text-lg font-medium leading-relaxed text-foreground relative z-10">
                            <MD text={insightCards.greeting} accentColor="var(--mf-accent)" />
                        </p>
                    </BentoCard>

                    {/* Filter pills */}
                    <div className="flex items-center gap-1.5">
                        {FILTER_TABS.map(tab => (
                            <button
                                key={tab.value}
                                onClick={() => setActiveTab(tab.value)}
                                className={cn(
                                    'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200',
                                    activeTab === tab.value
                                        ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(22,163,74,0.3)]'
                                        : 'bg-black/[0.03] dark:bg-white/[0.04] text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.07] hover:text-foreground'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Cards in 2-column grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {filteredCards.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8 col-span-2">
                                No {activeTab === 'all' ? '' : activeTab} insights available.
                            </p>
                        ) : (
                            filteredCards.map((card, i) => (
                                <InsightCardComponent key={card.id} card={card} index={i} onLearnClick={handleLearnClick} />
                            ))
                        )}
                    </div>
                </div>
            )}

            <LearnSheet open={learnOpen} onOpenChange={setLearnOpen} learn={activeLlearn} />
        </div>
    );
};
