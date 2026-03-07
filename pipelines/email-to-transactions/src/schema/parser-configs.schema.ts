import mongoose, { Schema, Document } from 'mongoose';
import { ParserConfig } from '@/types/pipelines/parser-config.type';

export interface IParserConfigDoc extends Document, Omit<ParserConfig, '_id'> {}

// ── Main schema ─────────────────────────────────────────────────────────────

const ParserConfigSchema = new Schema<IParserConfigDoc>(
    {
        slug: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        provider: { type: String, required: true, index: true },
        version: { type: Number, default: 1 },
        active: { type: Boolean, default: true, index: true },
        activeForUserIds: { type: [String], default: [] },
        match: Schema.Types.Mixed,
        source: String,
        attachment: Schema.Types.Mixed,
        strategy: Schema.Types.Mixed,
        declarativeRules: Schema.Types.Mixed,
        codeModule: String,
        variants: Schema.Types.Mixed,
        stats: Schema.Types.Mixed,
        domain: Schema.Types.Mixed,
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'parser-configs',
    }
);

export const ParserConfigModel = mongoose.model<IParserConfigDoc>('parser-configs', ParserConfigSchema);
