import { MFUserSnapshot } from '@/types/storage/user-snapshot.type';
import { Document, Schema, model } from 'mongoose';

export interface IMFUserSnapshotDoc extends Document, Omit<MFUserSnapshot, '_id'> {}

const schema = new Schema<IMFUserSnapshotDoc>(
    {
        pan: { type: String, required: true, unique: true },
        investor: {
            name: { type: String },
            email: { type: String },
            pan: { type: String },
        },
        statementPeriod: {
            from: { type: String },
            to: { type: String },
        },
        summary: {
            totalCostValue: { type: Number, default: 0 },
            totalMarketValue: { type: Number, default: 0 },
            totalUnrealisedGain: { type: Number, default: 0 },
            totalUnrealisedGainPct: { type: Number, default: 0 },
            activeFolioCount: { type: Number, default: 0 },
            closedFolioCount: { type: Number, default: 0 },
            totalInvested: { type: Number, default: 0 },
            totalWithdrawn: { type: Number, default: 0 },
            lifetimePnL: { type: Number, default: 0 },
            lifetimePnLPct: { type: Number, default: 0 },
        },
        holdings: [Schema.Types.Mixed],
        fundHouseSummary: [Schema.Types.Mixed],
        lastSyncedAt: { type: Date },
        syncCount: { type: Number, default: 0 },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.user.snapshot',
    }
);

export const MFUserSnapshotModel = model<IMFUserSnapshotDoc>('mfs.user.snapshot', schema);
