import { Response } from 'express';
import * as Sentry from '@sentry/node';
import { AppError, HttpCode } from './AppError';

class ErrorHandler {
	public handleError(error: Error | AppError, response?: Response): void {
		if (this.isTrustedError(error) && response) {
			this.handleTrustedError(error as AppError, response);
		} else {
			this.handleUntrustedError(error, response);
		}
	}

	public isTrustedError(error: Error): boolean {
		console.log(error);
		if (error instanceof AppError) {
			logger.error(error.isOperational ? 'Application encountered a trusted error.' : '');
			return error.isOperational;
		}
		return false;
	}

	private handleTrustedError(error: AppError, response: Response): void {
		response.status(error.httpCode).json({
			message: error.message,
			code: error.code,
		});
	}

	private handleUntrustedError(error: Error | AppError, response?: Response): void {
		console.log(error)
		Sentry.captureException(error);
		if (response) {
			response
				.status(HttpCode.INTERNAL_SERVER_ERROR)
				.json({ message: 'Internal server error' });
		}
	}
}

export const errorHandler = new ErrorHandler();
