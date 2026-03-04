import express from 'express';
import * as Sentry from '@sentry/node';
import initServer from '@/loaders';
import { config } from '@/config';
import { runScripts } from './scripts/run-scripts';

const startServer = async () => {
    try {
        logger.info('Starting server');
        const app = express();
        const server = await initServer({ app });

        server.listen(config.app.port, () => {
            logger.info(`
                ################################################
                🛡️  Server listening on port: ${config.app.port} 🛡️
                ################################################
                `);
        });
        await runScripts();
    } catch (err) {
        logger.error(err);
    }
};

process.on('uncaughtException', function (err) {
    console.log(err);
    Sentry.captureException(err);
    logger.error('exception');
});

process.on('unhandledRejection', function (reason) {
    Sentry.captureException(reason);
    logger.error('Unhandled rejection', reason);
});

startServer();
