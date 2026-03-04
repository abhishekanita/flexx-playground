import { Document, Schema, model } from 'mongoose';
import { FinancialEmail } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL EMAIL — Processed email output with category-specific data
// ─────────────────────────────────────────────────────────────────────────────

export interface IFinancialEmailDoc extends Document, Omit<FinancialEmail, '_id'> {}

const InvoiceItemSchema = new Schema(
    {
        name: String,
        quantity: Number,
        amount: Number,
    },
    { _id: false }
);

const FinancialEmailDataSchema = new Schema(
    {
        amount: Number,
        currency: { type: String, default: 'INR' },
        date: Date,
        merchantName: String,
        accountNumberLast4: String,
        transactionType: { type: String, enum: ['debit', 'credit'] },
        upiId: String,
        referenceNumber: String,
        balance: Number,
        bankName: String,
        cardLast4: String,
        emiNumber: Number,
        emiTotal: Number,
        policyNumber: String,
        invoiceNumber: String,
        invoiceItems: [InvoiceItemSchema],
        taxYear: String,
        panNumber: String,
        description: String,
    },
    { _id: false, strict: false }
);

const AttachmentSchema = new Schema(
    {
        filename: { type: String, required: true },
        mimeType: { type: String, required: true },
        size: { type: Number, required: true },
        extractedText: String,
    },
    { _id: false }
);

const AiUsageSchema = new Schema(
    {
        model: String,
        inputTokens: Number,
        outputTokens: Number,
        costUsd: Number,
    },
    { _id: false }
);

const FinancialEmailSchema = new Schema<IFinancialEmailDoc>(
    {
        connectionId: { type: String, required: true, index: true },
        gmailMessageId: { type: String, required: true, unique: true, index: true },
        threadId: String,
        from: { type: String, required: true },
        to: String,
        subject: { type: String, required: true },
        receivedAt: { type: Date, required: true, index: true },
        filterStage: {
            type: String,
            enum: ['query_match', 'whitelist_match', 'ai_classified'],
            required: true,
        },
        category: {
            type: String,
            enum: [
                'bank_transaction', 'upi_transaction', 'credit_card', 'loan_emi',
                'loan_disbursement', 'salary_credit', 'investment_statement',
                'mutual_fund', 'stock_trading', 'insurance_premium', 'insurance_policy',
                'tax_notice', 'tax_refund', 'itr_filing', 'invoice', 'subscription',
                'food_delivery', 'ecommerce', 'travel_booking', 'utility_bill',
                'wallet_transaction', 'other_financial',
            ],
            required: true,
            index: true,
        },
        processingMethod: {
            type: String,
            enum: ['ai_extraction', 'template_extraction'],
            required: true,
        },
        data: { type: FinancialEmailDataSchema, default: () => ({}) },
        attachments: [AttachmentSchema],
        rawText: String,
        rawHtml: String,
        senderEmailPattern: String,
        templateId: String,
        aiUsage: AiUsageSchema,
        processedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'financial-emails',
    }
);

// Compound indexes for common queries
FinancialEmailSchema.index({ connectionId: 1, receivedAt: -1 });
FinancialEmailSchema.index({ connectionId: 1, category: 1 });

export const FinancialEmailModel = model<IFinancialEmailDoc>('FinancialEmail', FinancialEmailSchema);
