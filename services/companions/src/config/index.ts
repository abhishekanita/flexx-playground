import * as dotenv from 'dotenv';
import * as path from 'path';
import { getOsEnv, getOsEnvOptional, normalizePort } from './utils';

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

dotenv.config({
    path: path.join(process.cwd(), `.env.${process.env.NODE_ENV ? process.env.NODE_ENV : 'dev'}`),
});

export const config = {
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
    elevanLabs: {
        apiKey: getOsEnvOptional('ELEVENLABS_API_KEY') || '',
    },
    sarvam: {
        apiKey: getOsEnvOptional('SARVAM_API_KEY') || '',
    },
    openai: {
        apiKey: getOsEnv('OPENAI_API_KEY'),
    },
    gnews: {
        apiKey: getOsEnvOptional('GNEWS_API_KEY') || '',
    },
    serp: {
        apiKey: getOsEnvOptional('SERP_API_KEY') || '',
    },
    reddit: {
        clientId: getOsEnv('REDDIT_CLIENT_ID'),
        clientSecret: getOsEnv('REDDIT_CLIENT_SECRET'),
        username: getOsEnv('REDDIT_USERNAME'),
        password: getOsEnv('REDDIT_PASSWORD'),
        userAgent: getOsEnvOptional('REDDIT_USER_AGENT') || 'finbase-scraper/1.0',
    },
    youtube: {
        apiKey: getOsEnv('YOUTUBE_API_KEY'),
    },
    scraperApi: {
        apiKey: getOsEnvOptional('SCRAPER_API_KEY') || '',
    },
    apify: {
        apiToken: getOsEnvOptional('APIFY_API_TOKEN') || '',
    },
    crifHighmark: {
        baseUrl: getOsEnvOptional('CRIF_BASE_URL') || 'https://hub.crifhighmark.com',
        cirBaseUrl: getOsEnvOptional('CRIF_CIR_BASE_URL') || 'https://cir.crifhighmark.com',
        accessCode: getOsEnv('CRIF_ACCESS_CODE'),
        appId: getOsEnv('CRIF_APP_ID'),
        merchantId: getOsEnv('CRIF_MERCHANT_ID'),
        productCode: getOsEnvOptional('CRIF_PRODUCT_CODE') || 'BBC_CONSUMER_SCORE#85#2.0',
    },
    finfactor: {
        baseUrl: getOsEnvOptional('FINFACTOR_BASE_URL') || 'https://rpnfintralease.fiulive.finfactor.co.in',
        userId: getOsEnv('FINFACTOR_USER_ID'),
        password: getOsEnv('FINFACTOR_PASSWORD'),
        channelId: getOsEnv('FINFACTOR_CHANNEL_ID'),
        aaId: getOsEnvOptional('FINFACTOR_AA_ID') || 'cookiejaraalive@finvu',
    },
    google: {
        clientId: getOsEnvOptional('GOOGLE_CLIENT_ID') || '',
        clientSecret: getOsEnvOptional('GOOGLE_CLIENT_SECRET') || '',
        redirectUrl: getOsEnvOptional('GOOGLE_REDIRECT_URL') || 'http://localhost:3456/oauth/callback',
    },
    capsolver: {
        apiKey: getOsEnvOptional('CAPSOLVER_API_KEY') || '',
    },
    parallel: {
        apiKey: getOsEnvOptional('PARALLEL_API_KEY') || '',
    },
};
