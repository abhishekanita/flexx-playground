import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
    return (
        <div className="grid grid-cols-12 gap-5">
            <Skeleton className="col-span-8 h-52 rounded-2xl" />
            <Skeleton className="col-span-4 h-52 rounded-2xl" />
            <Skeleton className="col-span-6 h-56 rounded-2xl" />
            <Skeleton className="col-span-6 h-56 rounded-2xl" />
            <Skeleton className="col-span-4 h-44 rounded-2xl" />
            <Skeleton className="col-span-4 h-44 rounded-2xl" />
            <Skeleton className="col-span-4 h-44 rounded-2xl" />
            <Skeleton className="col-span-8 h-48 rounded-2xl" />
            <Skeleton className="col-span-4 h-48 rounded-2xl" />
        </div>
    );
}
