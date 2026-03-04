import { config } from '@/config';
import * as Sentry from '@sentry/node';

Sentry.init({
	dsn: config.sentry.dsn,
	environment: config.node,
	tracesSampleRate: config.isProduction ? 0.2 : 1.0,
	sendDefaultPii: true,
	enabled: !!config.sentry.dsn,
});
