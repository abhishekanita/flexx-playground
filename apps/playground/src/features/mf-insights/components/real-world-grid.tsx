import { type RealWorldEquivalent } from '../types';
import { BentoCard } from './bento-card';
import { SectionHeading } from './section-heading';

export function RealWorldGrid({ equivalents, gainRs }: { equivalents: RealWorldEquivalent[]; gainRs: number }) {
    return (
        <BentoCard className="p-5 h-full" index={1}>
            <SectionHeading className="mb-4">
                What {gainRs >= 0 ? `\u20B9${Math.abs(gainRs).toLocaleString('en-IN')}` : 'your'} gain could buy
            </SectionHeading>
            <div className="grid grid-cols-2 gap-2.5">
                {equivalents.slice(0, 4).map((item, i) => (
                    <div key={i} className="rounded-lg border border-black/[0.04] dark:border-white/[0.04] p-3 hover:bg-black/[0.01] dark:hover:bg-white/[0.02] transition-colors duration-200">
                        <span className="text-2xl">{item.emoji}</span>
                        <p className="font-instrument text-xl mt-1.5 tabular-nums">{item.displayCount}</p>
                        <p className="text-xs font-medium text-foreground/80 mt-0.5">{item.label}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{item.subtext}</p>
                    </div>
                ))}
            </div>
        </BentoCard>
    );
}
