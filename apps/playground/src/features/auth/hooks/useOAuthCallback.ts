import { useAuth } from '@/providers/auth.provider';
import { useEffect } from 'react';
import { authApis } from '../services/auth.service';

export const useOAuthCallback = () => {
    const { setUser, setAuthToken } = useAuth();

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        if (code) {
            googleCallback(code, state || '');
        }
    }, []);

    const googleCallback = async (code: string, state: string) => {
        try {
            const res = await authApis.googleCallbackApi(code, state);
            const { user, token } = res;
            setAuthToken(token);
            if (user) setUser(user);
        } catch (error) {
            console.error(error);
        }
    };
};
