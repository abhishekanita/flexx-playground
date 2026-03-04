import express, { Application } from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import fileUpload from 'express-fileupload';
import { config } from '@/config';
import { IRequest } from '@/types/server';

export const httpMiddleware = ({ app }: { app: Application }) => {
    logger.info(`Loading http middleware...`);

    const url_config = {
        extended: true,
        limit: '50mb',
        parameterLimit: 50000,
    };

    app.use(express.urlencoded(url_config));
    app.use('/api/v1/stripe/webhook', express.raw({ type: 'application/json' }));

    app.use(
        express.json({
            limit: '50mb',
            verify: function (req: IRequest, res, buf) {
                req.rawBody = buf;
            },
        })
    );
    app.use(cookieParser());
    app.use(
        fileUpload({
            limits: { fileSize: config.fileUpload.maxFileSize },
        })
    );

    //logger
    const api_logs_format = ':method :url :status :res[content-length] - :response-time ms';
    const stream = {
        write: (m: string) => logger.info(m),
    };
    app.use(morgan(api_logs_format, { stream }));
    return app;
};
