import { Document, Schema, model } from 'mongoose';
import { EmailProcessingTemplate } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL PROCESSING TEMPLATE — Declarative extraction rules for repeat senders
// ─────────────────────────────────────────────────────────────────────────────

export interface IEmailProcessingTemplateDoc extends Document, Omit<EmailProcessingTemplate, '_id'> {}

const TemplateRuleSchema = new Schema(
    {
        field: { type: String, required: true },
        method: { type: String, enum: ['regex', 'text_between'], required: true },
        pattern: String,
        startMarker: String,
        endMarker: String,
        transform: { type: String, enum: ['number', 'date', 'uppercase', 'lowercase', 'trim'] },
        group: { type: Number, default: 0 },
    },
    { _id: false }
);

const EmailProcessingTemplateSchema = new Schema<IEmailProcessingTemplateDoc>(
    {
        senderEmailPattern: { type: String, required: true, index: true },
        subjectPattern: String,
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
        },
        rules: { type: [TemplateRuleSchema], default: [] },
        status: {
            type: String,
            enum: ['draft', 'active', 'deprecated'],
            default: 'draft',
            index: true,
        },
        accuracy: { type: Number, default: 0 },
        usageCount: { type: Number, default: 0 },
        createdFrom: {
            type: String,
            enum: ['ai_generated', 'manual'],
            required: true,
        },
        lastUsedAt: Date,
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'email-processing-templates',
    }
);

// Compound index for template lookup by sender + category
EmailProcessingTemplateSchema.index({ senderEmailPattern: 1, category: 1, status: 1 });

export const EmailProcessingTemplateModel = model<IEmailProcessingTemplateDoc>(
    'EmailProcessingTemplate',
    EmailProcessingTemplateSchema
);
