import { AuthOTPs } from '@/types';
import { Document, Schema } from 'mongoose';

export interface IOTPsDoc extends Document, Omit<AuthOTPs, '_id'> {}

export const AuthOTPsSchema = new Schema<IOTPsDoc>(
    {
        service: {
            type: String,
            required: true,
        },
        phoneNumber: {
            type: String,
        },
        otp: {
            type: String,
        },
        requestId: {
            type: String,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        metadata: {
            type: Object,
        },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'otps',
    }
);
