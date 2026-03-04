const STORAGE_KEY = 'admin-env';

export type EnvKey = 'local' | 'beta' | 'dev' | 'production';

export const ENV_OPTIONS: Record<EnvKey, { label: string; apiUrl: string; color: string }> = {
    local: { label: 'Local', apiUrl: 'http://localhost:8000', color: '#22c55e' },
    dev: { label: 'Dev', apiUrl: 'https://api-dev.flexxmoney.in', color: '#eab308' },
    beta: { label: 'Beta', apiUrl: 'https://api-beta.flexxmoney.in', color: '#eab308' },
    production: { label: 'Production', apiUrl: 'https://api.flexxmoney.in', color: '#ef4444' },
};

function detectEnvFromBuildUrl(): EnvKey {
    const buildUrl = import.meta.env.VITE_API_URL as string | undefined;
    if (!buildUrl) return 'local';
    for (const [key, opt] of Object.entries(ENV_OPTIONS)) {
        if (buildUrl.startsWith(opt.apiUrl)) return key as EnvKey;
    }
    return 'local';
}

export function getActiveEnv(): EnvKey {
    const stored = localStorage.getItem(STORAGE_KEY) as EnvKey | null;
    if (stored && stored in ENV_OPTIONS) return stored;
    return detectEnvFromBuildUrl();
}

export function setActiveEnv(key: EnvKey): void {
    localStorage.setItem(STORAGE_KEY, key);
    window.location.reload();
}

export function getApiUrl(): string {
    console.log('getActiveEnv', getActiveEnv());
    return ENV_OPTIONS[getActiveEnv()].apiUrl;
}
