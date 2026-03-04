import path from 'path';
import logger, { LoggerConfig } from '../utils/logger';

const loggerConfig: LoggerConfig = {
    level: (process.env.LOG_LEVEL as any) || 'info',
    enableConsole: process.env.LOG_CONSOLE !== 'false',
    enableFile: process.env.LOG_FILE === 'true',
    logDirectory: process.env.LOG_DIR || path.join(process.cwd(), 'logs'),
};

async function initializeLogger() {
    try {
        logger.initialize(loggerConfig);
        logger.info('Logger initialized successfully');
        globalThis.logger = logger;
        return true;
    } catch (error) {
        console.error('Failed to initialize logger:', error);
        return false;
    }
}

initializeLogger();
