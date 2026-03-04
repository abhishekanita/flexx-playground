import { Badge } from '@/components/ui/badge';
import { fmt, fmtL, fmtPct } from '../utils/formatters';
import { type DashboardData } from '../types';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { BentoCard } from './bento-card';
import { cn } from '@/utils/utils';
import { useCountUp } from '../hooks/use-count-up';

export function HeroSection({ heroStats }: { heroStats: DashboardData['heroStats'] }) {
    const currentValue = useCountUp(heroStats.currentValueRs);
    const gainValue = useCountUp(heroStats.unrealisedGainRs);
    const isPositive = heroStats.unrealisedGainRs >= 0;

    return (
        <BentoCard variant="hero" className="h-full relative overflow-hidden" index={0}>
            {/* Atmospheric green glow */}
            <div
                className="absolute -top-1/3 -left-1/4 w-3/4 h-[160%] pointer-events-none z-0"
                style={{
                    background: 'radial-gradient(ellipse at center, var(--mf-accent-light) 0%, transparent 70%)',
                    opacity: 0.45,
                    filter: 'blur(50px)',
                }}
            />
            <div
                className="absolute -top-1/3 -left-1/4 w-3/4 h-[160%] pointer-events-none z-0 hidden dark:block"
                style={{
                    background: 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.07) 0%, transparent 70%)',
                    filter: 'blur(50px)',
                }}
            />

            <div className="relative z-10 flex flex-col pt-8 px-8 pb-6 h-full">
                {/* Portfolio Value — dominant */}
                <div>
                    <p className="text-[10px] font-medium text-muted-foreground/70 mb-3 uppercase tracking-[0.2em]">
                        Portfolio Value
                    </p>
                    <p className="font-instrument text-7xl tracking-tight tabular-nums leading-none">
                        {fmtL(currentValue)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/50 mt-2">as of today</p>
                </div>

                {/* Secondary metrics row */}
                <div className="flex items-end gap-10 mt-8">
                    <div>
                        <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-[0.2em] mb-1.5">
                            Unrealised Gain
                        </p>
                        <div className="flex items-center gap-2">
                            <span
                                className={cn(
                                    'font-instrument text-[28px] tracking-tight tabular-nums leading-none',
                                    isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                                )}
                            >
                                {isPositive ? '+' : ''}
                                {fmt(gainValue)}
                            </span>
                            {isPositive ? (
                                <TrendingUp className="size-4 text-emerald-500/70" />
                            ) : (
                                <TrendingDown className="size-4 text-red-400/70" />
                            )}
                        </div>
                        <p className={cn('text-[13px] font-medium mt-1', isPositive ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-red-500/80')}>
                            {fmtPct(heroStats.unrealisedGainPct)}
                        </p>
                    </div>

                    <div>
                        <p className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-[0.2em] mb-1.5">
                            XIRR
                        </p>
                        <p className="font-instrument text-[28px] tracking-tight tabular-nums leading-none">
                            {heroStats.xirr.toFixed(2)}%
                        </p>
                        <p className="text-[11px] text-muted-foreground/50 mt-1">annualised</p>
                    </div>
                </div>

                {/* Chip row */}
                <div className="flex mt-auto items-center gap-2 pt-5 border-t border-black/[0.04] dark:border-white/[0.06]">
                    <Badge variant="secondary" className="text-[11px] font-normal rounded-full px-3 bg-black/[0.03] dark:bg-white/[0.04] border-0">
                        Invested {fmtL(heroStats.currentValueRs - heroStats.unrealisedGainRs)}
                    </Badge>
                    <Badge variant="secondary" className="text-[11px] font-normal rounded-full px-3 bg-black/[0.03] dark:bg-white/[0.04] border-0">
                        {heroStats.activeFunds} active funds
                    </Badge>
                    <Badge
                        variant="secondary"
                        className={cn(
                            'text-[11px] font-normal rounded-full px-3 border-0',
                            heroStats.lifetimePnLRs >= 0
                                ? 'bg-emerald-500/8 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400'
                                : 'bg-red-500/8 text-red-600 dark:bg-red-400/10 dark:text-red-400'
                        )}
                    >
                        Lifetime P&L {heroStats.lifetimePnLRs >= 0 ? '+' : ''}
                        {fmtL(heroStats.lifetimePnLRs)}
                    </Badge>
                </div>
            </div>
        </BentoCard>
    );
}
