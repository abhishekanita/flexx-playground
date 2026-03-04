import { type DashboardSectorAllocation } from '../types';
import { useEffect, useState } from 'react';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

export function SectorAllocation({ data }: { data: DashboardSectorAllocation }) {
    const [animated, setAnimated] = useState(false);
    const maxWeight = Math.max(...data.sectors.map(s => s.portfolioWeight), 1);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <BentoCard className="p-6 h-full" index={5}>
            <SectionHeading className="mb-5">Sector exposure</SectionHeading>
            <div className="space-y-4">
                {data.sectors.map(sector => {
                    const width = animated ? (sector.portfolioWeight / maxWeight) * 100 : 0;
                    return (
                        <div key={sector.sector} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="size-2 rounded-full" style={{ backgroundColor: sector.color }} />
                                    <span className="text-sm font-medium">{sector.sector}</span>
                                </div>
                                <span className="text-sm font-semibold tabular-nums">{sector.portfolioWeight.toFixed(1)}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${width}%`,
                                        backgroundColor: sector.color,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}

                {data.othersWeight > 0 && (
                    <p className="text-[11px] text-muted-foreground pt-1">
                        + {data.totalSectorsCount - data.sectors.length} more sectors ({data.othersWeight.toFixed(1)}%)
                    </p>
                )}
            </div>
        </BentoCard>
    );
}
