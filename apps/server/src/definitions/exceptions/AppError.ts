import { ErrorTypes } from '@/definitions/exceptions/errors.enum';

export enum HttpCode {
    OK = 200,
    NO_CONTENT = 204,
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    INTERNAL_SERVER_ERROR = 500,
}

export class AppError extends Error {
    public readonly code: string;
    public readonly httpCode: HttpCode = 400;
    public readonly isOperational: boolean = true;

    constructor(message: string, httpCode?: HttpCode, isOperational?: boolean) {
        super(message);

        Object.setPrototypeOf(this, new.target.prototype);

        this.httpCode = httpCode || 400;

        if (isOperational !== undefined) {
            this.isOperational = isOperational;
        }
        // Error.captureStackTrace(this);
    }
}
