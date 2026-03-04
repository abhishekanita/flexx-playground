import { IntegrationGmailModel, IntegrationNpciModel } from '@/schema';

const INTEGRATIONS_CATALOG = [
    {
        id: 'gmail',
        name: 'Gmail',
        description: 'Connect your Gmail account to access email data',
        provider: 'google',
    },
    {
        id: 'npci',
        name: 'NPCI UPI',
        description: 'Connect your UPI account to view and manage autopay mandates',
        provider: 'npci',
    },
];

class IntegrationsService {
    getAllIntegrations() {
        return INTEGRATIONS_CATALOG;
    }

    async getConnectedIntegrations(userId: string) {
        const [gmailIntegrations, npciIntegrations] = await Promise.all([
            IntegrationGmailModel.find({ userId, isConnected: true }).lean(),
            IntegrationNpciModel.find({ userId, isConnected: true }).lean(),
        ]);

        const connected: { id: string; provider: string; connectedAt: Date; meta: Record<string, any> }[] = [];

        for (const g of gmailIntegrations) {
            connected.push({
                id: 'gmail',
                provider: 'google',
                connectedAt: g.connectedAt,
                meta: { email: g.email },
            });
        }

        for (const n of npciIntegrations) {
            connected.push({
                id: 'npci',
                provider: 'npci',
                connectedAt: n.connectedAt,
                meta: { phoneNumber: n.phoneNumber },
            });
        }

        return connected;
    }

    async upsertGmailIntegration(userId: string, data: {
        email: string;
        accessToken: string;
        refreshToken: string;
        scopes: string[];
    }) {
        return IntegrationGmailModel.findOneAndUpdate(
            { userId, email: data.email },
            {
                $set: {
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken,
                    scopes: data.scopes,
                    isConnected: true,
                    connectedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );
    }

    async upsertNpciIntegration(userId: string, data: {
        phoneNumber: string;
        accessToken: string;
        csrfToken: string;
        sessionId: string;
    }) {
        return IntegrationNpciModel.findOneAndUpdate(
            { userId, phoneNumber: data.phoneNumber },
            {
                $set: {
                    accessToken: data.accessToken,
                    csrfToken: data.csrfToken,
                    sessionId: data.sessionId,
                    isConnected: true,
                    connectedAt: new Date(),
                },
            },
            { upsert: true, new: true }
        );
    }
}

export default new IntegrationsService();
