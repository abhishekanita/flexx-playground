import { authApis } from '@/features/auth/services/auth.service';
import { createContext, useContext, useLayoutEffect, useMemo, useState, type Dispatch, type JSX, type SetStateAction } from 'react';
import FullPageLoading from '@/components/ui/full-page-loading';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { UserAccount } from '@/types';

type User = UserAccount;

interface AuthContextType {
    user: User | null;
    userId: string;
    setUser: Dispatch<SetStateAction<User | null>>;
    logout: () => Promise<void>;
    updateUser: (user: Partial<UserAccount>) => Promise<void>;
    authToken: string;
    setAuthToken: Dispatch<SetStateAction<string>>;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    userId: '',
    setUser: () => {},
    logout: async () => {},
    updateUser: async () => {},
    authToken: '',
    setAuthToken: () => {},
});

export default function AuthProvider({ children }: { children: JSX.Element }) {
    const [isLoading, setIsLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [authToken, setAuthToken] = useLocalStorage('auth-token', '');

    useLayoutEffect(() => {
        fetchUser();
    }, []);

    const fetchUser = async () => {
        try {
            const response = await authApis.getUser();
            console.log('response', response);
            if (response) setUser(response);
            setIsLoading(false);
        } catch (error) {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await authApis.logout();
        setUser(null);
        setAuthToken('');
    };

    const updateUser = async (update: Partial<User>) => {
        console.log('update', update);
        setUser(prev => ({ ...prev, ...update } as User));
    };
    const value: AuthContextType = useMemo(() => {
        return {
            user: user,
            setUser,
            logout: handleLogout,
            userId: user?._id?.toString() || '',
            updateUser,
            authToken,
            setAuthToken,
        };
    }, [user]);

    if (isLoading) {
        return <FullPageLoading debug="auth" />;
    }

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    return useContext(AuthContext);
}
