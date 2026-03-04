import * as dotenv from 'dotenv';
import * as path from 'path';
import { getOsEnv, getOsEnvOptional, normalizePort } from './utils';

console.log(`NODE_ENV: ${process.env.NODE_ENV}`);

dotenv.config({
    path: path.join(process.cwd(), `.env.${process.env.NODE_ENV ? process.env.NODE_ENV : 'dev'}`),
});

export const config = {
    node: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isStaging: process.env.NODE_ENV === 'staging',
    isDevelopment: process.env.NODE_ENV === 'development',
    app: {
        name: getOsEnv('APP_NAME'),
        port: normalizePort(getOsEnv('API_SERVER_PORT')),
        cors: getOsEnv('CORS_ORIGIN'),
        dashboardUrl: getOsEnv('DASHBOARD_URL'),
        apiUrl: getOsEnv('SERVER_URL'),
    },
    jwt: {
        secret: getOsEnv('JWT_SECRET'),
        expiresIn: getOsEnv('JWT_EXPIRES_IN'),
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
    google: {
        clientId: getOsEnv('GOOGLE_CLIENT_ID'),
        clientSecret: getOsEnv('GOOGLE_CLIENT_SECRET'),
        redirectUrl: getOsEnv('GOOGLE_REDIRECT_URL'),
    },
    fileUpload: {
        maxFileSize: 50 * 1024 * 1024,
    },
    cloudinary: {
        cloudName: getOsEnv('CLOUDINARY_CLOUD_NAME'),
        apiKey: getOsEnv('CLOUDINARY_API_KEY'),
        apiSecret: getOsEnv('CLOUDINARY_API_SECRET'),
    },
    sentry: {
        dsn: getOsEnvOptional('SENTRY_DSN') || '',
    },
    otpless: {
        enabled: process.env.OTPLESS_ENABLED === 'true',
        appId: getOsEnv('OTPLESS_APP_ID'),
        clientId: getOsEnv('OTPLESS_CLIENT_ID'),
        clientSecret: getOsEnv('OTPLESS_CLIENT_SECRET'),
    },
    razorpay: {
        keyId: getOsEnv('RAZORPAY_KEY_ID'),
        keySecret: getOsEnv('RAZORPAY_KEY_SECRET'),
        webhookSecret: getOsEnv('RAZORPAY_WEBHOOK_SECRET'),
        planId: getOsEnv('RAZORPAY_PLAN_ID'),
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
    finfactor: {
        baseUrl: getOsEnvOptional('FINFACTOR_BASE_URL') || 'https://rpnfintralease.fiulive.finfactor.co.in',
        userId: getOsEnv('FINFACTOR_USER_ID'),
        password: getOsEnv('FINFACTOR_PASSWORD'),
        channelId: getOsEnv('FINFACTOR_CHANNEL_ID'),
        aaId: getOsEnvOptional('FINFACTOR_AA_ID') || 'cookiejaraalive@finvu',
    },
    crifHighmark: {
        baseUrl: getOsEnvOptional('CRIF_BASE_URL') || 'https://test.crifhighmark.com',
        cirBaseUrl: getOsEnvOptional('CRIF_CIR_BASE_URL') || 'https://cir.crifhighmark.com',
        accessCode: getOsEnv('CRIF_ACCESS_CODE'),
        appId: getOsEnv('CRIF_APP_ID'),
        merchantId: getOsEnv('CRIF_MERCHANT_ID'),
        productCode: getOsEnvOptional('CRIF_PRODUCT_CODE') || 'BBC_CONSUMER_SCORE#85#2.0',
    },
};
