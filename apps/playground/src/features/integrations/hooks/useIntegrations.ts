import { useEffect, useState } from 'react';
import { integrationsApis } from '../services/integrations.service';
import type { IntegrationWithStatus } from '../types/integration.type';

export const useIntegrations = () => {
    const [integrations, setIntegrations] = useState<IntegrationWithStatus[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchIntegrations = async () => {
        try {
            setIsLoading(true);
            const [all, connected] = await Promise.all([
                integrationsApis.getAllIntegrations(),
                integrationsApis.getConnectedIntegrations(),
            ]);

            const merged: IntegrationWithStatus[] = all.map(integration => {
                const conn = connected.find(c => c.id === integration.id);
                return {
                    ...integration,
                    isConnected: !!conn,
                    connectedAt: conn?.connectedAt,
                    connectionMeta: conn?.meta,
                };
            });

            setIntegrations(merged);
        } catch (err) {
            console.error('Failed to fetch integrations', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchIntegrations();
    }, []);

    return { integrations, isLoading, refetch: fetchIntegrations };
};
