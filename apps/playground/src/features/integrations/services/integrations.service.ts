import { axios } from '@/utils/axios';
import type { ConnectedIntegration, IntegrationMeta } from '../types/integration.type';

export const integrationsApis = {
    getAllIntegrations: async (): Promise<IntegrationMeta[]> => {
        const response = await axios.get('/integrations/all');
        return response.data;
    },

    getConnectedIntegrations: async (): Promise<ConnectedIntegration[]> => {
        const response = await axios.get('/integrations/connected');
        return response.data;
    },

    initiateGoogleIntegration: async (): Promise<{ url: string }> => {
        const response = await axios.post('/integrations/google/initiate');
        return response.data;
    },

    completeGoogleIntegration: async (code: string): Promise<{ success: boolean; email: string }> => {
        const response = await axios.post('/integrations/google/initiate/redirect', { code });
        return response.data;
    },

    initiateNpciIntegration: async (phoneNumber: string): Promise<{ message: string }> => {
        const response = await axios.post('/integrations/npci/initiate', { phoneNumber });
        return response.data;
    },

    completeNpciIntegration: async (phoneNumber: string, otp: string): Promise<{ success: boolean; phoneNumber: string }> => {
        const response = await axios.post('/integrations/npci/initiate/otp', { phoneNumber, otp });
        return response.data;
    },
};
