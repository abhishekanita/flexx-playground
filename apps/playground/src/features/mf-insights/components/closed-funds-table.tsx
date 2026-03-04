import { Button } from '@/components/ui/button';
import { type ClosedFundSummary } from '../types';
import { fmt, fmtPct } from '../utils/formatters';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BentoCard } from './bento-card';

export function ClosedFundsTable({ funds }: { funds: ClosedFundSummary[] }) {
    const [open, setOpen] = useState(false);

    if (!funds.length) return null;

    return (
        <div>
            <Button variant="ghost" className="text-sm font-medium mb-2 px-0 text-muted-foreground" onClick={() => setOpen(!open)}>
                <ChevronDown className={`size-3.5 mr-1.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                {open ? 'Hide' : 'Show'} {funds.length} exited fund{funds.length > 1 ? 's' : ''}
            </Button>

            <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px]' : 'max-h-0'}`}>
                <BentoCard className="opacity-60" index={11}>
                    <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-black/[0.04] dark:border-white/[0.04] text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                        <span className="col-span-2">Fund</span>
                        <span className="text-right">Invested</span>
                        <span className="text-right">Redeemed</span>
                        <span className="text-right">P&L</span>
                    </div>
                    {funds.map(fund => (
                        <div
                            key={fund.schemeName}
                            className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 hover:bg-stone-50/50 dark:hover:bg-white/[0.02] transition-colors duration-200"
                        >
                            <span className="col-span-2 text-sm font-medium truncate">{fund.shortName}</span>
                            <span className="text-sm text-right tabular-nums">{fmt(fund.investedRs)}</span>
                            <span className="text-sm text-right tabular-nums">{fmt(fund.redeemedRs)}</span>
                            <span className={`text-sm text-right font-semibold tabular-nums ${fund.pnlRs >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {fund.pnlRs >= 0 ? '+' : ''}
                                {fmt(fund.pnlRs)} ({fmtPct(fund.pnlPct)})
                            </span>
                        </div>
                    ))}
                </BentoCard>
            </div>
        </div>
    );
}
