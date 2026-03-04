import { AppError } from '@/definitions/exceptions/AppError';
import { IRequest, IResponse } from '@/types/server';
import { NextFunction } from 'express';

export const isLoggedIn = (req: IRequest, res: IResponse, next: NextFunction) => {
    if (!req.user) {
        throw new AppError('User not logged in', 401);
    }
    next();
};
