import { useState } from 'react';
import { integrationsApis } from '../services/integrations.service';
import { toast } from 'sonner';

export const useGmailIntegration = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const initiateGmailConnect = async () => {
        try {
            setIsLoading(true);
            const { url } = await integrationsApis.initiateGoogleIntegration();
            window.location.href = url;
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to initiate Gmail connection');
            setIsLoading(false);
        }
    };

    const completeGmailConnect = async (code: string) => {
        try {
            setIsConnecting(true);
            await integrationsApis.completeGoogleIntegration(code);
            toast.success('Gmail connected successfully');
            setIsConnecting(false);
            return true;
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to connect Gmail');
            setIsConnecting(false);
            return false;
        }
    };

    return { initiateGmailConnect, completeGmailConnect, isLoading, isConnecting };
};
