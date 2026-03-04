import { signJwt, verifyJwt } from '@/utils/hashing';
import { Response } from 'express';
import { IRequest } from '@/types/server';
import { ObjectId } from 'mongoose';
import userService from '@/services/user/user.service';

export async function loadAccountFromToken(req: IRequest, _res: Response, next: any) {
    try {
        const headers = req.headers;
        const authHeader = headers['authorization'] as string;
        const token = authHeader?.split(' ')[1];
        if (!token || token === '') {
            return next();
        }
        const decoded = (await verifyJwt(token)) as { accountId: string };
        if (!decoded) return next();
        const user = await userService.getUser(decoded.accountId);
        if (!user) return next();
        if (user.isDeleted) return next();
        req.user = user;
        next();
    } catch (err) {
        next();
    }
}

export async function sendAuthCookie(req: IRequest, res: Response, accountId: string | ObjectId) {
    if (!accountId) {
        res.clearCookie('auth-token');
        return;
    }
    let isPostman = false;
    if (req.headers['user-agent']) {
        isPostman = req.headers['user-agent'].includes('PostmanRuntime');
    }
    const jwtToken = await signJwt({ accountId: accountId.toString() });
    return sendCookie(res, 'auth-token', jwtToken, isPostman);
}

export function sendCookie(res: Response, cookieName: string, data: string | any, isPostman?: boolean) {
    if (isPostman) {
        return res.cookie(cookieName, data, {
            maxAge: 15 * 24 * 60 * 60 * 1000,
            sameSite: 'none',
        });
    } else {
        return res.cookie(cookieName, data, {
            maxAge: 15 * 24 * 60 * 60 * 1000,
            sameSite: 'none',
            httpOnly: true,
            secure: true,
        });
    }
}
