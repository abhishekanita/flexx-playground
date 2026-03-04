import './logger';
import { Application } from 'express';
import { databaseLoader } from './database';
import { expressLoader } from './express';

const initServer = async ({ app }: { app: Application }) => {
    await databaseLoader();
    await expressLoader({ app });

    return app;
};

export default initServer;
