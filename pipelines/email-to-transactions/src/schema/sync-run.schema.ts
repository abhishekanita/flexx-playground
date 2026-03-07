import { EmailSyncRun } from '@/types/sync-jobs.types';
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISyncRunDoc extends Document, EmailSyncRun {}

const SyncRunSchema = new Schema<ISyncRunDoc>(
    {
        userId: Schema.Types.ObjectId,
        trigger: String,
        status: String,
        stages: [
            {
                name: String,
                status: String,
                startedAt: Date,
                completedAt: Date,
                metadata: Schema.Types.Mixed,
            },
        ],
        stats: {
            emailsFetched: { type: Number, default: 0 },
            emailsNew: { type: Number, default: 0 },
            emailsClassified: { type: Number, default: 0 },
            emailsParsed: { type: Number, default: 0 },
            emailsFailed: { type: Number, default: 0 },
            emailsSkipped: { type: Number, default: 0 },
            transactionsCreated: { type: Number, default: 0 },
            transactionsEnriched: { type: Number, default: 0 },
            invoicesCreated: { type: Number, default: 0 },
            llmCostUSD: { type: Number, default: 0 },
            totalTimeMs: { type: Number, default: 0 },
        },
        error: String,
    },
    { timestamps: true, versionKey: false }
);

SyncRunSchema.index({ userId: 1, createdAt: -1 });
SyncRunSchema.index({ status: 1 });

export const SyncRunModel = mongoose.model<ISyncRunDoc>('emails.sync', SyncRunSchema);
