import { Skeleton } from '@/components/ui/skeleton';
import { MandateCard } from './mandate-card';
import type { Mandate } from '../types/mandate.type';

interface MandatesListProps {
    mandates: Mandate[];
    isLoading: boolean;
    onRevoke: (umn: string) => void;
    isRevoking: boolean;
}

const MandateSkeleton = () => (
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

export const MandatesList = ({ mandates, isLoading, onRevoke, isRevoking }: MandatesListProps) => {
    if (isLoading) {
        return (
            <div className="rounded-lg border overflow-hidden divide-y">
                <MandateSkeleton />
                <MandateSkeleton />
                <MandateSkeleton />
                <MandateSkeleton />
            </div>
        );
    }

    if (mandates.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16">
                <p className="text-sm text-muted-foreground">No mandates found</p>
            </div>
        );
    }

    return (
        <div className="rounded-lg border overflow-hidden divide-y">
            {mandates.map(mandate => (
                <MandateCard
                    key={mandate.umn}
                    mandate={mandate}
                    onRevoke={onRevoke}
                    isRevoking={isRevoking}
                />
            ))}
        </div>
    );
};
