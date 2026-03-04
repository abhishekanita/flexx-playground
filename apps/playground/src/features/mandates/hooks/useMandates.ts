import { useEffect, useState, useCallback } from 'react';
import { mandatesApis } from '../services/mandates.service';
import type { ConnectionStatus, Subscription, RevokeResult } from '../types/mandate.type';
import { toast } from 'sonner';

export const useMandates = () => {
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [needsReconnect, setNeedsReconnect] = useState(false);
    const [isLoading, setIsLoading] = useState({ status: true, subscriptions: false, revoke: false, syncing: false });
    const [revokeResult, setRevokeResult] = useState<RevokeResult | null>(null);

    const fetchConnectionStatus = useCallback(async () => {
        try {
            setIsLoading(p => ({ ...p, status: true }));
            const status = await mandatesApis.getConnectionStatus();
            setConnectionStatus(status);
            return status;
        } catch (err) {
            console.error('Failed to fetch connection status', err);
            return null;
        } finally {
            setIsLoading(p => ({ ...p, status: false }));
        }
    }, []);

    const fetchSubscriptions = useCallback(async () => {
        try {
            setIsLoading(p => ({ ...p, subscriptions: true }));
            const data = await mandatesApis.getSubscriptions();
            setSubscriptions(data.subscriptions);
            setNeedsReconnect(data.needsReconnect);
        } catch (err: any) {
            console.error('Failed to fetch subscriptions', err);
            toast.error('Failed to fetch subscriptions');
        } finally {
            setIsLoading(p => ({ ...p, subscriptions: false }));
        }
    }, []);

    const handleRevoke = useCallback(async (umn: string, app: string) => {
        try {
            setIsLoading(p => ({ ...p, revoke: true }));
            const result = await mandatesApis.revokeMandate(umn, app);
            setRevokeResult(result);
            return result;
        } catch (err: any) {
            if (err.response?.data?.error === 'NPCI_SESSION_EXPIRED') {
                toast.error('Your NPCI session has expired. Please reconnect to cancel subscriptions.');
                setNeedsReconnect(true);
            } else {
                toast.error(err.response?.data?.error || 'Failed to generate revoke link');
            }
            return null;
        } finally {
            setIsLoading(p => ({ ...p, revoke: false }));
        }
    }, []);

    const forceSync = useCallback(async () => {
        try {
            setIsLoading(p => ({ ...p, syncing: true }));
            const data = await mandatesApis.forceSync();
            setSubscriptions(data.subscriptions);
            toast.success('Subscriptions synced');
        } catch (err: any) {
            console.error('Failed to sync', err);
            toast.error('Failed to sync subscriptions');
        } finally {
            setIsLoading(p => ({ ...p, syncing: false }));
        }
    }, []);

    const clearRevokeResult = useCallback(() => {
        setRevokeResult(null);
    }, []);

    const onConnected = useCallback(async () => {
        await fetchConnectionStatus();
        await fetchSubscriptions();
    }, [fetchConnectionStatus, fetchSubscriptions]);

    useEffect(() => {
        (async () => {
            await fetchConnectionStatus();
            await fetchSubscriptions();
        })();
    }, [fetchConnectionStatus, fetchSubscriptions]);

    return {
        connectionStatus,
        subscriptions,
        needsReconnect,
        isLoading,
        revokeResult,
        handleRevoke,
        clearRevokeResult,
        onConnected,
        forceSync,
        refetchSubscriptions: fetchSubscriptions,
    };
};
