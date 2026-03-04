import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type PortfolioMapBlock } from '../types';
import { fmt, fmtPct } from '../utils/formatters';
import { BentoCard } from './bento-card';
import { useEffect, useState } from 'react';

// Muted, sophisticated palette that replaces the raw fund colors
const PALETTE = [
    '#4f9e76', // green
    '#5b9bd5', // blue
    '#e8915a', // orange
    '#9b7ec8', // purple
    '#45b5aa', // teal
    '#e06b8a', // pink
    '#8cb85c', // lime
    '#d4a745', // gold
    '#6ba3c9', // sky
    '#cf7c5f', // coral
    '#5cc0a0', // mint
    '#b8894d', // amber
    '#7a8fd4', // periwinkle
    '#a8c254', // chartreuse
    '#d48a9a', // rose
    '#5da8b8', // cyan
    '#c9a055', // honey
    '#6fc48a', // spring
];

export function PortfolioTreemap({ blocks }: { blocks: PortfolioMapBlock[] }) {
    const [animated, setAnimated] = useState(false);
    const total = blocks.reduce((acc, b) => acc + b.weightPct, 0);

    useEffect(() => {
        const t = setTimeout(() => setAnimated(true), 50);
        return () => clearTimeout(t);
    }, []);

    return (
        <BentoCard className="p-6 h-full" index={3}>
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-5">
                Portfolio composition
            </h2>

            <TooltipProvider>
                {/* Stacked horizontal bar */}
                <div className="h-8 w-full rounded-lg overflow-hidden flex mb-5">
                    {blocks.map((block, i) => {
                        const width = animated ? (block.weightPct / total) * 100 : 0;
                        const color = PALETTE[i % PALETTE.length];
                        return (
                            <Tooltip key={block.schemeName}>
                                <TooltipTrigger asChild>
                                    <div
                                        className="h-full transition-all duration-700 ease-out cursor-pointer hover:opacity-80 first:rounded-l-lg last:rounded-r-lg"
                                        style={{
                                            width: `${width}%`,
                                            backgroundColor: color,
                                            boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.08)',
                                        }}
                                    />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="font-medium text-[13px]">{block.shortName}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {block.weightPct.toFixed(1)}% · {fmt(block.marketValueRs)} · {fmtPct(block.gainPct)}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>

                {/* Legend list */}
                <div className="space-y-2">
                    {blocks.slice(0, 8).map((block, i) => {
                        const color = PALETTE[i % PALETTE.length];
                        const isPositive = block.gainPct >= 0;
                        return (
                            <div key={block.schemeName} className="flex items-center justify-between group">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className="size-2.5 rounded-[3px] shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-[12px] font-medium text-foreground/80 truncate">
                                        {block.shortName}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 ml-3">
                                    <span
                                        className={`text-[11px] tabular-nums ${isPositive ? 'text-emerald-600/70' : 'text-red-500/70'}`}
                                    >
                                        {fmtPct(block.gainPct)}
                                    </span>
                                    <span className="text-[12px] font-semibold tabular-nums text-foreground/70 w-12 text-right">
                                        {block.weightPct.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {blocks.length > 8 && (
                        <p className="text-[10px] text-muted-foreground/50 pt-1">
                            + {blocks.length - 8} more funds
                        </p>
                    )}
                </div>
            </TooltipProvider>
        </BentoCard>
    );
}
