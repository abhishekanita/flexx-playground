import { AppError } from '@/definitions/exceptions/AppError';
import { IRequest, IResponse } from '@/types/server';
import { NextFunction } from 'express';

export const requireSubscription = (req: IRequest, res: IResponse, next: NextFunction) => {
    if (!req.user) {
        throw new AppError('User not logged in', 401);
    }
    if (!req.user.isSubscribed) {
        return res.status(403).json({
            requiresSubscription: true,
            message: 'This content requires an active subscription',
        });
    }
    next();
};
