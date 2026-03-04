import { cn } from '@/utils/utils';

export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
    return <h2 className={cn('text-[11px] font-medium uppercase tracking-widest text-muted-foreground/60 mb-5', className)}>{children}</h2>;
}
