import mongoose, { Document, Schema } from 'mongoose';

export interface IParserConfig {
    configId: string;
    version: number;
    isActive: boolean;

    match: {
        senderDomains: string[];
        subjectPattern?: string;
        subjectExcludePattern?: string;
        contentType: string;
        validFrom?: Date;
        validUntil?: Date;
    };

    classification: {
        category: string;
        subcategory: string;
        senderKey: string;
        senderDisplayName?: string;
    };

    extraction: {
        method: string;
        template?: Record<string, any>;
        llm?: Record<string, any>;
        pdfTemplate?: Record<string, any>;
    };

    output: {
        targetCollection: string;
        mapping: Record<string, string>;
        enrichmentFields?: string[];
        deduplication: Record<string, any>;
    };
}

export interface IParserConfigDoc extends Document, IParserConfig {
    createdAt: Date;
    updatedAt: Date;
}

const ParserConfigSchema = new Schema<IParserConfigDoc>(
    {
        configId: { type: String, required: true },
        version: { type: Number, required: true },
        isActive: { type: Boolean, default: true },

        match: {
            senderDomains: [String],
            subjectPattern: String,
            subjectExcludePattern: String,
            contentType: { type: String, enum: ['html', 'pdf'], required: true },
            validFrom: Date,
            validUntil: Date,
        },

        classification: {
            category: { type: String, required: true },
            subcategory: String,
            senderKey: { type: String, required: true },
            senderDisplayName: String,
        },

        extraction: {
            method: {
                type: String,
                enum: ['template', 'llm', 'pdf-template', 'pdf-llm'],
                required: true,
            },
            template: Schema.Types.Mixed,
            llm: Schema.Types.Mixed,
            pdfTemplate: Schema.Types.Mixed,
        },

        output: {
            targetCollection: {
                type: String,
                enum: ['transactions', 'invoices', 'official_statements'],
                required: true,
            },
            mapping: Schema.Types.Mixed,
            enrichmentFields: [String],
            deduplication: Schema.Types.Mixed,
        },
    },
    { timestamps: true, versionKey: false, collection: 'parser_configs' }
);

ParserConfigSchema.index({ configId: 1, version: 1 }, { unique: true });
ParserConfigSchema.index({ 'match.senderDomains': 1 });
ParserConfigSchema.index({ 'classification.senderKey': 1 });
ParserConfigSchema.index({ isActive: 1 });

export const ParserConfig = mongoose.model<IParserConfigDoc>('ParserConfig', ParserConfigSchema);
