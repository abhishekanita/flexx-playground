import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useGmailIntegration } from '../hooks/useGmailIntegration';
import { useIntegrations } from '../hooks/useIntegrations';
import { IntegrationCard } from './integration-card';
import { NpciConnectDialog } from './npci-connect-dialog';

const IntegrationSkeleton = () => (
    <div className="flex items-center gap-4 px-4 py-3.5">
        <Skeleton className="size-9 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-7 w-16 rounded-md shrink-0" />
    </div>
);

export const IntegrationsList = () => {
    const { integrations, isLoading, refetch } = useIntegrations();
    const { initiateGmailConnect } = useGmailIntegration();
    const [npciDialogOpen, setNpciDialogOpen] = useState(false);

    const handleConnect = (id: string) => {
        if (id === 'gmail') {
            initiateGmailConnect();
        } else if (id === 'npci') {
            setNpciDialogOpen(true);
        }
    };

    if (isLoading) {
        return (
            <div className="rounded-lg border overflow-hidden divide-y">
                <IntegrationSkeleton />
                <IntegrationSkeleton />
            </div>
        );
    }

    if (integrations.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center rounded-lg border py-16">
                <p className="text-sm text-muted-foreground">No integrations available</p>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-lg border overflow-hidden divide-y">
                {integrations.map(integration => (
                    <IntegrationCard
                        key={integration.id}
                        integration={integration}
                        onConnect={handleConnect}
                    />
                ))}
            </div>

            <NpciConnectDialog
                open={npciDialogOpen}
                onOpenChange={setNpciDialogOpen}
                onSuccess={refetch}
            />
        </>
    );
};
