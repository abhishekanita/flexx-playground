import '@/assets/css/index.css';
import { createRoot } from 'react-dom/client';
import AppProvider from './providers/app.provider';
import AppRoutes from './routes';
import { registerServiceWorkers } from './utils/sw-registration';
import { StrictMode } from 'react';

registerServiceWorkers();
createRoot(document.getElementById('root')!).render(
    <>
        <AppProvider>
            <AppRoutes />
        </AppProvider>
    </>
);
