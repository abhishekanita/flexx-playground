import { InsightState } from '@/types/advisory/insight-state.type';
import { Document, Schema, model } from 'mongoose';

export interface IInsightStateDoc extends Document, Omit<InsightState, '_id'> {}

const schema = new Schema<IInsightStateDoc>(
    {
        pan: { type: String, required: true },
        insightKey: { type: String, required: true },
        category: { type: String, enum: ['health', 'tax', 'behavioral', 'whatif'], required: true },
        frequencyType: { type: String, enum: ['ONCE', 'TRIGGERED', 'WEEKLY', 'MONTHLY', 'ON_DEMAND'], required: true },
        status: { type: String, enum: ['PENDING', 'READY', 'SHOWN', 'DISMISSED', 'SNOOZED'], default: 'PENDING' },
        conditionMet: { type: Boolean, default: false },
        conditionValue: Schema.Types.Mixed,
        relevanceScore: { type: Number, default: 0 },
        firstTriggeredAt: { type: Date, default: null },
        lastEvaluatedAt: { type: Date, default: Date.now },
        shownAt: { type: Date, default: null },
        dismissedAt: { type: Date, default: null },
        snoozeUntil: { type: Date, default: null },
        cardJourneyId: { type: String, default: null },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.user.insight-states',
    }
);

schema.index({ pan: 1, insightKey: 1 }, { unique: true });
schema.index({ pan: 1, status: 1, relevanceScore: -1 });

export const InsightStateModel = model<IInsightStateDoc>('mfs.user.insight-states', schema);
