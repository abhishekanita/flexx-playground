import { ObjectId } from 'mongoose';
export interface AuthOTPs {
    _id: ObjectId;
    service: 'auth';
    phoneNumber: string;
    otp?: string;
    requestId?: string;
    expiresAt: Date;
    metadata?: Record<string, any>;
}
