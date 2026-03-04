export type IntegrationProvider = 'google' | 'npci';

export interface IntegrationMeta {
    id: string;
    name: string;
    description: string;
    provider: IntegrationProvider;
}

export interface ConnectedIntegration {
    id: string;
    provider: IntegrationProvider;
    connectedAt: string;
    meta: Record<string, any>;
}

export interface IntegrationWithStatus extends IntegrationMeta {
    isConnected: boolean;
    connectedAt?: string;
    connectionMeta?: Record<string, any>;
}
