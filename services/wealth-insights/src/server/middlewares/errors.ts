import { NextFunction, Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response) => {
    const err = new Error(`Can't find ${req.originalUrl} on this server!`);
    return res.status(404).json({
        message: err.message,
    });
};

export const thrownErrorHandler = (error: Error | any, req: Request, res: Response, next: NextFunction) => {
    return res.status(500).json({
        success: false,
    });
};
