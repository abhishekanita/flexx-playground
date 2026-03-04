import { GlobalLogger } from './src/utils/logger';

declare global {
    // eslint-disable-next-line no-var
    var logger: GlobalLogger;
    // eslint-disable-next-line no-var
    var redis: any;
    // eslint-disable-next-line no-var
    var mysqlDb: any;
}

globalThis.redis = {
    get: (key: string) => Promise<any | null>,
    set: (key: string, data: any, expiry = 100) => Promise<void>,
    invalidate: (key: string) => Promise<void>,
};

export {};
