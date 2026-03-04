import { NextFunction, Request, Response } from 'express';
import { errorHandler } from '@/definitions/exceptions/ErrorHandler';
import { AppError } from '@/definitions/exceptions/AppError';

export const notFoundHandler = (req: Request, res: Response) => {
	const err = new Error(`Can't find ${req.originalUrl} on this server!`);
	return res.status(404).json({
		message: err.message,
	});
};

export const thrownErrorHandler = (
	error: Error | AppError | any,
	req: Request,
	res: Response,
	//eslint-disable-next-line @typescript-eslint/no-unused-vars
	next: NextFunction
) => {
	errorHandler.handleError(error, res);
};
