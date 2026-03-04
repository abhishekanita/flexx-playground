import { NextFunction, Request, Response } from 'express';

type AsyncResult<T> = [T | null, Error | null];

async function asyncWrapper<T>(promise: Promise<T>): Promise<AsyncResult<T>> {
	try {
		const data = await promise;
		return [data, null];
	} catch (error) {
		return [null, error];
	}
}

type ApiController = (req: Request, res: Response, next: NextFunction) => Promise<void | Response>;

export const asyncHandler =
	(execution: ApiController) => async (req: Request, res: Response, next: NextFunction) => {
		try {
			await execution(req, res, next);
		} catch (err) {
			logger.error(err);
			next(err);
		}
	};

export default asyncWrapper;
