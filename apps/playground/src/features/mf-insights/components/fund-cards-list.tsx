import { type FundCard } from '../types';
import { fmt, fmtPct, fmtDays } from '../utils/formatters';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

function FundCardItem({ fund, isLast }: { fund: FundCard; isLast: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const isPositive = fund.gainPct >= 0;

    return (
        <div
            className={`cursor-pointer hover:bg-stone-50/60 dark:hover:bg-white/[0.02] transition-all duration-200 ${!isLast ? 'border-b border-black/[0.04] dark:border-white/[0.04]' : ''}`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="px-5 py-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: fund.color }} />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{fund.shortName}</span>
                                <span
                                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                    style={{
                                        backgroundColor: `${fund.color}15`,
                                        color: fund.color,
                                    }}
                                >
                                    {fund.personality}
                                </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {fund.isRegular ? (
                                    <span className="text-amber-600 font-medium">Regular</span>
                                ) : (
                                    <span className="text-emerald-600 font-medium">Direct</span>
                                )}{' '}
                                · {fmtDays(fund.holdingDays)} held · {fmt(fund.marketValueRs)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-xl font-bold tabular-nums ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {fmtPct(fund.gainPct)}
                        </span>
                        <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </div>
                </div>

                {/* Expanded content */}
                <div className={`overflow-hidden transition-all duration-250 ease-in-out ${expanded ? 'max-h-48 mt-4' : 'max-h-0'}`}>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-stone-100 dark:border-border">
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">XIRR</p>
                            <p className="text-sm font-semibold mt-0.5 tabular-nums">
                                {fund.xirrReliability === 'reliable' && fund.xirr != null ? `${fund.xirr.toFixed(1)}%` : 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Weight</p>
                            <p className="text-sm font-semibold mt-0.5 tabular-nums">{fund.weightPct.toFixed(1)}%</p>
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wide">Days held</p>
                            <p className="text-sm font-semibold mt-0.5">{fund.holdingDays}</p>
                        </div>
                    </div>
                    {fund.personalityDescription && (
                        <p className="text-[11px] text-muted-foreground mt-3 italic">{fund.personalityDescription}</p>
                    )}
                    {fund.isRegular && (
                        <p className="text-[11px] text-amber-600 font-medium mt-3">
                            Switch to Direct to save on fees
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export function FundCardsList({ funds }: { funds: FundCard[] }) {
    return (
        <BentoCard className="h-full overflow-hidden" index={10}>
            <div className="px-6 pt-6 pb-2">
                <SectionHeading>Funds at a glance</SectionHeading>
            </div>
            <div>
                {funds.map((fund, i) => (
                    <FundCardItem key={fund.schemeName} fund={fund} isLast={i === funds.length - 1} />
                ))}
            </div>
        </BentoCard>
    );
}
