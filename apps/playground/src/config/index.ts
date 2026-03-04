import { getApiUrl } from './env';

export const API_URL = getApiUrl();
export const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
export const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL;

// Push Notifications Configuration
export const VAPID_PUBLIC_KEY =
    import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BCWvyL9Ut1e82QECQMROhi6KVD-q7aBrDWG_dRHFRGcfwX7Xxb6WXew5tJGPVSVeWNraRIcl2v-iU-BR_HY2RN8';

export const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || '40df792e-efee-47b2-8cb1-2388c2680774';
