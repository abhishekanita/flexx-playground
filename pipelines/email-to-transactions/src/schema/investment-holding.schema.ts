import mongoose, { Schema, Document } from 'mongoose';
import { Holding } from '@/types/financial-data/financial.type';

export interface IInvestmentHoldingDoc extends Document, Omit<Holding, 'id'> {}

const InvestmentHoldingSchema = new Schema<IInvestmentHoldingDoc>(
    {
        user_id: { type: String, required: true, index: true },
        investment_account_id: { type: String, required: true, index: true },

        // What
        vehicle: { type: String, required: true }, // 'mutual_fund' | 'stock' | 'etf' | etc.
        asset_class: { type: String, required: true }, // 'equity' | 'debt' | 'hybrid' | etc.
        name: { type: String, required: true }, // scheme name or company name
        isin: { type: String, index: true },
        symbol: String, // 'RELIANCE' / 'NIFTY50BEES'
        folio_number: { type: String, index: true, sparse: true },
        amfi_code: String,

        // MF-specific
        mf_plan: String, // 'direct' | 'regular'
        mf_option: String, // 'growth' | 'idcw'
        amc: String,
        rta: String, // 'CAMS' | 'KFintech'

        // Position
        units: { type: Number, required: true },
        avg_cost_per_unit: { type: Number, default: 0 },
        total_invested: { type: Number, default: 0 },
        current_nav: Number,
        current_value: Number,
        unrealised_pnl: Number,
        unrealised_pnl_pct: Number,

        // SIP tracking
        sip_amount: Number,
        sip_date: Number,
        sip_active: Boolean,
        sip_start_date: String,
        sip_end_date: String,

        // FD / RD / Bond
        principal: Number,
        interest_rate: Number,
        maturity_date: String,
        maturity_amount: Number,
        tenure_months: Number,
        compounding: String,

        // Performance
        xirr: Number,
        absolute_return: Number,

        status: { type: String, required: true, default: 'active' } as any,
        last_nav_updated: Date,

        // Source tracking & reconciliation
        snapshot_date: String, // YYYY-MM-DD — "as of" date from statement
        reconciliation_status: { type: String, required: true, default: 'interim' } as any,
        source: { type: String, required: true }, // 'cams_statement' | 'nsdl_cas' | 'zerodha_demat' | etc.
        source_email_id: String,
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

// Primary lookup: user's holdings
InvestmentHoldingSchema.index({ user_id: 1, status: 1 });
// Find by ISIN across accounts (for cross-ref)
InvestmentHoldingSchema.index({ user_id: 1, isin: 1 });
// Find by folio (MF folio lookup from CAMS)
InvestmentHoldingSchema.index({ user_id: 1, folio_number: 1 }, { sparse: true });
// Find by account + source for bulk replacement
InvestmentHoldingSchema.index({ investment_account_id: 1, source: 1, snapshot_date: 1 });

export const InvestmentHoldingModel = mongoose.model<IInvestmentHoldingDoc>(
    'investment-holdings',
    InvestmentHoldingSchema
);
