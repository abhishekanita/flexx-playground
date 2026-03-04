import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/providers/auth.provider';
import { Suspense, lazy } from 'react';
import FullPageLoading from '@/components/ui/full-page-loading';
import { IntegrationsPage } from '@/features/integrations/pages/integrations.page';
import { MandatesPage } from '@/features/mandates/pages/mandates.page';
import HomePage from '@/features/home/pages/home.page';
import DashboardProvider from '@/features/dashboard/providers/dashboard.provider';
import { MFDashboardPage } from '@/features/mf-insights/pages/dashboard.page';
import { MFInsightsPage } from '@/features/mf-insights/pages/insights.page';
import { MFFundsPage } from '@/features/mf-insights/pages/funds.page';
import { MFLayout } from '@/features/mf-insights/layouts/mf-layout';

function ProtectedRoute() {
    const { user } = useAuth();

    console.log('user', user);
    if (!user) {
        return <Navigate to="/" />;
    }

    return (
        <Suspense fallback={<FullPageLoading debug="lazy-loading" />}>
            <DashboardProvider>
                <Outlet />
            </DashboardProvider>
        </Suspense>
    );
}

export default [
    {
        path: '/app',
        element: <ProtectedRoute />,
        children: [
            {
                path: '',
                element: <HomePage />,
            },
            {
                path: '/app/integrations',
                element: <IntegrationsPage />,
            },
            {
                path: '/app/mandates',
                element: <MandatesPage />,
            },
            {
                path: '/app/mf-insights',
                element: <MFLayout />,
                children: [
                    {
                        index: true,
                        element: <MFDashboardPage />,
                    },
                    {
                        path: 'insights',
                        element: <MFInsightsPage />,
                    },
                    {
                        path: 'funds',
                        element: <MFFundsPage />,
                    },
                ],
            },
        ],
    },
];
