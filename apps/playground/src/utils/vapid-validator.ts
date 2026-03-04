// VAPID Key Validator Utility

export interface VapidValidationResult {
    isValid: boolean;
    error?: string;
    details?: {
        originalLength: number;
        base64Length: number;
        uint8ArrayLength: number;
        isBase64Url: boolean;
        hasCorrectLength: boolean;
    };
}

export function validateVapidKey(vapidKey: string): VapidValidationResult {
    try {
        // Check if key exists
        if (!vapidKey || typeof vapidKey !== 'string') {
            return {
                isValid: false,
                error: 'VAPID key is missing or not a string',
            };
        }

        // Check basic format (should be base64url)
        const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
        const isBase64Url = base64UrlRegex.test(vapidKey);

        // Convert to standard base64
        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4);
        const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');

        // Try to decode
        let rawData: string;
        try {
            rawData = window.atob(base64);
        } catch (e) {
            return {
                isValid: false,
                error: 'Invalid base64 encoding',
                details: {
                    originalLength: vapidKey.length,
                    base64Length: base64.length,
                    uint8ArrayLength: 0,
                    isBase64Url,
                    hasCorrectLength: false,
                },
            };
        }

        // Convert to Uint8Array
        const uint8Array = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            uint8Array[i] = rawData.charCodeAt(i);
        }

        // P-256 public keys should be 65 bytes (uncompressed format)
        // or 33 bytes (compressed format)
        const hasCorrectLength = uint8Array.length === 65 || uint8Array.length === 33;

        const details = {
            originalLength: vapidKey.length,
            base64Length: base64.length,
            uint8ArrayLength: uint8Array.length,
            isBase64Url,
            hasCorrectLength,
        };

        if (!hasCorrectLength) {
            return {
                isValid: false,
                error: `Invalid key length: ${uint8Array.length} bytes (expected 65 or 33)`,
                details,
            };
        }

        // Check if it starts with 0x04 (uncompressed point indicator for P-256)
        if (uint8Array.length === 65 && uint8Array[0] !== 0x04) {
            return {
                isValid: false,
                error: 'Invalid uncompressed key format (should start with 0x04)',
                details,
            };
        }

        // Check if it starts with 0x02 or 0x03 (compressed point indicators)
        if (uint8Array.length === 33 && uint8Array[0] !== 0x02 && uint8Array[0] !== 0x03) {
            return {
                isValid: false,
                error: 'Invalid compressed key format (should start with 0x02 or 0x03)',
                details,
            };
        }

        return {
            isValid: true,
            details,
        };
    } catch (error) {
        return {
            isValid: false,
            error: `Validation error: ${error.message}`,
        };
    }
}

// Helper to generate a test VAPID key for development
export function generateTestVapidKey(): string {
    // This is a dummy implementation - real VAPID keys should be generated server-side
    // This creates a properly formatted but non-functional key for testing
    const bytes = new Uint8Array(65);
    bytes[0] = 0x04; // Uncompressed point indicator

    // Fill with random-ish data (not cryptographically secure)
    for (let i = 1; i < 65; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }

    // Convert to base64url
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert standard base64 to base64url
export function toBase64Url(base64: string): string {
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Convert base64url to standard base64
export function fromBase64Url(base64url: string): string {
    const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
    return (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
}
