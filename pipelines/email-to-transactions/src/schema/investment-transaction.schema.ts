import mongoose, { Schema, Document } from 'mongoose';
import { InvestmentTransaction } from '@/types/financial-data/financial.type';

export interface IInvestmentTransactionDoc extends Document, Omit<InvestmentTransaction, 'id'> {}

const SourceSignalSchema = new Schema(
    {
        source: { type: String, required: true },
        email_id: String,
        received_at: { type: Date, required: true },
        parsed_data: { type: Schema.Types.Mixed, default: {} },
    },
    { _id: false }
);

const InvestmentTransactionSchema = new Schema<IInvestmentTransactionDoc>(
    {
        user_id: { type: String, required: true, index: true },
        holding_id: { type: String, index: true, sparse: true },
        investment_account_id: { type: String, required: true, index: true },
        fingerprint: { type: String, unique: true, sparse: true },

        tx_type: { type: String, required: true, index: true },
        tx_date: { type: String, required: true, index: true }, // YYYY-MM-DD
        settlement_date: String,

        // Security
        isin: { type: String, index: true },
        security_name: String,

        // Position
        units: Number,
        nav: Number,
        amount: { type: Number, required: true },
        stamp_duty: Number,
        stt: Number,
        brokerage: Number,
        gst_on_brokerage: Number,
        exit_load: Number,
        transaction_charges: Number,
        net_amount: { type: Number, required: true },

        unit_balance_after: Number,

        // Capital gains
        capital_gain: Number,
        capital_gain_type: String,
        holding_period_days: Number,

        // Dividend-specific
        tds_deducted: Number,
        dividend_per_unit: Number,
        financial_year: String,

        // Switch / STP
        switch_to_holding_id: String,
        switch_from_holding_id: String,

        // Source traceability
        source_email_id: String,
        confirmation_no: String,
        order_id: { type: String, sparse: true },
        advisor_code: String,
        channel: String,

        // Equity — contract note
        exchange: String,
        settlement_no: String,
        contract_number: String,
        wap: Number,
        contract_note_id: String,
        broker: String,

        // Reconciliation
        reconciliation_status: { type: String, required: true, default: 'email_only' } as any,
        linked_spending_txn_id: { type: String, sparse: true },

        // Signals
        signal_count: { type: Number, default: 1 },
        source_signals: [SourceSignalSchema],
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

// Timeline queries
InvestmentTransactionSchema.index({ user_id: 1, tx_date: -1 });
// Per-holding history
InvestmentTransactionSchema.index({ holding_id: 1, tx_date: 1 });
// ISIN-based lookup for cross-ref (trade ↔ demat settlement)
InvestmentTransactionSchema.index({ user_id: 1, isin: 1, tx_date: 1 });
// Reconciliation queries
InvestmentTransactionSchema.index({ user_id: 1, reconciliation_status: 1 });

export const InvestmentTransactionModel = mongoose.model<IInvestmentTransactionDoc>(
    'investment-transactions',
    InvestmentTransactionSchema
);
