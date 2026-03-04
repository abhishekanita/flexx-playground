import { Sheet, SheetContent } from '@/components/ui/sheet';
import { type LearnAbout } from '../types';

export function LearnSheet({
    open,
    onOpenChange,
    learn,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    learn: LearnAbout | null;
}) {
    if (!learn) return null;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-[400px]">
                <div className="p-6">
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-2">Learn about</div>
                    <h2 className="font-instrument text-2xl tracking-tight mb-4">{learn.topic}</h2>
                    <p className="text-muted-foreground leading-relaxed mb-5">{learn.deepDive}</p>
                    {learn.analogy && (
                        <div className="border-l-2 border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/10 rounded-r-lg p-4 text-sm italic text-muted-foreground">
                            {learn.analogy}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
