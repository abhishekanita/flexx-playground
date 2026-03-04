import { MFUserTransaction } from '@/types/storage/user-transaction.type';
import { Document, Schema, model } from 'mongoose';

export interface IMFUserTransactionDoc extends Document, Omit<MFUserTransaction, '_id'> {}

const schema = new Schema<IMFUserTransactionDoc>(
    {
        pan: { type: String, required: true },
        email: { type: String, required: true, index: true },
        folioNumber: { type: String, required: true },
        schemeName: { type: String, required: true },
        isin: { type: String },
        date: { type: String, required: true },
        type: { type: String, required: true },
        channel: { type: String, default: null },
        advisorCode: { type: String, default: null },
        amount: { type: Number, default: null },
        nav: { type: Number, default: null },
        units: { type: Number, required: true },
        unitBalanceAfter: { type: Number, required: true },
        stampDuty: { type: Number, default: null },
        dedupKey: { type: String, required: true },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'mfs.user.transactions',
    }
);

schema.index({ dedupKey: 1 }, { unique: true });
schema.index({ pan: 1, date: -1 });
schema.index({ pan: 1, folioNumber: 1, date: -1 });

export const MFUserTransactionModel = model<IMFUserTransactionDoc>('mfs.user.transactions', schema);
