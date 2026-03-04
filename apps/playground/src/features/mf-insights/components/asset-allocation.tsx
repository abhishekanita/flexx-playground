import { type DashboardAssetBar } from '../types';
import { fmtL } from '../utils/formatters';
import { useEffect, useState } from 'react';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

export function AssetAllocation({ bars }: { bars: DashboardAssetBar[] }) {
    const [animated, setAnimated] = useState(false);
    const maxWeight = Math.max(...bars.map(b => b.weight), 1);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <BentoCard className="p-6 h-full" index={4}>
            <SectionHeading className="mb-5">Asset allocation</SectionHeading>
            <div className="space-y-5">
                {bars.map(bar => {
                    const width = animated ? (bar.weight / maxWeight) * 100 : 0;
                    return (
                        <div key={bar.assetClass} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="size-2.5 rounded-full" style={{ backgroundColor: bar.color }} />
                                    <span className="text-sm font-medium">{bar.assetClass}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground tabular-nums">{fmtL(bar.marketValueRs)}</span>
                                    <span className="text-sm font-semibold tabular-nums">{bar.weight.toFixed(1)}%</span>
                                </div>
                            </div>
                            <div className="h-2 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${width}%`,
                                        backgroundColor: bar.color,
                                        boxShadow: width > 0 ? `0 0 8px ${bar.color}30` : 'none',
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </BentoCard>
    );
}
