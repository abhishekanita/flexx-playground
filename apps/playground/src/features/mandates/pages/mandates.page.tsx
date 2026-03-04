import MainPanelHeader from '@/features/dashboard/components/panels/main-panel-header';
import Panels from '@/features/dashboard/components/panels/panels';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreditCard, MoreVertical, RefreshCw, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { NpciConnectPrompt } from '../components/npci-connect-prompt';
import { NpciReconnectBanner } from '../components/npci-reconnect-banner';
import { SubscriptionsList } from '../components/subscriptions-list';
import { RevokeQrDialog } from '../components/revoke-qr-dialog';
import { useMandates } from '../hooks/useMandates';
import type { Subscription } from '../types/mandate.type';

export const MandatesPage = () => {
    const {
        connectionStatus,
        subscriptions,
        needsReconnect,
        isLoading,
        revokeResult,
        handleRevoke,
        clearRevokeResult,
        onConnected,
        forceSync,
    } = useMandates();

    const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

    const onRevokeClick = (umn: string) => {
        const sub = subscriptions.find(s => s.mandate?.umn === umn);
        if (sub) {
            setSelectedSubscription(sub);
            setRevokeDialogOpen(true);
        }
    };

    const handleDialogClose = (open: boolean) => {
        setRevokeDialogOpen(open);
        if (!open) {
            setSelectedSubscription(null);
            clearRevokeResult();
        }
    };

    const isFirstTimeUser = !isLoading.status && !connectionStatus?.isConnected && subscriptions.length === 0 && !needsReconnect;

    return (
        <Panels>
            <MainPanelHeader
                breadcrumbs={[{ label: 'Subscriptions', icon: <CreditCard className="size-3.5" /> }]}
            />
            <div className="h-full overflow-auto">
                <div className="mx-auto max-w-3xl px-8 pt-10 pb-20">
                    {isFirstTimeUser ? (
                        <NpciConnectPrompt onSuccess={onConnected} initialPhoneNumber={connectionStatus?.phoneNumber ?? undefined} />
                    ) : (
                        <>
                            <div className="flex items-start justify-between mb-8">
                                <div className="space-y-1">
                                    <h1 className="text-xl font-semibold tracking-tight">Subscriptions</h1>
                                    <p className="text-sm text-muted-foreground">
                                        Your active subscriptions from UPI autopay and Apple receipts.
                                    </p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="size-8">
                                            <MoreVertical className="size-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={forceSync} disabled={isLoading.syncing}>
                                            {isLoading.syncing ? (
                                                <Loader2 className="size-3.5 animate-spin" />
                                            ) : (
                                                <RefreshCw className="size-3.5" />
                                            )}
                                            Force Sync
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            {needsReconnect && (
                                <NpciReconnectBanner
                                    onSuccess={onConnected}
                                    phoneNumber={connectionStatus?.phoneNumber ?? undefined}
                                />
                            )}
                            <SubscriptionsList
                                subscriptions={subscriptions}
                                isLoading={isLoading.status || isLoading.subscriptions}
                                onRevoke={onRevokeClick}
                                isRevoking={isLoading.revoke}
                            />
                        </>
                    )}
                </div>
            </div>

            <RevokeQrDialog
                open={revokeDialogOpen}
                onOpenChange={handleDialogClose}
                subscription={selectedSubscription}
                revokeResult={revokeResult}
                onRevoke={handleRevoke}
                isRevoking={isLoading.revoke}
            />
        </Panels>
    );
};
