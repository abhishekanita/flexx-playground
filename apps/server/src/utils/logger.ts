import winston from 'winston';
import chalk from 'chalk';

export interface LoggerConfig {
    level: 'error' | 'warn' | 'info' | 'debug';
    enableConsole: boolean;
    enableFile: boolean;
    logDirectory: string;
}

type MetaType = Record<string, any> | string | boolean | number | any;

// Service-specific logger interface
export interface ServiceLogger {
    info: (message: string, meta?: MetaType) => void;
    error: (message: string, meta?: MetaType) => void;
    warn: (message: string, meta?: MetaType) => void;
    debug: (message: string, meta?: MetaType) => void;

    // Colored logging methods
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

    // Basic colors
    black: (message: string, meta?: MetaType) => void;
    red: (message: string, meta?: MetaType) => void;
    green: (message: string, meta?: MetaType) => void;
    yellow: (message: string, meta?: MetaType) => void;
    blue: (message: string, meta?: MetaType) => void;
    magenta: (message: string, meta?: MetaType) => void;
    cyan: (message: string, meta?: MetaType) => void;
    white: (message: string, meta?: MetaType) => void;
    gray: (message: string, meta?: MetaType) => void;

    // Bright colors
    blackBright: (message: string, meta?: MetaType) => void;
    redBright: (message: string, meta?: MetaType) => void;
    greenBright: (message: string, meta?: MetaType) => void;
    yellowBright: (message: string, meta?: MetaType) => void;
    blueBright: (message: string, meta?: MetaType) => void;
    magentaBright: (message: string, meta?: MetaType) => void;
    cyanBright: (message: string, meta?: MetaType) => void;
    whiteBright: (message: string, meta?: MetaType) => void;
}

class Logger implements GlobalLogger {
    private winston: winston.Logger;
    private config: LoggerConfig;

    constructor() {
        this.winston = winston.createLogger({
            level: 'info',
            transports: [new winston.transports.Console()],
        });

        this.config = {
            level: 'info',
            enableConsole: true,
            enableFile: false,
            logDirectory: 'logs',
        };
    }

    initialize(config: LoggerConfig) {
        this.config = { ...this.config, ...config };

        const transports: winston.transport[] = [];

        if (this.config.enableConsole) {
            transports.push(
                new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.colorize(),
                        winston.format.timestamp(),
                        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
                            const servicePrefix = service ? `[${service}] ` : '';
                            const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                            return `${timestamp} ${servicePrefix}${level}: ${message} ${metaStr}`;
                        })
                    ),
                })
            );
        }

        if (this.config.enableFile) {
            transports.push(
                new winston.transports.File({
                    filename: `${this.config.logDirectory}/app.log`,
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json()
                    ),
                })
            );
        }

        this.winston = winston.createLogger({
            level: this.config.level,
            transports,
        });
    }

    // Basic colors
    black(message: string, meta?: MetaType) {
        console.log(chalk.black(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    red(message: string, meta?: MetaType) {
        console.log(chalk.red(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    green(message: string, meta?: MetaType) {
        console.log(chalk.green(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    yellow(message: string, meta?: MetaType) {
        console.log(chalk.yellow(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    blue(message: string, meta?: MetaType) {
        console.log(chalk.blue(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    magenta(message: string, meta?: MetaType) {
        console.log(chalk.magenta(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    cyan(message: string, meta?: MetaType) {
        console.log(chalk.cyan(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    white(message: string, meta?: MetaType) {
        console.log(chalk.white(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    gray(message: string, meta?: MetaType) {
        console.log(chalk.gray(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    // Bright colors
    blackBright(message: string, meta?: MetaType) {
        console.log(chalk.blackBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    redBright(message: string, meta?: MetaType) {
        console.log(chalk.redBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    greenBright(message: string, meta?: MetaType) {
        console.log(chalk.greenBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    yellowBright(message: string, meta?: MetaType) {
        console.log(chalk.yellowBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    blueBright(message: string, meta?: MetaType) {
        console.log(chalk.blueBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    magentaBright(message: string, meta?: MetaType) {
        console.log(chalk.magentaBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    cyanBright(message: string, meta?: MetaType) {
        console.log(chalk.cyanBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    whiteBright(message: string, meta?: MetaType) {
        console.log(chalk.whiteBright(message), meta ? JSON.stringify(meta, null, 2) : '');
    }

    info(message: string, meta?: MetaType) {
        this.winston.info(message, meta);
    }

    error(message: string, meta?: MetaType) {
        this.winston.error(message, meta);
    }

    warn(message: string, meta?: MetaType) {
        this.winston.warn(message, meta);
    }

    debug(message: string, meta?: MetaType) {
        this.winston.debug(message, meta);
    }

    serviceLog(service: string, message: string, indentation?: number, meta?: MetaType) {
        console.log(
            // !indentation || indentation === 0 ? '' : ' '.repeat(indentation ?? 0),
            chalk['yellow']?.(service),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    serviceError(service: string, message: string, indentation?: number, meta?: MetaType) {
        console.log(
            // !indentation || indentation === 0 ? '' : ' '.repeat(indentation ?? 0),
            chalk['red']?.(service),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    createServiceLogger(serviceName: string, defaultIndentation: number = 0): ServiceLogger {
        return new ServiceLoggerImpl(serviceName, defaultIndentation, this);
    }
}

// Service-specific logger implementation
class ServiceLoggerImpl implements ServiceLogger {
    constructor(
        private serviceName: string,
        private defaultIndentation: number = 0,
        private globalLogger: Logger = logger
    ) {}

    info(message: string, meta?: MetaType): void {
        this.globalLogger.serviceLog(this.serviceName, message, this.defaultIndentation, meta);
    }

    error(message: string, meta?: MetaType): void {
        this.globalLogger.serviceError(this.serviceName, message, this.defaultIndentation, meta);
    }

    warn(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.bgYellowBright(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    debug(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.gray(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    red(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.red(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    green(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.green(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    yellow(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.yellow(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    blue(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.blue(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    cyan(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.cyan(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }

    magenta(message: string, meta?: MetaType): void {
        console.log(
            // ' '.repeat(this.defaultIndentation),
            chalk.magenta(this.serviceName),
            message,
            meta ? JSON.stringify(meta, null, 2) : ''
        );
    }
}

export const logger = new Logger();
export default logger;
