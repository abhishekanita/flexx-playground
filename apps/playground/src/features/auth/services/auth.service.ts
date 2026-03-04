import { axios } from '@/utils/axios';
import type { UserAccount } from '@/types';

export const authApis = {
    getUser: async (): Promise<UserAccount> => {
        const response = await axios.get('/auth/get-user');
        return response.data;
    },
    sendOTP: async (phone: string): Promise<{ success: true }> => {
        const response = await axios.post('auth/send-otp', { phone });
        return response.data;
    },
    verifyOTP: async (phone: string, otp: string): Promise<{ user: UserAccount; token: string }> => {
        const response = await axios.post('auth/verify-otp', { phone, otp });
        return response.data;
    },
    loginWithGoogle: async (data: any) => {
        const response = await axios.post('auth/google/callback', data);
        return response.data;
    },
    googleCallbackApi: async (code: string, state: string): Promise<{ user: UserAccount; token: string }> => {
        const response = await axios.post('/auth/google/callback', { code, inviteCode: state });
        return response.data;
    },
    logout: async () => {
        const response = await axios.get('/auth/logout');
        return response.data;
    },
};
