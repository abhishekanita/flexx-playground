import { Suspense, type JSX } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/utils/react-query';
import AuthProvider from '@/providers/auth.provider';
import { ThemeProvider } from '@/providers/theme.provider';
import { Toaster } from '@/components/ui/sonner';
import FullPageLoading from '@/components/ui/full-page-loading';
import { ConfirmProvider } from './confirm.provider';

function AppProvider({ children }: { children: JSX.Element }) {
    return (
        <ConfirmProvider>
            <QueryClientProvider client={queryClient}>
                    <AuthProvider>
                        <ThemeProvider>
                            <Suspense fallback={<FullPageLoading debug="suspense" />}>{children}</Suspense>
                            <Toaster />
                        </ThemeProvider>
                    </AuthProvider>
            </QueryClientProvider>
        </ConfirmProvider>
    );
}

export default AppProvider;
