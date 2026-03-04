import logger from '@/utils/logger';

// Logger auto-initializes with console + file transports.
// This file just sets the global reference.
globalThis.logger = logger;
logger.info('Logger initialized — writing to console + logs/');
