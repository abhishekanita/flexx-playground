import { type BenchmarkBar } from '../types';
import { useEffect, useState } from 'react';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

export function BenchmarkChart({ bars }: { bars: BenchmarkBar[] }) {
    const [animated, setAnimated] = useState(false);
    const maxXirr = Math.max(...bars.map(b => b.xirr), 1);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 100);
        return () => clearTimeout(t);
    }, []);

    return (
        <BentoCard variant="accent" className="p-6 h-full" index={9}>
            <SectionHeading className="mb-5">How you compare</SectionHeading>
            <div className="space-y-5">
                {bars.map(bar => {
                    const width = animated ? (bar.xirr / maxXirr) * 100 : 0;
                    return (
                        <div key={bar.name} className="space-y-1">
                            <div className="flex items-center justify-between">
                                <span className={`text-sm ${bar.isPortfolio ? 'font-semibold' : 'font-medium text-muted-foreground'}`}>
                                    {bar.name}
                                </span>
                                <span className={`text-sm font-semibold tabular-nums ${bar.isPortfolio ? 'text-foreground' : 'text-muted-foreground'}`}>
                                    {bar.xirr.toFixed(2)}%
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-black/[0.04] dark:bg-white/[0.04] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${width}%`,
                                        backgroundColor: bar.isPortfolio ? 'var(--mf-accent)' : bar.color,
                                        boxShadow: bar.isPortfolio && width > 0 ? '0 0 10px rgba(34, 197, 94, 0.3)' : 'none',
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
