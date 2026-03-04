import { type FundRaceEntry } from '../types';
import { fmt, fmtPct } from '../utils/formatters';
import { ChevronDown } from 'lucide-react';
import { BentoCard } from './bento-card';
import { useFundRace } from '../hooks/use-fund-race';
import { cn } from '@/utils/utils';

const VISIBLE_COUNT = 5;

export function FundRace({ funds }: { funds: FundRaceEntry[] }) {
    const { animated, expanded, setExpanded, maxGain, hasMore, visible } = useFundRace(funds, VISIBLE_COUNT);

    return (
        <BentoCard className="p-6 h-full" index={2}>
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-6">
                Who's winning in your portfolio
            </h2>

            <div className="space-y-1">
                {visible.map((fund, i) => {
                    const isPositive = fund.gainPct >= 0;
                    const barWidth = animated ? (Math.abs(fund.gainPct) / maxGain) * 100 : 0;
                    const isTop = i === 0;

                    return (
                        <div
                            key={fund.schemeName}
                            className={cn(
                                'group flex items-center gap-3 rounded-lg px-3 py-1.5 transition-colors duration-200',
                                'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                            )}
                        >
                            {/* Rank */}
                            <span
                                className={cn(
                                    'text-[11px] font-semibold tabular-nums w-4 shrink-0 text-center',
                                    isTop ? 'text-emerald-600' : 'text-muted-foreground/40'
                                )}
                            >
                                {i + 1}
                            </span>

                            {/* Fund info + bar */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-[13px] font-medium text-foreground/90 truncate mr-3">
                                        {fund.shortName}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-[13px] font-semibold tabular-nums shrink-0',
                                            isPositive ? 'text-emerald-600' : 'text-red-500'
                                        )}
                                    >
                                        {fmtPct(fund.gainPct)}
                                    </span>
                                </div>

                                {/* Bar — uses emerald gradient for all, intensity based on rank */}
                                <div className="h-1 w-full rounded-full bg-black/[0.03] dark:bg-white/[0.04] overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700 ease-out"
                                        style={{
                                            width: `${barWidth}%`,
                                            background: isPositive
                                                ? `linear-gradient(90deg, rgba(16,185,129,${0.3 + (1 - i / visible.length) * 0.5}) 0%, rgba(16,185,129,${0.15 + (1 - i / visible.length) * 0.35}) 100%)`
                                                : `linear-gradient(90deg, rgba(239,68,68,0.5) 0%, rgba(239,68,68,0.25) 100%)`,
                                        }}
                                    />
                                </div>

                                <p className="text-[10px] text-muted-foreground/50 mt-1">
                                    {fmt(fund.marketValueRs)} · {fund.plan}
                                </p>
                            </div>
                        </div>
                    );
                })}

                {hasMore && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors pt-1 ml-3"
                    >
                        <ChevronDown className={`size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        {expanded ? 'Show less' : `Show all ${funds.length} funds`}
                    </button>
                )}
            </div>
        </BentoCard>
    );
}
