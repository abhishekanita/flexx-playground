import mongoose, { Schema, Document } from 'mongoose';
import { InvestmentAccount } from '@/types/financial-data/financial.type';

export interface IInvestmentAccountDoc extends Document, Omit<InvestmentAccount, 'id'> {}

const InvestmentAccountSchema = new Schema<IInvestmentAccountDoc>(
    {
        user_id: { type: String, required: true, index: true },

        platform: { type: String, required: true }, // 'Zerodha' | 'ICICI Securities' | 'CAMS' | etc.
        platform_type: { type: String, required: true }, // 'broker' | 'mf_platform' | 'depository' | etc.
        account_id: { type: String, sparse: true }, // client ID / demat account no.
        dp_id: String, // Depository Participant ID
        trading_code: String, // broker trading code
        pan: { type: String, required: true },
        holder_name: String,

        // KYC
        nominees: [String],
        kyc_ok: Boolean,

        // Status
        is_active: { type: Boolean, default: true },
        first_seen_at: Date,
        last_seen_at: Date,
        last_synced_at: Date,
    },
    { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }, versionKey: false }
);

// Find by user + platform + account identifier
InvestmentAccountSchema.index({ user_id: 1, platform: 1, account_id: 1 }, { unique: true, sparse: true });
// Find by DP ID + client ID (demat lookup from NSDL CAS)
InvestmentAccountSchema.index({ user_id: 1, dp_id: 1 }, { sparse: true });

export const InvestmentAccountModel = mongoose.model<IInvestmentAccountDoc>(
    'investment-accounts',
    InvestmentAccountSchema
);
