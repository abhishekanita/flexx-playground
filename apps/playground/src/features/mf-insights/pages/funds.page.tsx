import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useMFInsights } from '../hooks/use-mf-insights';
import { fmt, fmtL, fmtPct, fmtDays } from '../utils/formatters';
import { BentoCard } from '../components/bento-card';
import type { FundCard, ClosedFundSummary } from '../types';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

function FundRow({ fund }: { fund: FundCard }) {
    const [expanded, setExpanded] = useState(false);
    const isPositive = fund.gainPct >= 0;

    return (
        <div
            className="border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 hover:bg-stone-50/60 dark:hover:bg-white/[0.02] cursor-pointer transition-all duration-200"
            onClick={() => setExpanded(!expanded)}
        >
            <div className="grid grid-cols-6 gap-4 px-5 py-3 items-center">
                <div className="col-span-2 flex items-center gap-2.5">
                    <div className="size-2 rounded-full shrink-0" style={{ backgroundColor: fund.color }} />
                    <span className="text-sm font-medium truncate">{fund.shortName}</span>
                </div>
                <div className="text-sm text-center">
                    {fund.isRegular ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                            Regular
                        </span>
                    ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Direct
                        </span>
                    )}
                </div>
                <span className="text-sm text-right tabular-nums">{fund.weightPct.toFixed(1)}%</span>
                <span className={`text-sm text-right font-semibold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                    {fmtPct(fund.gainPct)}
                </span>
                <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-right tabular-nums">
                        {fund.xirrReliability === 'reliable' && fund.xirr != null ? `${fund.xirr.toFixed(1)}%` : '\u2014'}
                    </span>
                    <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            <div className={`overflow-hidden transition-all duration-250 ${expanded ? 'max-h-40' : 'max-h-0'}`}>
                <div className="px-6 pb-4 pt-1">
                    <div className="grid grid-cols-3 gap-4 bg-stone-50 dark:bg-muted/40 rounded-xl p-4">
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">XIRR</p>
                            <p className="text-sm font-semibold mt-0.5">
                                {fund.xirrReliability === 'reliable' && fund.xirr != null ? `${fund.xirr.toFixed(1)}%` : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Days held</p>
                            <p className="text-sm font-semibold mt-0.5">{fmtDays(fund.holdingDays)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Value</p>
                            <p className="text-sm font-semibold mt-0.5">{fmt(fund.marketValueRs)}</p>
                        </div>
                    </div>
                    {fund.isRegular && (
                        <p className="text-xs text-amber-600 mt-2.5 font-medium">
                            This fund is on a Regular plan — consider switching to Direct to save on fees.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

function ClosedFundsSection({ funds }: { funds: ClosedFundSummary[] }) {
    const [open, setOpen] = useState(false);

    if (!funds.length) return null;

    return (
        <div>
            <Button variant="ghost" className="text-sm font-medium mb-2 px-0 text-muted-foreground" onClick={() => setOpen(!open)}>
                <ChevronDown className={`size-3.5 mr-1.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                {open ? 'Hide' : 'Show'} {funds.length} exited fund{funds.length > 1 ? 's' : ''}
            </Button>

            <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px]' : 'max-h-0'}`}>
                <BentoCard className="opacity-60">
                    <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-stone-100 dark:border-border text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        <span className="col-span-2">Fund</span>
                        <span className="text-right">Invested</span>
                        <span className="text-right">Redeemed</span>
                        <span className="text-right">P&L</span>
                    </div>
                    {funds.map(fund => (
                        <div
                            key={fund.schemeName}
                            className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-stone-100 dark:border-border last:border-0"
                        >
                            <span className="col-span-2 text-sm font-medium truncate">{fund.shortName}</span>
                            <span className="text-sm text-right tabular-nums">{fmt(fund.investedRs)}</span>
                            <span className="text-sm text-right tabular-nums">{fmt(fund.redeemedRs)}</span>
                            <span
                                className={`text-sm text-right font-semibold tabular-nums ${
                                    fund.pnlRs >= 0 ? 'text-emerald-600' : 'text-red-500'
                                }`}
                            >
                                {fund.pnlRs >= 0 ? '+' : ''}
                                {fmt(fund.pnlRs)}
                            </span>
                        </div>
                    ))}
                </BentoCard>
            </div>
        </div>
    );
}

function FundsSkeleton() {
    return (
        <div className="grid grid-cols-12 gap-5">
            <Skeleton className="col-span-4 h-24 rounded-2xl" />
            <Skeleton className="col-span-4 h-24 rounded-2xl" />
            <Skeleton className="col-span-4 h-24 rounded-2xl" />
            <Skeleton className="col-span-12 h-56 rounded-2xl" />
        </div>
    );
}

export const MFFundsPage = () => {
    const { data, isLoading, error } = useMFInsights();
    const dashboard = data?.dashboardData;
    const fundCards = dashboard?.fundCards || [];
    const closedFunds = dashboard?.closedFunds || [];

    return (
        <div className="mx-auto max-w-5xl px-6 py-8 pb-20">
            {isLoading && <FundsSkeleton />}

            {error && (
                <div className="text-center py-20">
                    <p className="text-sm text-muted-foreground">Failed to load fund data.</p>
                </div>
            )}

            {dashboard && (
                <div className="space-y-8">
                    {/* Summary stats */}
                    <div className="grid grid-cols-12 gap-5">
                        <BentoCard className="col-span-4 p-6" index={0}>
                            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.2em]">Active funds</p>
                            <p className="font-instrument text-4xl mt-2.5 tabular-nums">{fundCards.length}</p>
                        </BentoCard>

                        <BentoCard className="col-span-4 p-6" index={1}>
                            <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-[0.2em]">Closed funds</p>
                            <p className="font-instrument text-4xl mt-2.5 tabular-nums">{closedFunds.length}</p>
                        </BentoCard>

                        <BentoCard variant="accent" className="col-span-4 p-6 relative overflow-hidden" index={2}>
                            <div
                                className="absolute -top-6 -right-6 w-24 h-24 pointer-events-none rounded-full"
                                style={{
                                    background: 'radial-gradient(circle, var(--mf-accent-light) 0%, transparent 70%)',
                                    filter: 'blur(16px)',
                                    opacity: 0.7,
                                }}
                            />
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest relative z-10">Current value</p>
                            <p className="font-instrument text-4xl mt-2 tabular-nums relative z-10">{fmtL(dashboard.heroStats.currentValueRs)}</p>
                        </BentoCard>
                    </div>

                    {/* Active funds table */}
                    <BentoCard className="overflow-hidden" index={3}>
                        <div className="grid grid-cols-6 gap-4 px-6 py-3 border-b border-black/[0.04] dark:border-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                            <span className="col-span-2">Fund name</span>
                            <span className="text-center">Plan</span>
                            <span className="text-right">Weight</span>
                            <span className="text-right">Gain</span>
                            <span className="text-right">XIRR</span>
                        </div>
                        {fundCards.map(fund => (
                            <FundRow key={fund.schemeName} fund={fund} />
                        ))}
                    </BentoCard>

                    {/* Closed funds */}
                    <ClosedFundsSection funds={closedFunds} />
                </div>
            )}
        </div>
    );
};
