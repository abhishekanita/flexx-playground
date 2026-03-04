import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type HeatmapYear } from '../types';
import { fmt } from '../utils/formatters';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

function getIntensity(amount: number, max: number) {
    if (amount === 0) return 0;
    return Math.max(0.15, amount / max);
}

export function InvestmentHeatmap({ heatmap }: { heatmap: HeatmapYear[] }) {
    const allAmounts = heatmap.flatMap(y => y.months.map(m => m.investedRs));
    const maxAmount = Math.max(...allAmounts, 1);

    return (
        <BentoCard className="p-6 h-full" index={8}>
            <SectionHeading className="mb-1">Your investing history</SectionHeading>
            <p className="text-xs text-muted-foreground mb-4">Darker = more invested that month</p>
            <TooltipProvider>
                {/* Month headers */}
                <div className="flex items-center gap-1 mb-2 pl-12">
                    {MONTH_LABELS.map((m, i) => (
                        <div key={i} className="w-8 text-center text-[10px] font-medium text-muted-foreground">
                            {m}
                        </div>
                    ))}
                </div>

                {/* Year rows */}
                {heatmap.map(year => (
                    <div key={year.year} className="flex items-center gap-1 mb-1">
                        <span className="w-10 text-[11px] font-medium text-muted-foreground text-right mr-2">{year.year}</span>
                        {Array.from({ length: 12 }, (_, mi) => {
                            const month = year.months.find(m => m.month === mi + 1);
                            const invested = month?.investedRs || 0;
                            const withdrawn = month?.withdrawnRs || 0;
                            const isWithdrawal = withdrawn > invested;

                            return (
                                <Tooltip key={mi}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="w-8 h-6 rounded-md cursor-pointer transition-all duration-200 hover:scale-110 hover:z-10 hover:shadow-sm"
                                            style={{
                                                backgroundColor: isWithdrawal
                                                    ? `rgba(220, 38, 38, ${getIntensity(withdrawn, maxAmount)})`
                                                    : invested > 0
                                                    ? `rgba(16, 185, 129, ${getIntensity(invested, maxAmount)})`
                                                    : 'var(--color-muted)',
                                            }}
                                        />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p className="text-xs">
                                            {MONTH_LABELS[mi]} {year.year}
                                        </p>
                                        {invested > 0 && (
                                            <p className="text-xs font-medium text-emerald-600">{fmt(invested)} invested</p>
                                        )}
                                        {withdrawn > 0 && (
                                            <p className="text-xs font-medium text-red-500">{fmt(withdrawn)} withdrawn</p>
                                        )}
                                        {invested === 0 && withdrawn === 0 && (
                                            <p className="text-xs text-muted-foreground">No activity</p>
                                        )}
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </div>
                ))}
            </TooltipProvider>
        </BentoCard>
    );
}
