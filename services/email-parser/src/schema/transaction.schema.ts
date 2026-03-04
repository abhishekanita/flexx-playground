import mongoose, { Document, Schema, Types } from 'mongoose';
import type {
    TransactionType,
    TransactionChannel,
    TransactionSource,
    TransactionEnrichment,
} from '@/types/financial.types';

export interface ITransaction {
    userId: Types.ObjectId;
    date: Date;
    amount: number;
    type: TransactionType;
    currency: string;

    // Merchant
    merchantName: string;
    merchantRaw: string;
    merchantCategory?: string;

    // Payment details
    channel?: TransactionChannel;
    upiId?: string;
    referenceNumber?: string;
    description?: string;

    // Enrichment from email receipts
    enrichment: TransactionEnrichment;

    // Multi-source tracking
    sources: TransactionSource[];
    primarySource: string;

    // Bank info
    accountId?: string;
    bankName?: string;
    balance?: number;

    // Categorization
    category?: string;
    subcategory?: string;
    isRecurring: boolean;
    isInternal: boolean;
}

export interface ITransactionDoc extends Document, ITransaction {
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSourceSchema = new Schema(
    {
        type: {
            type: String,
            enum: ['bank_statement', 'email_receipt', 'credit_card_statement'],
            required: true,
        },
        rawEmailId: { type: Schema.Types.ObjectId, ref: 'RawEmail' },
        statementId: { type: Schema.Types.ObjectId, ref: 'OfficialStatement' },
        importedAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const TransactionEnrichmentSchema = new Schema(
    {
        hasInvoice: { type: Boolean, default: false },
        invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice' },
        orderId: String,
        lineItems: [
            {
                name: String,
                quantity: Number,
                unitPrice: Number,
                totalPrice: Number,
                _id: false,
            },
        ],
        paymentMethod: String,
    },
    { _id: false }
);

const TransactionSchema = new Schema<ITransactionDoc>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        date: { type: Date, required: true },
        amount: { type: Number, required: true },
        type: { type: String, enum: ['debit', 'credit'], required: true },
        currency: { type: String, default: 'INR' },

        merchantName: { type: String, required: true },
        merchantRaw: String,
        merchantCategory: String,

        channel: {
            type: String,
            enum: ['UPI', 'NEFT', 'IMPS', 'RTGS', 'ATM', 'CARD', 'AUTOPAY', 'CHEQUE', 'ONLINE', 'OTHER'],
        },
        upiId: String,
        referenceNumber: String,
        description: String,

        enrichment: { type: TransactionEnrichmentSchema, default: () => ({ hasInvoice: false }) },
        sources: [TransactionSourceSchema],
        primarySource: {
            type: String,
            enum: ['bank_statement', 'email_receipt', 'credit_card_statement'],
        },

        accountId: String,
        bankName: String,
        balance: Number,

        category: String,
        subcategory: String,
        isRecurring: { type: Boolean, default: false },
        isInternal: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false, collection: 'transactions' }
);

TransactionSchema.index({ userId: 1, date: -1, amount: 1, merchantName: 1 });
TransactionSchema.index({ userId: 1, category: 1 });
TransactionSchema.index({ userId: 1, merchantName: 1 });
TransactionSchema.index({ userId: 1, date: -1 });

export const Transaction = mongoose.model<ITransactionDoc>('Transaction', TransactionSchema);
