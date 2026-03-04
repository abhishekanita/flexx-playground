import mongoose, { Document, Schema, Types } from 'mongoose';
import type { EnrichmentLinkType } from '@/types/financial.types';

export interface IEnrichmentLink {
    rawEmailId: Types.ObjectId;
    targetCollection: string;
    targetDocId: Types.ObjectId;
    linkType: EnrichmentLinkType;
    matchScore?: number;
    fieldsEnriched: string[];
}

export interface IEnrichmentLinkDoc extends Document, IEnrichmentLink {
    createdAt: Date;
}

const EnrichmentLinkSchema = new Schema<IEnrichmentLinkDoc>(
    {
        rawEmailId: { type: Schema.Types.ObjectId, ref: 'RawEmail', required: true },
        targetCollection: {
            type: String,
            enum: ['transactions', 'invoices', 'official_statements'],
            required: true,
        },
        targetDocId: { type: Schema.Types.ObjectId, required: true },
        linkType: {
            type: String,
            enum: ['created', 'enriched', 'duplicate_skipped'],
            required: true,
        },
        matchScore: Number,
        fieldsEnriched: [String],
    },
    { timestamps: { createdAt: true, updatedAt: false }, versionKey: false, collection: 'enrichment_links' }
);

EnrichmentLinkSchema.index({ rawEmailId: 1 });
EnrichmentLinkSchema.index({ targetCollection: 1, targetDocId: 1 });

export const EnrichmentLink = mongoose.model<IEnrichmentLinkDoc>('EnrichmentLink', EnrichmentLinkSchema);
