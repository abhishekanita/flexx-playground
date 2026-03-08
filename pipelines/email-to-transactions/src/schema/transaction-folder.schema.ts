import mongoose, { Schema, Document } from 'mongoose';

export enum FolderType {
    // System defaults — always present, auto-populated
    Lifestyle = 'lifestyle',         // uber, swiggy, subscriptions, daily stuff
    Family = 'family',               // transfers to family, shared expenses
    Work = 'work',                   // work-related travel, tools, subscriptions
    Bills = 'bills',                 // rent, electricity, broadband, insurance, EMI
    Investments = 'investments',     // MF, stocks, FD

    // AI-suggested — detected from transaction clusters
    Trip = 'trip',                   // flights + hotels + cabs in a date window
    Event = 'event',                 // wedding, party (gifts + travel + hotel)
    BigPurchase = 'big_purchase',    // one-off large transactions

    // User-created
    Custom = 'custom',
}

export interface FolderRule {
    // Rules for auto-assigning transactions to this folder
    field: 'category' | 'merchant_name' | 'amount' | 'raw_narration' | 'upi_receiver_vpa' | 'channel';
    op: 'eq' | 'in' | 'contains' | 'gt' | 'lt' | 'regex';
    value: string | number | string[];
}

export interface ITransactionFolderDoc extends Document {
    user_id: string;
    name: string;                    // "Thailand Dec 2025", "Lifestyle", "Ritu's Wedding"
    type: FolderType;
    icon?: string;                   // emoji or icon key
    color?: string;                  // hex color for UI

    // Date scope — for trip/event folders
    dateFrom?: Date;
    dateTo?: Date;

    // Auto-assignment rules
    rules: FolderRule[];

    // Manual overrides — txn IDs explicitly added/removed
    includedTxnIds: string[];
    excludedTxnIds: string[];

    // Metadata
    description?: string;            // "Family trip to Thailand"
    totalAmount?: number;            // cached, updated periodically
    txnCount?: number;               // cached
    isArchived: boolean;
    isDefault: boolean;              // system-created, can't delete

    // AI detection metadata
    detectedFrom?: {
        pattern: string;             // "flight_hotel_cluster", "recurring_transfer", etc.
        confidence: number;
        suggestedAt: Date;
    };
}

const TransactionFolderSchema = new Schema(
    {
        user_id: { type: String, required: true, index: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        icon: String,
        color: String,

        dateFrom: Date,
        dateTo: Date,

        rules: [{
            field: { type: String, required: true },
            op: { type: String, required: true },
            value: Schema.Types.Mixed,
        }],

        includedTxnIds: [String],
        excludedTxnIds: [String],

        description: String,
        totalAmount: { type: Number, default: 0 },
        txnCount: { type: Number, default: 0 },
        isArchived: { type: Boolean, default: false },
        isDefault: { type: Boolean, default: false },

        detectedFrom: {
            pattern: String,
            confidence: Number,
            suggestedAt: Date,
        },
    },
    { timestamps: true, versionKey: false }
);

export const TransactionFolderModel = mongoose.model<ITransactionFolderDoc>(
    'transaction-folders',
    TransactionFolderSchema
);
