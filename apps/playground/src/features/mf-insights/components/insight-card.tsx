import { Button } from '@/components/ui/button';
import { type InsightCard as InsightCardType } from '../types';
import { MD } from './md';
import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BentoCard } from './bento-card';
import { cn } from '@/utils/utils';

const SENTIMENT_STYLES: Record<string, { dot: string; glow: string }> = {
    positive: { dot: 'bg-emerald-400', glow: 'rgba(16,185,129,0.06)' },
    negative: { dot: 'bg-red-400', glow: 'rgba(239,68,68,0.06)' },
    warning: { dot: 'bg-amber-400', glow: 'rgba(245,158,11,0.06)' },
    neutral: { dot: 'bg-stone-300 dark:bg-zinc-600', glow: 'rgba(120,113,108,0.04)' },
    curious: { dot: 'bg-blue-400', glow: 'rgba(59,130,246,0.06)' },
};

const THIINGS_ASSETS: Record<string, string> = {
    action: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-VssSUjp7tvqQZndCA7aaNBblydpBgj.png',
    performance: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-N2VKG116RCdDw9OKcmRO31lthC6Qfs.png',
    risk: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-bvJNHPc0tIkrnBQsWtfPI7Q1YIE9xO.png',
    behavior: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-wR97oa2oyE4tW0CcBRTiXIOlYmMjgQ.png',
    anomaly: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-BUu3px8U3JxbyXYYI2KTTnpDzXw5pJ.png',
    fun_fact: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-j9arIG3g0ZmjLgMFShdezTSMXVwXtC.png',
};

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'neutral' }) => {
    if (trend === 'up') return <TrendingUp className="size-3.5 text-emerald-600" />;
    if (trend === 'down') return <TrendingDown className="size-3.5 text-red-500" />;
    return <Minus className="size-3.5 text-muted-foreground" />;
};

export function InsightCardComponent({
    card,
    index,
    onLearnClick,
}: {
    card: InsightCardType;
    index: number;
    onLearnClick?: (card: InsightCardType) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const styles = SENTIMENT_STYLES[card.sentiment] || SENTIMENT_STYLES.neutral;
    const assetUrl = THIINGS_ASSETS[card.type] || THIINGS_ASSETS.fun_fact;

    return (
        <BentoCard
            className="cursor-pointer p-5 relative overflow-hidden"
            index={index}
            onClick={() => setExpanded(!expanded)}
        >
            {/* Sentiment atmosphere — subtle top-corner glow */}
            <div
                className="absolute -top-8 -right-8 w-32 h-32 pointer-events-none rounded-full"
                style={{
                    background: `radial-gradient(circle, ${styles.glow} 0%, transparent 70%)`,
                    filter: 'blur(20px)',
                }}
            />

            {/* Header */}
            <div className="relative z-10 flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <img src={assetUrl} alt={card.type} className="w-11 h-11 object-contain drop-shadow-md shrink-0 mt-0.5" />
                    <div className="mt-1">
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <div className={cn('size-1.5 rounded-full shrink-0', styles.dot)} />
                            <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground/60">
                                {card.type.replace('_', ' ')}
                            </p>
                        </div>
                        <h3 className="text-[15px] font-medium tracking-tight text-foreground/90 leading-snug">
                            <MD text={card.title} />
                        </h3>
                    </div>
                </div>
                {card.action?.urgent && (
                    <span className="text-[10px] font-medium text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-0.5 rounded-full ring-1 ring-inset ring-red-200/60 dark:ring-red-800/40 mt-1">
                        URGENT
                    </span>
                )}
            </div>

            {/* Headline */}
            <div className="mt-2.5 ml-[60px] relative z-10">
                <p className="text-[13px] leading-relaxed text-muted-foreground/70">
                    <MD text={card.headline} />
                </p>
            </div>

            {/* Highlight metric */}
            {card.highlightMetric && (
                <div className="inline-flex flex-col rounded-lg bg-black/[0.02] dark:bg-white/[0.03] px-4 py-2.5 mt-3 ml-[60px] border border-black/[0.04] dark:border-white/[0.04] relative z-10">
                    <div className="flex items-center gap-1.5">
                        <TrendIcon trend={card.highlightMetric.trend} />
                        <span className="font-instrument text-xl tabular-nums text-foreground/90">{card.highlightMetric.value}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 mt-0.5">{card.highlightMetric.label}</span>
                </div>
            )}

            {/* Expanded detail */}
            <div className={`overflow-hidden transition-all duration-300 ${expanded ? 'max-h-96 mt-3' : 'max-h-0'}`}>
                <div className="ml-[60px] relative z-10">
                    {card.context && (
                        <p className="text-[13px] text-muted-foreground/70 leading-relaxed mt-1">
                            <MD text={card.context} accentColor="var(--color-muted-foreground)" />
                        </p>
                    )}

                    {card.tags && card.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                            {card.tags.map(t => (
                                <span key={t.label} className="text-[11px] text-muted-foreground/70 bg-black/[0.03] dark:bg-white/[0.04] rounded-md px-2 py-0.5">
                                    <span className="font-medium">{t.label}:</span> {t.value}
                                </span>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                        {card.action && (
                            <Button
                                size="sm"
                                variant={card.action.urgent ? 'default' : 'outline'}
                                className="h-7 text-xs rounded-lg"
                                onClick={e => e.stopPropagation()}
                            >
                                {card.action.label}
                            </Button>
                        )}
                        {card.learnAbout && (
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground/60"
                                onClick={e => {
                                    e.stopPropagation();
                                    onLearnClick?.(card);
                                }}
                            >
                                Learn: {card.learnAbout.topic}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </BentoCard>
    );
}
