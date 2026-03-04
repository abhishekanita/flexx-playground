import { Document, Schema, model, Types } from 'mongoose';

export interface IMandateEnrichedData {
    subscriptionName?: string;
    planName?: string;
    billingAmount?: number;
    billingCycle?: string;
    lastChargeDate?: string;
    providerEmail?: string;
}

export interface IMandate {
    userId: Types.ObjectId;
    umn: string;
    payeeName: string;
    amount: number;
    recurrance: string;
    status: 'ACTIVE' | 'INACTIVE';
    category: string;
    totalExecutionCount: number;
    totalExecutionAmount: number;
    isPause: boolean;
    isRevoke: boolean;
    isUnpause: boolean;
    enrichmentStatus: 'pending' | 'enriched' | 'failed' | 'skipped';
    enrichedData?: IMandateEnrichedData;
    lastSyncedAt: Date;
    lastEnrichmentAttemptAt?: Date;
}

export interface IMandateDoc extends Document, IMandate {}

export const MandateSchema = new Schema<IMandateDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        umn: { type: String, required: true },
        payeeName: { type: String, required: true },
        amount: { type: Number, required: true },
        recurrance: { type: String, required: true },
        status: { type: String, enum: ['ACTIVE', 'INACTIVE'], required: true },
        category: { type: String, required: true },
        totalExecutionCount: { type: Number, default: 0 },
        totalExecutionAmount: { type: Number, default: 0 },
        isPause: { type: Boolean, default: false },
        isRevoke: { type: Boolean, default: false },
        isUnpause: { type: Boolean, default: false },
        enrichmentStatus: {
            type: String,
            enum: ['pending', 'enriched', 'failed', 'skipped'],
            default: 'pending',
        },
        enrichedData: { type: Schema.Types.Mixed },
        lastSyncedAt: { type: Date, default: Date.now },
        lastEnrichmentAttemptAt: { type: Date },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mandates',
    }
);

MandateSchema.index({ userId: 1, umn: 1 }, { unique: true });

export const MandateModel = model<IMandateDoc>('Mandate', MandateSchema);
