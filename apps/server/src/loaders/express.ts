import { Application } from 'express';
import * as Sentry from '@sentry/node';
import { httpMiddleware, securityMiddleware } from '@/middlewares';
import { notFoundHandler, thrownErrorHandler } from '@/middlewares/errors';
import routes from '@/routes';
import moment from 'moment';
import 'colors';
import { loadAccountFromToken } from '@/middlewares/cookies';
import session from 'express-session';

export const expressLoader = async ({ app }: { app: Application }) => {
	moment().utcOffset(0);
	httpMiddleware({ app });
	securityMiddleware({ app });

	// health check
	app.get('/health', (_req, res) => {
		res.status(200).json({ status: 'ok' });
	});

	//routes
	app.use(loadAccountFromToken);
	app.use(
		session({
			secret: 'cat',
			resave: false,
			saveUninitialized: true,
			cookie: { secure: process.env.NODE_ENV === 'production' },
		})
	);
	app.use('/api/v1', routes);
	Sentry.setupExpressErrorHandler(app);
	app.use(thrownErrorHandler);
	app.use('*', notFoundHandler);

	return app;
};
