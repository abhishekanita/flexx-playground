import { axios } from '@/utils/axios';
import { type MFInsightsResponse } from '../types';

const BASE = 'mf-insights';

export const mfInsightsApi = {
    getInsights: async (pan: string): Promise<MFInsightsResponse> => {
        const { data } = await axios.get(`${BASE}/${pan}`);
        return data;
    },

    getDashboard: async (pan: string) => {
        const { data } = await axios.get(`${BASE}/${pan}/dashboard`);
        return data;
    },

    getCards: async (pan: string) => {
        const { data } = await axios.get(`${BASE}/${pan}/cards`);
        return data;
    },
};
