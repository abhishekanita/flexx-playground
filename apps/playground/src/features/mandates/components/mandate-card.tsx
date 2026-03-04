import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/utils';
import { XCircle, Loader2, CheckCircle2, AlertCircle, SkipForward } from 'lucide-react';
import type { Mandate } from '../types/mandate.type';

interface MandateCardProps {
    mandate: Mandate;
    onRevoke: (umn: string) => void;
    isRevoking: boolean;
}

const enrichmentConfig = {
    pending: { icon: Loader2, label: 'Pending', className: 'text-yellow-600 dark:text-yellow-400', iconClass: 'animate-spin' },
    enriched: { icon: CheckCircle2, label: 'Enriched', className: 'text-green-600 dark:text-green-400', iconClass: '' },
    failed: { icon: AlertCircle, label: 'Failed', className: 'text-red-500 dark:text-red-400', iconClass: '' },
    skipped: { icon: SkipForward, label: 'Skipped', className: 'text-muted-foreground', iconClass: '' },
} as const;

export const MandateCard = ({ mandate, onRevoke, isRevoking }: MandateCardProps) => {
    const isActive = mandate.status === 'ACTIVE';
    const enrichment = mandate.enrichmentStatus ? enrichmentConfig[mandate.enrichmentStatus] : null;
    const EnrichIcon = enrichment?.icon;
    const enriched = mandate.enrichedData;

    return (
        <div
            className={cn(
                'flex items-center gap-4 px-4 py-3.5',
                'transition-colors duration-150',
                'hover:bg-accent/50'
            )}
        >
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                        {enriched?.subscriptionName || mandate.payeeName}
                    </span>
                    <Badge variant={isActive ? 'default' : 'secondary'}>
                        {mandate.status}
                    </Badge>
                    {enrichment && EnrichIcon && (
                        <span className={cn('flex items-center gap-0.5 text-[10px]', enrichment.className)}>
                            <EnrichIcon className={cn('size-3', enrichment.iconClass)} />
                            {enrichment.label}
                        </span>
                    )}
                </div>

                {enriched ? (
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {enriched.planName && <span>{enriched.planName}</span>}
                        {enriched.billingAmount && <span>{formatRupees(enriched.billingAmount)}/{enriched.billingCycle?.toLowerCase() || 'cycle'}</span>}
                        {enriched.providerEmail && <span className="truncate">{enriched.providerEmail}</span>}
                    </div>
                ) : null}

                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span>Ceiling: {formatRupees(mandate.amount)}</span>
                    <span>{mandate.recurrance}</span>
                    <span>{mandate.category}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground/70">
                    <span>{mandate.totalExecutionCount} executions</span>
                    <span>Total: {formatRupees(mandate.totalExecutionAmount)}</span>
                    {enriched?.subscriptionName && enriched.subscriptionName !== mandate.payeeName && (
                        <span className="italic">NPCI: {mandate.payeeName}</span>
                    )}
                </div>
            </div>

            <div className="shrink-0">
                {isActive && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => onRevoke(mandate.umn)}
                        disabled={isRevoking}
                    >
                        <XCircle className="size-3" />
                        Cancel
                    </Button>
                )}
            </div>
        </div>
    );
};

function formatRupees(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}
