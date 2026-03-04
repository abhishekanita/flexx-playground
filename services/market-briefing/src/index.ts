import express from 'express';
import initServer from '@/loaders';
import { config } from '@/config';
import { runScripts } from './scripts/run-scripts';

const startServer = async () => {
    try {
        logger.info('Starting server');
        await initServer();
        await runScripts();
    } catch (err) {
        logger.error(err);
    }
};

process.on('uncaughtException', function (err) {
    console.log(err);
    logger.error('exception');
});

process.on('unhandledRejection', function (reason) {
    logger.error('Unhandled rejection', reason);
});

startServer();
