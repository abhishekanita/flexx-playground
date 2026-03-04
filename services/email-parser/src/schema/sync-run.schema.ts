import mongoose, { Document, Schema, Types } from 'mongoose';
import type { SyncTrigger, SyncRunStatus, SyncStage, SyncStats } from '@/types/financial.types';

export interface ISyncRun {
    userId: Types.ObjectId;
    integrationId: Types.ObjectId;
    trigger: SyncTrigger;
    status: SyncRunStatus;
    stages: SyncStage[];
    stats: SyncStats;
    error?: string;
}

export interface ISyncRunDoc extends Document, ISyncRun {
    createdAt: Date;
    updatedAt: Date;
}

const SyncStageSchema = new Schema(
    {
        name: { type: String, required: true },
        status: {
            type: String,
            enum: ['pending', 'running', 'completed', 'failed', 'skipped'],
            default: 'pending',
        },
        startedAt: Date,
        completedAt: Date,
        metadata: Schema.Types.Mixed,
    },
    { _id: false }
);

const SyncStatsSchema = new Schema(
    {
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
    { _id: false }
);

const PIPELINE_STAGES = ['init', 'search-fetch', 'classify', 'parse', 'reconcile', 'finalize'];

const SyncRunSchema = new Schema<ISyncRunDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        integrationId: { type: Schema.Types.ObjectId, ref: 'IntegrationGmail', required: true },
        trigger: {
            type: String,
            enum: ['manual', 'scheduled', 'config-update', 'new-connection'],
            required: true,
        },
        status: {
            type: String,
            enum: ['running', 'completed', 'failed'],
            default: 'running',
        },
        stages: {
            type: [SyncStageSchema],
            default: () => PIPELINE_STAGES.map((name) => ({ name, status: 'pending' })),
        },
        stats: { type: SyncStatsSchema, default: () => ({}) },
        error: String,
    },
    { timestamps: true, versionKey: false, collection: 'sync_runs' }
);

SyncRunSchema.index({ userId: 1, createdAt: -1 });
SyncRunSchema.index({ status: 1 });

export const SyncRun = mongoose.model<ISyncRunDoc>('SyncRun', SyncRunSchema);
