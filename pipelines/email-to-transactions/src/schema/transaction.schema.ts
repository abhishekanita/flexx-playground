import mongoose, { Schema, Document } from 'mongoose';
import { Transaction } from '@/types/financial-data/transactions.type';

export interface ITransactionDoc extends Document, Omit<Transaction, 'id'> {}

const TransactionSchema = new Schema(
    {
        user_id: { type: String, required: true, index: true },
        fingerprint: { type: String, unique: true, sparse: true },

        // Strong match keys
        upi_ref: { type: String, index: true, sparse: true },
        neft_utr: { type: String, index: true, sparse: true },
        imps_ref: { type: String, index: true, sparse: true },

        // Base
        amount: { type: Number, required: true },
        type: { type: String, required: true },
        channel: { type: String, default: 'UNKNOWN' },
        tx_date: { type: Date, required: true, index: true },
        value_date: Date,
        account_last4: { type: String, index: true },
        balance_after: Number,
        raw_narration: String,

        // Merchant
        merchant_name: { type: String, index: true },
        merchant_id: String,
        category: { type: String, default: 'unknown', index: true },
        sub_category: String,
        merchant_order_id: { type: String, index: true, sparse: true },

        // UPI
        upi_app: String,
        upi_sender_vpa: String,
        upi_receiver_vpa: String,

        // Context (schema-free)
        context: { type: Schema.Types.Mixed, default: {} },

        // Reconciliation
        reconciliation_status: { type: String, default: 'pending' },
        reconciled: { type: Boolean, default: false },
        statement_row_id: String,
        statement_narration: String,

        // Folders / tags
        folder_ids: [{ type: String, index: true }],

        // Enrichment
        enrichment_score: { type: Number, default: 0 },
        signal_count: { type: Number, default: 0 },
        needs_review: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'last_enriched_at' }, versionKey: false }
);

// Compound index for fuzzy matching fallback
TransactionSchema.index({ user_id: 1, amount: 1, tx_date: 1, account_last4: 1 });

export const TransactionModel = mongoose.model<ITransactionDoc>('transactions', TransactionSchema);
