import mongoose, { Schema, Document } from 'mongoose';
import { FinancialAccount } from '@/types/financial-data/financial.type';

export interface IFinancialAccountDoc extends Document, Omit<FinancialAccount, 'id'> {}

const FinancialAccountSchema = new Schema<IFinancialAccountDoc>(
    {
        user_id: { type: String, required: true, index: true },

        // Identity
        provider: { type: String, required: true }, // 'HDFC Bank' | 'SBI' | 'Paytm'
        account_type: { type: String, required: true }, // 'savings' | 'credit_card' | 'wallet' | 'upi_lite'
        account_identifier: { type: String, required: true }, // masked: 'XXXX5678'

        // Bank account
        ifsc: String,
        branch: String,

        // Credit card
        card_network: String,
        card_variant: String,
        credit_limit: Number,
        billing_date: Number,
        due_date: Number,

        // Wallet / UPI
        upi_vpa: { type: String, sparse: true },
        linked_upi_vpas: [String],

        // Current state
        current_balance: Number,
        balance_updated_at: Date,

        // Status
        is_active: { type: Boolean, default: true },
        is_primary: { type: Boolean, default: false },
        first_seen_at: Date,
        last_seen_at: Date,
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

// Find by user + provider + identifier (dedup)
FinancialAccountSchema.index({ user_id: 1, provider: 1, account_identifier: 1 }, { unique: true });
// Lookup by account_last4 (for linking transactions)
FinancialAccountSchema.index({ user_id: 1, account_identifier: 1 });
// VPA lookup (for UPI transaction enrichment)
FinancialAccountSchema.index({ user_id: 1, upi_vpa: 1 }, { sparse: true });

export const FinancialAccountModel = mongoose.model<IFinancialAccountDoc>(
    'financial-accounts',
    FinancialAccountSchema
);
