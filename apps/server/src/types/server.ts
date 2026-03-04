import { IUserAccountDoc } from '@/schema';
import { Request, Response } from 'express';

export interface IRequest extends Request {
    user?: IUserAccountDoc;
    requestId?: string;
    rawBody: any;
}

export interface IResponse extends Response {
    user?: any;
}
