import './logger';
import { Application } from 'express';
import { databaseLoader } from './database';
import '@/queues';

const initServer = async ({ app }: { app: Application }) => {
    await databaseLoader();
    console.log('🚀 Document processor initialized');
    return app;
};

export default initServer;
