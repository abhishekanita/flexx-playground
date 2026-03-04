import { type DashboardMarketCapBar } from '../types';
import { useEffect, useState } from 'react';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

export function MarketCapDistribution({ bars }: { bars: DashboardMarketCapBar[] }) {
    const [animated, setAnimated] = useState(false);
    const total = bars.reduce((sum, b) => sum + b.portfolioWeight, 0);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <BentoCard className="p-6 h-full" index={6}>
            <SectionHeading className="mb-5">Market cap distribution</SectionHeading>
            <div className="space-y-4">
                <div className="h-5 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden flex shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]">
                    {bars.map(bar => {
                        const width = animated ? (bar.portfolioWeight / total) * 100 : 0;
                        return (
                            <div
                                key={bar.bucket}
                                className="h-full transition-all duration-700 ease-out first:rounded-l-full last:rounded-r-full"
                                style={{
                                    width: `${width}%`,
                                    backgroundColor: bar.color,
                                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                                }}
                            />
                        );
                    })}
                </div>

                <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {bars.map(bar => (
                        <div key={bar.bucket} className="flex items-center gap-2">
                            <div className="size-2.5 rounded-full" style={{ backgroundColor: bar.color }} />
                            <span className="text-sm font-medium">{bar.bucket}</span>
                            <span className="text-sm font-semibold tabular-nums">{bar.portfolioWeight.toFixed(1)}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </BentoCard>
    );
}
