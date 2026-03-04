import { Document, Schema, model, Types } from 'mongoose';

export interface IAppleSubscription {
    userId: Types.ObjectId;
    appName: string;
    plan: string;
    currentAmount: number;
    billingCycle: string;
    charges: { date: Date; amount: number }[];
    totalSpent: number;
    lastChargeDate: Date;
    isActive: boolean;
    lastSyncedAt: Date;
}

export interface IAppleSubscriptionDoc extends Document, IAppleSubscription {}

const ChargeSchema = new Schema(
    { date: { type: Date, required: true }, amount: { type: Number, required: true } },
    { _id: false }
);

export const AppleSubscriptionSchema = new Schema<IAppleSubscriptionDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        appName: { type: String, required: true },
        plan: { type: String, default: '' },
        currentAmount: { type: Number, required: true },
        billingCycle: { type: String, default: 'Monthly' },
        charges: { type: [ChargeSchema], default: [] },
        totalSpent: { type: Number, default: 0 },
        lastChargeDate: { type: Date },
        isActive: { type: Boolean, default: true },
        lastSyncedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'apple_subscriptions',
    }
);

AppleSubscriptionSchema.index({ userId: 1, appName: 1 }, { unique: true });

export const AppleSubscriptionModel = model<IAppleSubscriptionDoc>(
    'AppleSubscription',
    AppleSubscriptionSchema
);
