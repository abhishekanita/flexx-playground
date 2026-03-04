import { lazy, Suspense } from 'react';
import { useAuth } from '@/providers/auth.provider';
import { Navigate } from 'react-router-dom';
import { AnimatedOutlet } from '../components/ui/animated-outlet';
import FullPageLoading from '@/components/ui/full-page-loading';

export function AuthApp() {
    const { user } = useAuth();
    if (user ) {
        return <Navigate to={`/app${window.location.search}`} />;
    }
    return (
        <Suspense fallback={<FullPageLoading debug="lazy-loading" />}>
            <AnimatedOutlet />
        </Suspense>
    );
}
