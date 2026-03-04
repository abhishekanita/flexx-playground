import { KnowledgeBaseEntry, TOPICS } from '@/types';
import { Document, Schema, model } from 'mongoose';

export interface IKnowledgeBaseDoc extends Document, Omit<KnowledgeBaseEntry, '_id'> {}

export const KnowledgeBaseSchema = new Schema<IKnowledgeBaseDoc>(
    {
        sourceType: {
            type: String,
            enum: ['reddit', 'youtube'],
            required: true,
            index: true,
        },
        sourceId: { type: String, required: true, index: true },
        title: { type: String, required: true },
        summary: { type: String, required: true },
        keyInsights: { type: [String], default: [] },
        topic: {
            type: String,
            enum: TOPICS,
            required: true,
            index: true,
        },
        subTopics: { type: [String], default: [], index: true },
        financialProducts: { type: [String], default: [], index: true },
        sentiment: {
            type: String,
            enum: ['positive', 'negative', 'neutral', 'mixed'],
            required: true,
        },
        riskLevel: {
            type: String,
            enum: ['low', 'moderate', 'high'],
            default: null,
        },
        targetAudience: {
            type: String,
            enum: ['beginner', 'intermediate', 'advanced'],
            required: true,
        },
        actionability: {
            type: String,
            enum: ['informational', 'actionable', 'comparison', 'review'],
            required: true,
        },
        relevanceScore: { type: Number, min: 0, max: 100, default: 0 },
        engagementScore: { type: Number, default: 0 },
        embedding: { type: [Number], default: [] },
        metadata: { type: Schema.Types.Mixed, default: {} },
        createdAt: { type: Date, required: true },
        processedAt: { type: Date, default: Date.now },
    },
    {
        timestamps: false,
        versionKey: false,
        collection: 'knowledge-base',
    }
);

export const KnowledgeBaseModel = model<IKnowledgeBaseDoc>('KnowledgeBase', KnowledgeBaseSchema);
