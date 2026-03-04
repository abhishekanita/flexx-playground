import { Document, Schema, model } from 'mongoose';
import { GmailConnection } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// GMAIL CONNECTION — OAuth tokens and sync state per connected Gmail account
// ─────────────────────────────────────────────────────────────────────────────

export interface IGmailConnectionDoc extends Document, Omit<GmailConnection, '_id'> {}

const SyncStateSchema = new Schema(
    {
        totalFetched: { type: Number, default: 0 },
        totalFiltered: { type: Number, default: 0 },
        totalProcessed: { type: Number, default: 0 },
        lastSyncAt: Date,
        lastError: String,
    },
    { _id: false }
);

const GmailConnectionSchema = new Schema<IGmailConnectionDoc>(
    {
        connectionId: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true, index: true },
        accessToken: { type: String, required: true },
        refreshToken: { type: String, required: true },
        tokenExpiresAt: { type: Date, required: true },
        status: {
            type: String,
            enum: ['active', 'inactive', 'token_expired', 'revoked'],
            default: 'active',
            index: true,
        },
        syncState: { type: SyncStateSchema, default: () => ({}) },
        connectedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'gmail-connections',
    }
);

export const GmailConnectionModel = model<IGmailConnectionDoc>('GmailConnection', GmailConnectionSchema);
