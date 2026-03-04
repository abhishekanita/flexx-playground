import { AppError } from '@/definitions/exceptions/AppError';
import { IRequest, IResponse } from '@/types/server';
import { NextFunction } from 'express';

export const isAdmin = (req: IRequest, res: IResponse, next: NextFunction) => {
    if (!req.user) {
        throw new AppError('User not logged in', 401);
    }
    if (!req.user.isAdmin) {
        throw new AppError('Access denied. Admin privileges required.', 403);
    }
    next();
};
