export interface ServiceWorkerConfig {
    onUpdate?: (registration: ServiceWorkerRegistration) => void;
    onSuccess?: (registration: ServiceWorkerRegistration) => void;
    onError?: (error: Error) => void;
    bypassNodeEnvProduction?: boolean;
}

const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
        window.location.hostname === '[::1]' ||
        window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
);

function nodeEnvProductionCheck(config?: ServiceWorkerConfig): boolean {
    if (config?.bypassNodeEnvProduction) {
        return true;
    }
    return import.meta.env.PROD;
}

function getServiceWorkerUrl(): string {
    if (import.meta.env.PROD) {
        return '/sw.js';
    }
    return '/sw.js'; // Use same SW for dev and prod
}

export function registerServiceWorkers(config?: ServiceWorkerConfig): Promise<ServiceWorkerRegistration | null> {
    return new Promise((resolve, reject) => {
        // if (!nodeEnvProductionCheck(config) && !config?.bypassNodeEnvProduction) {
        //     console.log('Service worker registration skipped in development mode');
        //     resolve(null);
        //     return;
        // }

        if ('serviceWorker' in navigator) {
            const swUrl = getServiceWorkerUrl();
            console.log('swUrl', swUrl);

            if (isLocalhost) {
                // This is running on localhost. Check if a service worker still exists or not.
                checkValidServiceWorker(swUrl, config).then(resolve).catch(reject);
            } else {
                // Is not localhost. Just register service worker
                registerValidSW(swUrl, config).then(resolve).catch(reject);
            }
        } else {
            console.log('Service workers are not supported in this browser');
            resolve(null);
        }
    });
}

async function registerValidSW(swUrl: string, config?: ServiceWorkerConfig): Promise<ServiceWorkerRegistration> {
    try {
        const registration = await navigator.serviceWorker.register(swUrl);

        registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) {
                return;
            }

            installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        // At this point, the updated precached content has been fetched,
                        // but the previous service worker will still serve the older
                        // content until all client tabs are closed.
                        console.log('New content is available and will be used when all ' + 'tabs for this page are closed.');

                        // Execute callback
                        if (config?.onUpdate) {
                            config.onUpdate(registration);
                        }
                    } else {
                        // At this point, everything has been precached.
                        // It's the perfect time to display a
                        // "Content is cached for offline use." message.
                        console.log('Content is cached for offline use.');

                        // Execute callback
                        if (config?.onSuccess) {
                            config.onSuccess(registration);
                        }
                    }
                }
            });
        });

        console.log('Service worker registered successfully');
        return registration;
    } catch (error) {
        console.error('Error during service worker registration:', error);
        if (config?.onError) {
            config.onError(error as Error);
        }
        throw error;
    }
}

async function checkValidServiceWorker(swUrl: string, config?: ServiceWorkerConfig): Promise<ServiceWorkerRegistration | null> {
    try {
        // Check if the service worker can be found
        const response = await fetch(swUrl, {
            headers: { 'Service-Worker': 'script' },
        });

        // Ensure service worker exists, and that we really are getting a JS file.
        const contentType = response.headers.get('content-type');
        if (response.status === 404 || (contentType != null && contentType.indexOf('javascript') === -1)) {
            // No service worker found. Probably a different app. Reload the page.
            const registration = await navigator.serviceWorker.ready;
            await registration.unregister();
            window.location.reload();
            return null;
        } else {
            // Service worker found. Proceed as normal.
            return registerValidSW(swUrl, config);
        }
    } catch (error) {
        console.log('No internet connection found. App is running in offline mode.');
        return null;
    }
}

export function unregister(): Promise<boolean> {
    return new Promise(resolve => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
                .then(registration => {
                    registration.unregister().then(resolve);
                })
                .catch(() => {
                    resolve(false);
                });
        } else {
            resolve(false);
        }
    });
}

export function getRegistration(): Promise<ServiceWorkerRegistration | null> {
    return new Promise(resolve => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
                .then(registration => {
                    resolve(registration);
                })
                .catch(() => {
                    resolve(null);
                });
        } else {
            resolve(null);
        }
    });
}

export function isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
