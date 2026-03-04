// Service Worker for Web Push Notifications
const CACHE_NAME = 'never-client-v1';
const urlsToCache = ['/', '/static/js/bundle.js', '/static/css/main.css', '/manifest.json'];

// Install event - cache resources
self.addEventListener('install', event => {
    event.waitUntil(
        caches
            .open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches
            .keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => self.clients.claim())
    );
});

// Push event - handle incoming push notifications
self.addEventListener('push', event => {
    console.log('Push event received:', event);
    console.log('Push data available:', !!event.data);

    let notificationData = {};

    if (event.data) {
        console.log('Raw push data:', event.data);
        try {
            const jsonData = event.data.json();
            console.log('Parsed JSON data:', jsonData);
            notificationData = jsonData;
        } catch (e) {
            console.error('Error parsing push data as JSON:', e);
            try {
                const textData = event.data.text();
                console.log('Push data as text:', textData);
                notificationData = {
                    title: 'New Notification',
                    body: textData || 'You have a new notification',
                };
            } catch (textError) {
                console.error('Error parsing push data as text:', textError);
                notificationData = {
                    title: 'New Notification',
                    body: 'You have a new notification',
                };
            }
        }
    } else {
        console.log('No push data received');
        notificationData = {
            title: 'New Notification',
            body: 'You have a new notification',
        };
    }

    console.log('Final notification data:', notificationData);

    const {
        title = 'Spotlight Client',
        body = 'You have a new notification',
        icon = '/logo.png',
        badge = '/logo.png',
        tag = 'default',
        data = {},
        actions = [],
        requireInteraction = false,
        silent = false,
    } = notificationData;

    const notificationOptions = {
        body,
        icon,
        badge,
        tag,
        data: {
            ...data,
            timestamp: Date.now(),
            url: data.url || '/',
        },
        actions,
        requireInteraction,
        silent,
        vibrate: [200, 100, 200],
        renotify: true,
    };

    console.log('Showing notification with options:', { title, ...notificationOptions });

    event.waitUntil(
        self.registration
            .showNotification(title, notificationOptions)
            .then(() => {
                console.log('Notification shown successfully');
            })
            .catch(error => {
                console.error('Error showing notification:', error);
            })
    );
});

// Notification click event - handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Notification clicked:', event);

    const notification = event.notification;
    const data = notification.data || {};
    const url = data.url || '/';

    notification.close();

    // Handle action clicks
    if (event.action) {
        console.log('Action clicked:', event.action);
        // Handle specific actions here
        switch (event.action) {
            case 'view':
                // Open the specific URL
                break;
            case 'dismiss':
                // Just close the notification
                return;
            default:
                break;
        }
    }

    // Open or focus the app
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // Check if app is already open
            for (const client of clientList) {
                if (client.url.includes(self.location.origin)) {
                    // Focus existing window and navigate if needed
                    if (url !== '/') {
                        client.postMessage({
                            type: 'NAVIGATE',
                            url: url,
                        });
                    }
                    return client.focus();
                }
            }

            // Open new window
            return clients.openWindow(url);
        })
    );
});

// Notification close event
self.addEventListener('notificationclose', event => {
    console.log('Notification closed:', event);

    // Track notification dismissal
    const data = event.notification.data || {};
    if (data.trackingId) {
        // Send analytics event for notification dismissal
        fetch('/api/v1/push/stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event: 'notification_dismissed',
                trackingId: data.trackingId,
                timestamp: Date.now(),
            }),
        }).catch(console.error);
    }
});

// Background sync event (for offline functionality)
self.addEventListener('sync', event => {
    console.log('Background sync:', event);

    if (event.tag === 'push-subscription-sync') {
        event.waitUntil(syncPushSubscription());
    }
});

// Sync push subscription when back online
async function syncPushSubscription() {
    try {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription) {
            const subscriptionData = subscription.toJSON();
            await fetch('/api/v1/push/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: subscriptionData.endpoint,
                    keys: subscriptionData.keys,
                    userAgent: navigator.userAgent,
                }),
            });
        }
    } catch (error) {
        console.error('Failed to sync push subscription:', error);
    }
}

// Message event - handle messages from main thread
self.addEventListener('message', event => {
    console.log('Service worker received message:', event);

    const { type, data } = event.data;

    switch (type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
        case 'GET_SUBSCRIPTION':
            event.ports[0].postMessage({
                subscription: self.registration.pushManager.getSubscription(),
            });
            break;
        default:
            console.log('Unknown message type:', type);
    }
});
