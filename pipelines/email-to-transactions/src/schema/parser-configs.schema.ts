import mongoose, { Schema, Document } from 'mongoose';
import { ParserConfig } from '@/types/parser-config.type';

export interface IParserConfigDoc extends Document, Omit<ParserConfig, '_id'> {}

// ── Sub-schemas ─────────────────────────────────────────────────────────────

const FieldExtractorSchema = new Schema(
    {
        type: { type: String, enum: ['regex', 'regex_repeat', 'cheerio', 'xpath'], required: true },
        pattern: String,
        flags: String,
        group: Number,
        fields: [String],
        selector: String,
        attribute: String,
    },
    { _id: false }
);

const FieldRuleSchema = new Schema(
    {
        name: { type: String, required: true },
        type: { type: String, enum: ['string', 'amount', 'int', 'float', 'date', 'boolean'], required: true },
        required: { type: Boolean, default: false },
        extractors: [FieldExtractorSchema],
    },
    { _id: false }
);

const ValidationRuleSchema = new Schema(
    {
        type: { type: String, enum: ['field_present', 'math_check', 'min_items'], required: true },
        fields: [String],
        expr: String,
        tolerance: Number,
        arrayField: String,
        minCount: Number,
    },
    { _id: false }
);

const DeclarativeRulesSchema = new Schema(
    {
        preprocessor: {
            type: String,
            enum: ['cheerio_text', 'raw_html', 'pdf_text', 'xlsx_json'],
            required: true,
        },
        fields: [FieldRuleSchema],
        arrays: [FieldRuleSchema],
        validation: [ValidationRuleSchema],
    },
    { _id: false }
);

const VariantMatchConditionSchema = new Schema(
    {
        receivedBefore: String,
        receivedAfter: String,
        subjectContains: String,
        bodyContains: String,
    },
    { _id: false }
);

const ParserVariantSchema = new Schema(
    {
        id: { type: String, required: true },
        matchCondition: { type: VariantMatchConditionSchema, required: true },
        strategy: { type: String, enum: ['declarative', 'code'], required: true },
        declarativeRules: DeclarativeRulesSchema,
        codeModule: String,
    },
    { _id: false }
);

const FieldStatSchema = new Schema(
    {
        found: { type: Number, default: 0 },
        missing: { type: Number, default: 0 },
    },
    { _id: false }
);

const VersionHistorySchema = new Schema(
    {
        version: { type: Number, required: true },
        activatedAt: { type: String, required: true },
        deactivatedAt: String,
        successRate: { type: Number, default: 0 },
        totalAttempts: { type: Number, default: 0 },
    },
    { _id: false }
);

const ParserStatsSchema = new Schema(
    {
        totalAttempts: { type: Number, default: 0 },
        successCount: { type: Number, default: 0 },
        failCount: { type: Number, default: 0 },
        emptyResultCount: { type: Number, default: 0 },
        lastSuccess: String,
        lastFailure: String,
        successRate: { type: Number, default: 0 },
        avgConfidence: { type: Number, default: 0 },
        fieldStats: { type: Map, of: FieldStatSchema, default: {} },
        versionHistory: { type: [VersionHistorySchema], default: [] },
    },
    { _id: false }
);

// ── Main schema ─────────────────────────────────────────────────────────────

const ParserConfigSchema = new Schema<IParserConfigDoc>(
    {
        id: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        provider: { type: String, required: true, index: true },
        version: { type: Number, default: 1 },

        active: { type: Boolean, default: true, index: true },
        activeForUserIds: { type: [String], default: [] },

        match: {
            fromAddress: { type: String, required: true },
            subject: String,
        },

        source: {
            type: String,
            enum: ['pdf', 'body_html', 'body_text', 'xlsx'],
            required: true,
        },

        attachment: {
            pickBy: { type: String, enum: ['mimeType', 'filename'] },
            mimeTypes: [String],
            filenamePattern: String,
            passwords: [String],
        },

        strategy: {
            type: String,
            enum: ['declarative', 'code'],
            required: true,
        },
        declarativeRules: DeclarativeRulesSchema,
        codeModule: String,

        variants: { type: [ParserVariantSchema], default: [] },

        stats: { type: ParserStatsSchema, default: () => ({}) },

        domain: {
            type: String,
            enum: ['transaction', 'investment', 'loan', 'insurance', 'account', 'statement'],
            default: 'transaction',
        },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'parser-configs',
    }
);

export const ParserConfigModel = mongoose.model<IParserConfigDoc>('parser-configs', ParserConfigSchema);
