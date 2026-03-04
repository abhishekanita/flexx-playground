import { Skeleton } from '@/components/ui/skeleton';
import { SubscriptionCard } from './subscription-card';
import type { Subscription } from '../types/mandate.type';

interface SubscriptionsListProps {
    subscriptions: Subscription[];
    isLoading: boolean;
    onRevoke: (umn: string) => void;
    isRevoking: boolean;
}

const SubscriptionSkeleton = () => (
    <div className="flex items-center gap-4 px-4 py-3.5">
        <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-4 w-14 rounded-md" />
            </div>
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-2.5 w-36" />
        </div>
        <Skeleton className="h-7 w-16 rounded-md shrink-0" />
    </div>
);

export const SubscriptionsList = ({ subscriptions, isLoading, onRevoke, isRevoking }: SubscriptionsListProps) => {
    if (isLoading) {
        return (
            <div className="rounded-lg border overflow-hidden divide-y">
                <SubscriptionSkeleton />
                <SubscriptionSkeleton />
                <SubscriptionSkeleton />
                <SubscriptionSkeleton />
            </div>
        );
    }

    if (subscriptions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16">
                <p className="text-sm text-muted-foreground">No subscriptions found</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border overflow-hidden divide-y">
            {subscriptions.map(subscription => (
                <SubscriptionCard
                    key={subscription.id}
                    subscription={subscription}
                    onRevoke={onRevoke}
                    isRevoking={isRevoking}
                />
            ))}
        </div>
    );
};
