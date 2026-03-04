import './logger';
import { Application } from 'express';
import { expressLoader } from './express';
import { databaseLoader } from './database';
import { redisLoader } from './redis';
const initServer = async ({ app }: { app: Application }) => {
    await databaseLoader();
    await expressLoader({ app });
    await redisLoader();
    console.log('🚀 Document processor initialized');
    return app;
};

export default initServer;
