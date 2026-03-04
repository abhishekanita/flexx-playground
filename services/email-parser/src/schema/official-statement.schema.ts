import mongoose, { Document, Schema, Types } from 'mongoose';
import type { StatementType, StatementPeriod, ParsedStatementTransaction } from '@/types/financial.types';

export interface IOfficialStatement {
    userId: Types.ObjectId;
    rawEmailId: Types.ObjectId;
    statementType: StatementType;
    provider: string;

    accountNumber?: string;
    statementPeriod: StatementPeriod;
    openingBalance?: number;
    closingBalance?: number;

    parsedTransactions: ParsedStatementTransaction[];
}

export interface IOfficialStatementDoc extends Document, IOfficialStatement {
    createdAt: Date;
    updatedAt: Date;
}

const ParsedTxnSchema = new Schema(
    {
        date: { type: Date, required: true },
        description: { type: String, required: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ['debit', 'credit'], required: true },
        balance: Number,
        channel: String,
        merchant: String,
        synced: { type: Boolean, default: false },
        transactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
    },
    { _id: false }
);

const OfficialStatementSchema = new Schema<IOfficialStatementDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        rawEmailId: { type: Schema.Types.ObjectId, ref: 'RawEmail', required: true },
        statementType: {
            type: String,
            enum: ['savings', 'current', 'fd', 'credit_card', 'mutual_fund_cas', 'demat'],
            required: true,
        },
        provider: { type: String, required: true },

        accountNumber: String,
        statementPeriod: {
            from: Date,
            to: Date,
        },
        openingBalance: Number,
        closingBalance: Number,

        parsedTransactions: [ParsedTxnSchema],
    },
    { timestamps: true, versionKey: false, collection: 'official_statements' }
);

OfficialStatementSchema.index({ userId: 1, rawEmailId: 1 }, { unique: true });
OfficialStatementSchema.index({ userId: 1, provider: 1, statementType: 1 });

export const OfficialStatement = mongoose.model<IOfficialStatementDoc>(
    'OfficialStatement',
    OfficialStatementSchema
);
