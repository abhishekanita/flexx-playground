import { Skeleton } from '@/components/ui/skeleton';
import React from 'react';

const NavLoading = ({ num }: { num: number }) => {
    return (
        <div className="flex flex-col gap-0.5">
            {Array.from({ length: num }).map((_, index) => (
                <Skeleton key={index} className="h-6.5 w-full bg-muted rounded-md" />
            ))}
        </div>
    );
};

export default NavLoading;
