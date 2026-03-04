import { useEffect, useMemo, type JSX } from 'react';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '../components/sidebar/app-sidebar';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ConfirmProvider } from '@/providers/confirm.provider';
import { useGmailIntegration } from '@/features/integrations/hooks/useGmailIntegration';

export default function DashboardProvider({ children }: { children: JSX.Element }) {
    const { pathname } = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const { completeGmailConnect } = useGmailIntegration();

    const showProjectInternalNav = useMemo(() => {
        return false;
    }, [pathname]);

    useEffect(() => {
        const code = searchParams.get('code');
        if (code) {
            completeGmailConnect(code).then(() => {
                setSearchParams({});
            });
        }
    }, []);

    return (
        <SidebarProvider
            style={
                {
                    '--sidebar-width': showProjectInternalNav ? '18rem' : '14rem',
                } as React.CSSProperties
            }
        >
            <ConfirmProvider>
                <AppSidebar showProjectInternalNav={showProjectInternalNav} />
                <SidebarInset className="!shadow-none bg-sidebar">{children}</SidebarInset>
                {/* <WorkplaceDialogs /> */}
            </ConfirmProvider>
        </SidebarProvider>
    );
}
