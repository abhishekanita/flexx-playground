import { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
// import csurf from "csurf";
import { config } from '@/config';

export const securityMiddleware = ({ app }: { app: Application }) => {
	logger.info('Loading security middleware...');

	app.set('trust proxy', 1);

	//Enabling cors
	const cors_config = {
		origin: config.app.cors.split(','),
		methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
		credentials: true,
		optionsSuccessStatus: 200,
	};
	app.use(cors(cors_config));

	//Set up security headers using Helmet
	app.use(helmet());
	app.use(
		helmet.hsts({
			maxAge: 31536000,
		}),
	);

	return app;
};
