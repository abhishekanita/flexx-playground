import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/utils';
import { XCircle, Apple, CreditCard, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { Subscription } from '../types/mandate.type';

interface SubscriptionCardProps {
    subscription: Subscription;
    onRevoke: (umn: string) => void;
    isRevoking: boolean;
}

const sourceConfig = {
    apple_email: { label: 'Apple', icon: Apple, className: 'text-gray-600 dark:text-gray-400' },
    npci: { label: 'UPI Autopay', icon: CreditCard, className: 'text-blue-600 dark:text-blue-400' },
    combined: { label: 'Linked', icon: Link2, className: 'text-green-600 dark:text-green-400' },
} as const;

export const SubscriptionCard = ({ subscription, onRevoke, isRevoking }: SubscriptionCardProps) => {
    const [showCharges, setShowCharges] = useState(false);
    const isActive = subscription.status === 'active';
    const source = sourceConfig[subscription.source];
    const SourceIcon = source.icon;
    const canCancel = isActive && subscription.mandate?.isRevoke;

    return (
        <div className={cn('px-4 py-3.5 transition-colors duration-150 hover:bg-accent/50')}>
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{subscription.name}</span>
                        <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <span className={cn('flex items-center gap-0.5 text-[10px]', source.className)}>
                            <SourceIcon className="size-3" />
                            {source.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatRupees(subscription.amount)}/{subscription.billingCycle.toLowerCase()}</span>
                        {subscription.plan && <span className="truncate">{subscription.plan}</span>}
                    </div>

                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground/70">
                        {subscription.totalSpent != null && (
                            <span>Total spent: {formatRupees(subscription.totalSpent)}</span>
                        )}
                        {subscription.lastChargeDate && (
                            <span>Last: {formatDate(subscription.lastChargeDate)}</span>
                        )}
                        {subscription.mandate && (
                            <span className="italic">NPCI: {subscription.mandate.payeeName}</span>
                        )}
                        {subscription.charges && subscription.charges.length > 0 && (
                            <button
                                onClick={() => setShowCharges(!showCharges)}
                                className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                            >
                                {subscription.charges.length} charges
                                {showCharges ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                            </button>
                        )}
                    </div>
                </div>

                <div className="shrink-0">
                    {canCancel && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={() => onRevoke(subscription.mandate!.umn)}
                            disabled={isRevoking}
                        >
                            <XCircle className="size-3" />
                            Cancel
                        </Button>
                    )}
                </div>
            </div>

            {showCharges && subscription.charges && (
                <div className="mt-2 ml-0 border-t pt-2 space-y-0.5">
                    {subscription.charges.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                            <span>{formatDate(c.date)}</span>
                            <span>{formatRupees(c.amount)}</span>
                        </div>
                    ))}
                </div>
            )}
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

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}
