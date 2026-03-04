import { axios } from '@/utils/axios';
import type { ConnectionStatus, SubscriptionsResponse, RevokeResult } from '../types/mandate.type';

export const mandatesApis = {
    getConnectionStatus: async (): Promise<ConnectionStatus> => {
        const response = await axios.get('/npci/connection-status');
        return response.data;
    },

    connect: async (phoneNumber: string): Promise<{ message: string }> => {
        const response = await axios.post('/npci/connect', { phoneNumber });
        return response.data;
    },

    verifyConnection: async (phoneNumber: string, otp: string): Promise<{ success: boolean; phoneNumber: string }> => {
        const response = await axios.post('/npci/connect/verify', { phoneNumber, otp });
        return response.data;
    },

    getSubscriptions: async (): Promise<SubscriptionsResponse> => {
        const response = await axios.get('/npci/mandates');
        return response.data;
    },

    forceSync: async (): Promise<SubscriptionsResponse> => {
        const response = await axios.post('/npci/mandates/sync');
        return response.data;
    },

    revokeMandate: async (umn: string, app: string): Promise<RevokeResult> => {
        const response = await axios.post('/npci/mandates/revoke', { umn, app });
        return response.data;
    },
};
