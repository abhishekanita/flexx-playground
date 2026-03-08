import mongoose, { Schema, Document } from 'mongoose';
import { TransactionSignal } from '@/types/financial-data/signals.type';

export interface ITransactionSignalDoc extends Document, Omit<TransactionSignal, 'id'> {}

const TransactionSignalSchema = new Schema<ITransactionSignalDoc>(
    {
        transaction_id: { type: String, required: true, index: true },
        source_type: { type: String, required: true, index: true },
        source_id: { type: String, required: true },
        raw_email_id: String,
        parsed_data: { type: Schema.Types.Mixed, default: {} },
        confidence: { type: Number, default: 1 },
        fields_contributed: [String],
        received_at: { type: Date, required: true },
    },
    { timestamps: true, versionKey: false }
);

// Prevent duplicate signals from the same email
TransactionSignalSchema.index({ raw_email_id: 1, source_type: 1 });

export const TransactionSignalModel = mongoose.model<ITransactionSignalDoc>(
    'transaction-signals',
    TransactionSignalSchema
);
