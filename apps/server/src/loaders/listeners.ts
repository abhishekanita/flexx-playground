import { getFiles } from '@/utils/getFiles';

export const listenersLoader = async (): Promise<void> => {
	try {
		const listeners = getFiles(__dirname, '../tasks/listeners/**/*.ts');
		listeners.forEach((sqsListener) => {
			const sqsListenerModule = require(sqsListener);
			const sqsListenerInstance = new sqsListenerModule.default();
			sqsListenerInstance.start();
		});
	} catch (err) {
		logger.error('Error creating queue listeners!');
		logger.error(err);
		throw err;
	}
};
