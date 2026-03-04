import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import { type InsightCard } from '../types';
import { MD } from './md';
import { useInsightCarousel } from '../hooks/use-insight-carousel';
import { motion, AnimatePresence } from 'framer-motion';

const THIINGS_ASSETS: Record<string, string> = {
    action: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-VssSUjp7tvqQZndCA7aaNBblydpBgj.png',
    performance: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-N2VKG116RCdDw9OKcmRO31lthC6Qfs.png',
    risk: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-bvJNHPc0tIkrnBQsWtfPI7Q1YIE9xO.png',
    behavior: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-wR97oa2oyE4tW0CcBRTiXIOlYmMjgQ.png',
    anomaly: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-BUu3px8U3JxbyXYYI2KTTnpDzXw5pJ.png',
    fun_fact: 'https://lftz25oez4aqbxpq.public.blob.vercel-storage.com/image-j9arIG3g0ZmjLgMFShdezTSMXVwXtC.png',
};

export function InsightSpotlight({ cards }: { cards: InsightCard[] }) {
    const { activeCard, activeIndex, next, prev, total } = useInsightCarousel(cards);

    if (!activeCard) return null;

    const assetUrl = THIINGS_ASSETS[activeCard.type] || THIINGS_ASSETS.fun_fact;

    return (
        <div className="rounded-xl bg-zinc-950 p-6 h-full flex flex-col justify-between border border-white/[0.06] relative overflow-hidden">
            {/* Atmospheric green edge glow */}
            <div
                className="absolute -bottom-1/2 -left-1/4 w-3/4 h-full pointer-events-none"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.06) 0%, transparent 70%)',
                    filter: 'blur(40px)',
                }}
            />

            {/* Content */}
            <div className="relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img src={assetUrl} alt={activeCard.type} className="w-7 h-7 rounded-full bg-white p-1 object-contain shrink-0" />
                        <p className="text-[12px] font-medium text-white/60 uppercase tracking-wider">{activeCard.type.replace('_', ' ')}</p>
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIndex}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {activeCard.highlightMetric ? (
                            <>
                                <div className="mt-8">
                                    <div className="flex items-end gap-2.5">
                                        <h2 className="text-[48px] font-medium tracking-tighter text-white leading-none">
                                            {activeCard.highlightMetric.value}
                                        </h2>
                                        {activeCard.highlightMetric.trend === 'up' && <TrendingUp className="size-5 text-emerald-400/80 mb-2" />}
                                        {activeCard.highlightMetric.trend === 'down' && <TrendingDown className="size-5 text-red-400/80 mb-2" />}
                                        {activeCard.highlightMetric.trend === 'neutral' && <Minus className="size-5 text-white/30 mb-2" />}
                                    </div>
                                </div>

                                <h3 className="text-[16px] font-medium leading-snug tracking-tight text-white/85 mt-5">
                                    <MD text={activeCard.title} />
                                </h3>

                                <p className="text-[13px] leading-relaxed text-white/40 mt-3 line-clamp-3">
                                    <MD text={activeCard.headline} />
                                </p>
                            </>
                        ) : (
                            <>
                                <div className="mt-6 mb-2 flex items-center justify-center">
                                    <img src={assetUrl} alt={activeCard.type} className="w-20 h-20 object-contain drop-shadow-lg opacity-80" />
                                </div>

                                <h3 className="text-[20px] font-medium leading-snug tracking-tight text-white/85 mt-4">
                                    <MD text={activeCard.title} />
                                </h3>

                                <p className="text-[13px] leading-relaxed text-white/40 mt-3 line-clamp-4">
                                    <MD text={activeCard.headline} />
                                </p>
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Footer pagination */}
            <div className="flex items-center justify-between mt-6 pt-2 relative z-10">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/30 hover:text-white/80 hover:bg-white/5 rounded-full transition-colors"
                    onClick={e => {
                        e.stopPropagation();
                        prev();
                    }}
                >
                    <ChevronLeft className="size-4" />
                </Button>

                <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(total, 7) }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-[2px] rounded-full transition-all duration-300 ${i === activeIndex ? 'w-5 bg-white/80' : 'w-2.5 bg-white/15'}`}
                        />
                    ))}
                </div>

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-white/30 hover:text-white/80 hover:bg-white/5 rounded-full transition-colors"
                    onClick={e => {
                        e.stopPropagation();
                        next();
                    }}
                >
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
