import { Application } from 'express';
import * as Sentry from '@sentry/node';
import moment from 'moment';
import cors from 'cors';
import session from 'express-session';
import { config } from '@/config';
import { notFoundHandler, thrownErrorHandler } from '@/server/middlewares/errors';
import routes from '@/server/routes';

export const expressLoader = async ({ app }: { app: Application }) => {
    moment().utcOffset(0);
    app.set('trust proxy', 1);

    //Enabling cors
    const cors_config = {
        origin: config.app.cors,
        methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
        credentials: true,
        optionsSuccessStatus: 200,
    };
    app.use(cors(cors_config));

    // health check
    app.get('/health', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.use('/api/v1', routes);
    Sentry.setupExpressErrorHandler(app);
    app.use(thrownErrorHandler);
    app.use('*', notFoundHandler);
    return app;
};
