import { MFStatementsRequests } from '@/types/statements';
import { MFStatementCategory, MFStatementStatus } from '@/types/statements';
import { Document, Schema, model } from 'mongoose';

export interface IMFStatementsRequestsDoc extends Document, Omit<MFStatementsRequests, '_id'> {}

const schema = new Schema<IMFStatementsRequestsDoc>(
    {
        requestId: { type: String, required: true, unique: true },
        category: { type: String, required: true, enum: Object.values(MFStatementCategory) },
        email: { type: String, required: true, index: true },
        source: { type: String, default: 'CAMS' },
        status: { type: String, required: true, enum: Object.values(MFStatementStatus) },
        requestMeta: Schema.Types.Mixed,
        emailData: Schema.Types.Mixed,
        hasData: { type: Boolean, default: false },
        data: Schema.Types.Mixed,
        rawData: {
            type: { type: String, enum: ['pdf', 'json'] },
            value: { type: String },
        },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'statements.requests',
    }
);

export const MFStatementsRequestsModel = model<IMFStatementsRequestsDoc>('statements.requests', schema);
