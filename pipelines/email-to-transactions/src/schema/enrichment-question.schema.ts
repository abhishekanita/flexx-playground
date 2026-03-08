import mongoose, { Schema, Document } from 'mongoose';

export enum EnrichmentQuestionType {
    // === Transaction-level enrichment ===
    // "BISTRO appears 42 times, Rs 12K total. What category is this?"
    IdentifyCategory = 'identify_category',
    // "Is RITU SAHA a person (transfer) or a business?"
    TransferOrSpending = 'transfer_or_spending',
    // "What business uses VPA bharatpe.90397@fbpe?"
    IdentifyVpa = 'identify_vpa',
    // "Apple SE and APPLE ME — same merchant? What is it?"
    MergeMerchants = 'merge_merchants',
    // "Rs 999 x 4 from same merchant — is this a subscription?"
    IdentifySubscription = 'identify_subscription',
    // "Rs 25,000 repeated monthly to same VPA — is this rent?"
    IdentifyRecurring = 'identify_recurring',
    // Freeform: "What is this transaction?"
    Freeform = 'freeform',

    // === Folder-level enrichment ===
    // "We found 3 flights + 2 hotels + 5 cabs in Dec 15-22. Is this a trip? Where to?"
    SuggestTripFolder = 'suggest_trip_folder',
    // "Rs 12,000/month to RITU SAHA. Is this family support?"
    SuggestFamilyFolder = 'suggest_family_folder',
    // "Should we group these transactions into a folder?"
    ConfirmFolder = 'confirm_folder',

    // === Pattern/rule suggestions ===
    // "Rs 25,000 on the 5th of every month — create an auto-tag rule for rent?"
    SuggestRule = 'suggest_rule',
}

export enum EnrichmentQuestionStatus {
    Pending = 'pending',
    Answered = 'answered',
    Applied = 'applied',
    Skipped = 'skipped',
}

export interface EnrichmentAnswer {
    // Transaction enrichment
    category?: string;
    merchantName?: string;
    subCategory?: string;
    isTransfer?: boolean;
    mergeIntoMerchant?: string;

    // Folder enrichment
    folderName?: string;           // "Thailand Dec 2025"
    folderType?: string;           // trip, event, family, custom
    folderIcon?: string;
    assignToFolder?: string;       // existing folder ID to assign txns to

    // Rule creation
    createRule?: boolean;
    ruleField?: string;
    ruleOp?: string;
    ruleValue?: string;

    notes?: string;
    answeredAt?: Date;
}

export interface IEnrichmentQuestionDoc extends Document {
    user_id: string;
    batch_id: string;
    type: EnrichmentQuestionType;
    status: EnrichmentQuestionStatus;

    question: string;
    context: {
        transactionIds: string[];
        sampleNarrations: string[];
        sampleMerchants: string[];
        merchantName?: string;
        vpa?: string;
        totalAmount: number;
        txnCount: number;
        amountRange: { min: number; max: number };
        dateRange: { from: Date; to: Date };
        channels: string[];
        categories: string[];          // categories of grouped txns
        detectedPattern?: string;      // "monthly_recurring", "trip_cluster", etc.
    };

    suggestions: string[];
    answer?: EnrichmentAnswer;
    impact: number;
}

const EnrichmentQuestionSchema = new Schema(
    {
        user_id: { type: String, required: true, index: true },
        batch_id: { type: String, required: true, index: true },
        type: { type: String, required: true },
        status: { type: String, default: 'pending', index: true },

        question: { type: String, required: true },
        context: {
            transactionIds: [String],
            sampleNarrations: [String],
            sampleMerchants: [String],
            merchantName: String,
            vpa: String,
            totalAmount: Number,
            txnCount: Number,
            amountRange: { min: Number, max: Number },
            dateRange: { from: Date, to: Date },
            channels: [String],
            categories: [String],
            detectedPattern: String,
        },

        suggestions: [String],
        answer: { type: Schema.Types.Mixed },
        impact: { type: Number, default: 0 },
    },
    { timestamps: true, versionKey: false }
);

export const EnrichmentQuestionModel = mongoose.model<IEnrichmentQuestionDoc>(
    'enrichment-questions',
    EnrichmentQuestionSchema
);
