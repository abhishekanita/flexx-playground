import mongoose, { ConnectOptions } from 'mongoose';
import { config } from '@/config';

export const databaseLoader = async (): Promise<void> => {
    try {
        const options: ConnectOptions = {};
        await mongoose.connect(config.db.uri + '/' + config.db.name, options);
        logger.info(`Connected to database`);
    } catch (err) {
        logger.error('Error connecting to Mysql database');
        logger.error(err);
        throw err;
    }
};
