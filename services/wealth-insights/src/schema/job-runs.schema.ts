import { JobRun } from '@/types/storage/job-run.type';
import { Document, Schema, model } from 'mongoose';

export interface IJobRunDoc extends Document, Omit<JobRun, '_id'> {}

const aiUsageSchema = new Schema(
    {
        model: { type: String, required: true },
        calls: { type: Number, default: 0 },
        tokens: {
            inputTokens: { type: Number, default: 0 },
            outputTokens: { type: Number, default: 0 },
            cachedInputTokens: { type: Number, default: 0 },
            cacheWriteTokens: { type: Number, default: 0 },
        },
        cost: {
            inputCost: { type: Number, default: 0 },
            cachedInputCost: { type: Number, default: 0 },
            cacheWriteCost: { type: Number, default: 0 },
            outputCost: { type: Number, default: 0 },
            totalCost: { type: Number, default: 0 },
        },
    },
    { _id: false }
);

const schema = new Schema<IJobRunDoc>(
    {
        pan: { type: String, index: true, default: null },
        email: { type: String, default: null },

        jobType: { type: String, required: true, enum: ['insights_generation', 'statement_acquisition', 'sync'] },
        jobId: { type: String, required: true, index: true },
        trigger: { type: String, enum: ['initial', 'sync', 'scheduled', 'manual'], default: 'manual' },

        status: { type: String, required: true, enum: ['running', 'completed', 'failed'], default: 'running' },
        startedAt: { type: Date, required: true, default: Date.now },
        completedAt: { type: Date, default: null },
        durationMs: { type: Number, default: null },
        error: { type: String, default: null },

        aiUsage: { type: [aiUsageSchema], default: [] },
        totalAICostUsd: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 },

        metrics: {
            insightCardsGenerated: { type: Number, default: null },
            anomaliesDetected: { type: Number, default: null },
            gapCardsFound: { type: Number, default: null },
            dashboardComputed: { type: Boolean, default: false },
            isFirstRun: { type: Boolean, default: false },
            analysisVersion: { type: Number, default: null },
        },

        context: { type: Schema.Types.Mixed, default: {} },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.job.runs',
    }
);

schema.index({ pan: 1, startedAt: -1 });
schema.index({ jobType: 1, startedAt: -1 });
schema.index({ status: 1 });

export const JobRunModel = model<IJobRunDoc>('mfs.job.runs', schema);
