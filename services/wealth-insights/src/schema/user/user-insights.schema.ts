import { MFUserInsights } from '@/types/storage/user-insights.type';
import { Document, Schema, model } from 'mongoose';

export interface IMFUserInsightsDoc extends Document, Omit<MFUserInsights, '_id'> {}

const schema = new Schema<IMFUserInsightsDoc>(
    {
        pan: { type: String, required: true, index: true },
        email: { type: String, required: true, index: true },
        version: { type: Number, default: 1 },
        generatedAt: { type: Date, default: Date.now },
        trigger: { type: String, enum: ['initial', 'sync', 'scheduled', 'manual'], default: 'sync' },
        dashboardData: Schema.Types.Mixed,
        insightCards: Schema.Types.Mixed,
        insightCardsStatus: { type: String, enum: ['pending', 'ready', 'failed'], default: 'pending' },
        analysis: Schema.Types.Mixed,
        nextScheduledRefresh: { type: Date },
        llmCostUsd: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.user.insights',
    }
);

schema.index({ pan: 1, generatedAt: -1 });

export const MFUserInsightsModel = model<IMFUserInsightsDoc>('mfs.user.insights', schema);
