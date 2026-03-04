import webpush from 'web-push';

export function generateVAPIDKeys(): { publicKey: string; privateKey: string } {
    const vapidKeys = webpush.generateVAPIDKeys();
    return {
        publicKey: vapidKeys.publicKey,
        privateKey: vapidKeys.privateKey,
    };
}

export function displayVAPIDKeys(): void {
    const keys = generateVAPIDKeys();
    console.log('\n=== VAPID Keys Generated ===');
    console.log('Add these to your environment variables:');
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.log('============================\n');
}

if (require.main === module) {
    displayVAPIDKeys();
}
