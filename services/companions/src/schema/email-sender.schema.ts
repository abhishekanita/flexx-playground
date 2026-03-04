import { Document, Schema, model } from 'mongoose';
import { EmailSender } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL SENDER — Whitelist of known financial email senders
// ─────────────────────────────────────────────────────────────────────────────

export interface IEmailSenderDoc extends Document, Omit<EmailSender, '_id'> {}

const ProcessingConfigSchema = new Schema(
    {
        extractionType: { type: String, enum: ['regex', 'text_between', 'ai'], default: 'ai' },
        expectedFields: { type: [String], default: [] },
        subjectPatterns: { type: [String], default: [] },
        priority: { type: Number, default: 0 },
    },
    { _id: false }
);

const EmailSenderSchema = new Schema<IEmailSenderDoc>(
    {
        emailPattern: { type: String, required: true, index: true },
        domainPattern: { type: String, index: true },
        senderName: { type: String, required: true },
        category: {
            type: String,
            enum: [
                'bank', 'upi', 'credit_card', 'nbfc', 'insurance', 'mutual_fund',
                'stock_broker', 'tax_authority', 'food_delivery', 'ecommerce',
                'travel', 'utility', 'wallet', 'government', 'other',
            ],
            required: true,
            index: true,
        },
        processingConfig: { type: ProcessingConfigSchema, default: () => ({}) },
        status: {
            type: String,
            enum: ['active', 'inactive', 'pending_review'],
            default: 'active',
            index: true,
        },
        matchCount: { type: Number, default: 0 },
        lastMatchAt: Date,
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'email-senders',
    }
);

// Compound index for efficient whitelist lookups
EmailSenderSchema.index({ status: 1, emailPattern: 1 });

export const EmailSenderModel = model<IEmailSenderDoc>('EmailSender', EmailSenderSchema);
