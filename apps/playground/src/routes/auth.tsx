import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthApp } from './auth.app';

const LoginPage = lazy(() => import('@/features/auth/pages/login.page'));
const SignupPage = lazy(() => import('@/features/auth/pages/signup.page'));
const CallbackPage = lazy(() => import('@/features/auth/pages/callback.page'));

export default [
    {
        path: '/',
        element: <AuthApp />,
        children: [
            {
                path: '/',
                element: <LoginPage />,
            },
            {
                path: '/signup',
                element: <SignupPage />,
            },
            {
                path: '/auth/google/callback',
                element: <CallbackPage />,
            },
            {
                path: '*',
                element: <Navigate to="/" />,
            },
        ],
    },
];
