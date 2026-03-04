// Force Service Worker Update Utility

export async function forceServiceWorkerUpdate(): Promise<void> {
    if ('serviceWorker' in navigator) {
        try {
            // Get all registrations
            const registrations = await navigator.serviceWorker.getRegistrations();

            console.log('Found', registrations.length, 'service worker registrations');

            // Unregister all existing service workers
            for (const registration of registrations) {
                console.log('Unregistering service worker:', registration.scope);
                await registration.unregister();
            }

            console.log('All service workers unregistered');

            // Clear all caches
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                console.log('Deleting cache:', cacheName);
                await caches.delete(cacheName);
            }

            console.log('All caches cleared');

            // Force reload to re-register with new service worker
            window.location.reload();
        } catch (error) {
            console.error('Error forcing service worker update:', error);
            throw error;
        }
    } else {
        throw new Error('Service workers not supported');
    }
}

export async function checkServiceWorkerStatus(): Promise<{
    registrations: number;
    caches: string[];
    activeWorker: boolean;
}> {
    const info = {
        registrations: 0,
        caches: [] as string[],
        activeWorker: false,
    };

    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        info.registrations = registrations.length;
        info.activeWorker = registrations.some(reg => reg.active);

        info.caches = await caches.keys();
    }

    return info;
}
