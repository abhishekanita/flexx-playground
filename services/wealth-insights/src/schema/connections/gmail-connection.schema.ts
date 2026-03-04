import { GmailConnection } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IGmailConnectionDoc extends Document, Omit<GmailConnection, '_id'> {}

export const GmailConnectionSchema = new Schema<IGmailConnectionDoc>(
    {
        email: { type: String, required: true, unique: true },
        googleId: { type: String, required: true },
        name: { type: String, required: true },
        picture: { type: String, default: '' },
        accessToken: { type: String, required: true },
        refreshToken: { type: String, required: true },
        tokenExpiresAt: { type: Date, required: true },
        scopes: { type: [String], default: [] },
        isActive: { type: Boolean, default: true },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'connections.gmail',
    }
);

export const GmailConnectionModel = model<IGmailConnectionDoc>('connections.gmail', GmailConnectionSchema);
