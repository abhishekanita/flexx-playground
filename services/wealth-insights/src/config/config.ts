import * as dotenv from 'dotenv';
import * as path from 'path';
import { getOsEnv, getOsEnvArray, getOsEnvOptional } from './utils';

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

dotenv.config({
    path: path.join(process.cwd(), `.env.${process.env.NODE_ENV ? process.env.NODE_ENV : 'dev'}`),
});

export const config = {
    app: {
        port: getOsEnvOptional('PORT') || 8011,
        cors: getOsEnvArray('CORS_ORIGIN') || [],
    },
    db: {
        uri: getOsEnv('DB_URI'),
        name: getOsEnv('DB_NAME'),
    },
    redis: {
        url: getOsEnv('REDIS_URL'),
    },
    aws: {
        region: getOsEnv('AWS_REGION'),
        accessKeyId: getOsEnv('AWS_ACCESS_KEY_ID'),
        secretAccessKey: getOsEnv('AWS_SECRET_ACCESS_KEY'),
        publicBucketName: getOsEnv('AWS_PUBLIC_BUCKET_NAME'),
        privateBucketName: getOsEnv('AWS_PRIVATE_BUCKET_NAME'),
    },
    scraperApi: {
        apiKey: getOsEnvOptional('SCRAPER_API_KEY') || '',
    },
    google: {
        clientId: getOsEnvOptional('GOOGLE_CLIENT_ID') || '',
        clientSecret: getOsEnvOptional('GOOGLE_CLIENT_SECRET') || '',
        redirectUrl: getOsEnvOptional('GOOGLE_REDIRECT_URL'),
    },
    openai: {
        apiKey: getOsEnv('OPENAI_API_KEY'),
    },
    capsolver: {
        apiKey: getOsEnvOptional('CAPSOLVER_API_KEY') || '',
    },
    groww: {
        baseUrl: getOsEnvOptional('GROWW_BASE_URL') || 'https://groww.in',
    },
    dataimpulse: {
        host: getOsEnvOptional('DATAIMPULSE_HOST') || 'gw.dataimpulse.com',
        port: getOsEnvOptional('DATAIMPULSE_PORT') || '823',
        username: getOsEnvOptional('DATAIMPULSE_USERNAME') || '',
        password: getOsEnvOptional('DATAIMPULSE_PASSWORD') || '',
    },
};
