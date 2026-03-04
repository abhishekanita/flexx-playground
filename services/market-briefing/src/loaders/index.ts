import './logger';
import { databaseLoader } from './database';
import { Application } from 'express';

const initServer = async () => {
    await databaseLoader();
};

export default initServer;
