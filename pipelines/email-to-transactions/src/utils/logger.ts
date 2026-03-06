import winston from 'winston';
import chalk from 'chalk';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

export interface LoggerConfig {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
}

type MetaType = Record<string, any> | string | boolean | number | any;

export interface ServiceLogger {
    info: (message: string, meta?: MetaType) => void;
    error: (message: string, meta?: MetaType) => void;
    warn: (message: string, meta?: MetaType) => void;
    debug: (message: string, meta?: MetaType) => void;

    red: (message: string, meta?: MetaType) => void;
    green: (message: string, meta?: MetaType) => void;
    yellow: (message: string, meta?: MetaType) => void;
    blue: (message: string, meta?: MetaType) => void;
    cyan: (message: string, meta?: MetaType) => void;
    magenta: (message: string, meta?: MetaType) => void;
}

export interface GlobalLogger {
    info: (message: string, meta?: MetaType) => void;
    error: (message: string, meta?: MetaType) => void;
    warn: (message: string, meta?: MetaType) => void;
    debug: (message: string, meta?: MetaType) => void;
    serviceLog: (service: string, message: string, meta?: MetaType, indentation?: number) => void;
    serviceError: (service: string, message: string, meta?: MetaType, indentation?: number) => void;
    createServiceLogger: (serviceName: string, defaultIndentation?: number) => ServiceLogger;

    black: (message: string, meta?: MetaType) => void;
    red: (message: string, meta?: MetaType) => void;
    green: (message: string, meta?: MetaType) => void;
    yellow: (message: string, meta?: MetaType) => void;
    blue: (message: string, meta?: MetaType) => void;
    magenta: (message: string, meta?: MetaType) => void;
    cyan: (message: string, meta?: MetaType) => void;
    white: (message: string, meta?: MetaType) => void;
    gray: (message: string, meta?: MetaType) => void;

    blackBright: (message: string, meta?: MetaType) => void;
    redBright: (message: string, meta?: MetaType) => void;
    greenBright: (message: string, meta?: MetaType) => void;
    yellowBright: (message: string, meta?: MetaType) => void;
    blueBright: (message: string, meta?: MetaType) => void;
    magentaBright: (message: string, meta?: MetaType) => void;
    cyanBright: (message: string, meta?: MetaType) => void;
    whiteBright: (message: string, meta?: MetaType) => void;
}

const LOG_DIR = path.resolve(process.cwd(), 'logs');

// File format — JSON, one line per entry, easy to grep
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Console format — colored, human readable
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
        const servicePrefix = service ? chalk.yellow(`[${service}]`) + ' ' : '';
        const metaStr = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
        return `${chalk.gray(timestamp)} ${servicePrefix}${message}${metaStr}`;
    })
);

class Logger implements GlobalLogger {
    private winston: winston.Logger;

    constructor() {
        this.winston = winston.createLogger({
            level: 'debug',
            transports: [
                new winston.transports.Console({ format: consoleFormat }),
                new DailyRotateFile({
                    dirname: LOG_DIR,
                    filename: '%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    maxFiles: '14d',
                    maxSize: '50m',
                    format: fileFormat,
                }),
                new DailyRotateFile({
                    dirname: LOG_DIR,
                    filename: '%DATE%-error.log',
                    datePattern: 'YYYY-MM-DD',
                    maxFiles: '30d',
                    maxSize: '50m',
                    level: 'error',
                    format: fileFormat,
                }),
            ],
        });
    }

    // Core methods — all go through winston
    info(message: string, meta?: MetaType) {
        this.winston.info(message, this.normalizeMeta(meta));
    }

    error(message: string, meta?: MetaType) {
        this.winston.error(message, this.normalizeMeta(meta));
    }

    warn(message: string, meta?: MetaType) {
        this.winston.warn(message, this.normalizeMeta(meta));
    }

    debug(message: string, meta?: MetaType) {
        this.winston.debug(message, this.normalizeMeta(meta));
    }

    serviceLog(service: string, message: string, meta?: MetaType) {
        this.winston.info(message, { service, ...this.normalizeMeta(meta) });
    }

    serviceError(service: string, message: string, meta?: MetaType) {
        this.winston.error(message, { service, ...this.normalizeMeta(meta) });
    }

    createServiceLogger(serviceName: string, defaultIndentation: number = 0): ServiceLogger {
        return new ServiceLoggerImpl(serviceName, defaultIndentation, this);
    }

    // Colored console methods — also route through winston so they land in files
    black(message: string, meta?: MetaType) { this.info(message, meta); }
    red(message: string, meta?: MetaType) { this.error(message, meta); }
    green(message: string, meta?: MetaType) { this.info(message, meta); }
    yellow(message: string, meta?: MetaType) { this.warn(message, meta); }
    blue(message: string, meta?: MetaType) { this.info(message, meta); }
    magenta(message: string, meta?: MetaType) { this.info(message, meta); }
    cyan(message: string, meta?: MetaType) { this.info(message, meta); }
    white(message: string, meta?: MetaType) { this.info(message, meta); }
    gray(message: string, meta?: MetaType) { this.debug(message, meta); }
    blackBright(message: string, meta?: MetaType) { this.info(message, meta); }
    redBright(message: string, meta?: MetaType) { this.error(message, meta); }
    greenBright(message: string, meta?: MetaType) { this.info(message, meta); }
    yellowBright(message: string, meta?: MetaType) { this.warn(message, meta); }
    blueBright(message: string, meta?: MetaType) { this.info(message, meta); }
    magentaBright(message: string, meta?: MetaType) { this.info(message, meta); }
    cyanBright(message: string, meta?: MetaType) { this.info(message, meta); }
    whiteBright(message: string, meta?: MetaType) { this.info(message, meta); }

    private normalizeMeta(meta?: MetaType): Record<string, any> {
        if (!meta) return {};
        if (typeof meta === 'object' && !Array.isArray(meta)) return meta;
        return { value: meta };
    }
}

class ServiceLoggerImpl implements ServiceLogger {
    constructor(
        private serviceName: string,
        private defaultIndentation: number = 0,
        private globalLogger: Logger = logger
    ) {}

    info(message: string, meta?: MetaType): void {
        this.globalLogger.serviceLog(this.serviceName, message, meta);
    }

    error(message: string, meta?: MetaType): void {
        this.globalLogger.serviceError(this.serviceName, message, meta);
    }

    warn(message: string, meta?: MetaType): void {
        (this.globalLogger as any).winston.warn(message, { service: this.serviceName, ...(this.globalLogger as any).normalizeMeta(meta) });
    }

    debug(message: string, meta?: MetaType): void {
        (this.globalLogger as any).winston.debug(message, { service: this.serviceName, ...(this.globalLogger as any).normalizeMeta(meta) });
    }

    red(message: string, meta?: MetaType): void { this.error(message, meta); }
    green(message: string, meta?: MetaType): void { this.info(message, meta); }
    yellow(message: string, meta?: MetaType): void { this.warn(message, meta); }
    blue(message: string, meta?: MetaType): void { this.info(message, meta); }
    cyan(message: string, meta?: MetaType): void { this.info(message, meta); }
    magenta(message: string, meta?: MetaType): void { this.info(message, meta); }
}

export const logger = new Logger();
export default logger;
