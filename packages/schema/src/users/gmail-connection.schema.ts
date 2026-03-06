import { Document, Schema, model } from 'mongoose';
import { GmailConnection } from '@playground/types';

// ─────────────────────────────────────────────────────────────────────────────
// GMAIL CONNECTION — OAuth tokens and sync state per connected Gmail account
// ─────────────────────────────────────────────────────────────────────────────

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
        timestamps: false,
        versionKey: false,
        collection: 'connections.gmail',
    }
);
