import { type DashboardTopHoldings } from '../types';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

const VISIBLE_COUNT = 4;

export function TopHoldings({ data }: { data: DashboardTopHoldings }) {
    const [animated, setAnimated] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const maxWeight = Math.max(...data.holdings.map(h => h.portfolioWeight), 1);
    const hasMore = data.holdings.length > VISIBLE_COUNT;
    const visible = expanded ? data.holdings : data.holdings.slice(0, VISIBLE_COUNT);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <BentoCard className="p-6 h-full" index={7}>
            <SectionHeading className="mb-5">Top stock holdings</SectionHeading>
            <div className="space-y-4">
                {visible.map((holding, i) => {
                    const width = animated ? (holding.portfolioWeight / maxWeight) * 100 : 0;
                    return (
                        <div key={holding.companyName} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground tabular-nums w-4">{i + 1}</span>
                                    <span className="text-sm font-medium">{holding.companyName}</span>
                                </div>
                                <span className="text-sm font-semibold tabular-nums">{holding.portfolioWeight.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden ml-6">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out bg-blue-500/80 dark:bg-blue-400/70"
                                    style={{ width: `${width}%` }}
                                />
                            </div>
                        </div>
                    );
                })}

                {hasMore && (
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors pt-1"
                    >
                        <ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        {expanded ? 'Show less' : `Show all ${data.holdings.length} holdings`}
                    </button>
                )}

                <div className="border-t border-stone-100 dark:border-border pt-3 mt-3 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                    <span>Top 5: {data.concentrationRisk.top5Weight.toFixed(1)}%</span>
                    <span>Top 10: {data.concentrationRisk.top10Weight.toFixed(1)}%</span>
                    <span>{data.totalCompaniesCount} companies total</span>
                </div>
            </div>
        </BentoCard>
    );
}
