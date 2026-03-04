import { Document, Schema, model, Types } from 'mongoose';

// ─────────────────────────────────────────────────────────────────────────────
// REDDIT PROCESSED — Master record per processed post/batch
// Mongoose schema is intentionally flexible — Zod handles strict validation
// at extraction time. This just stores whatever the AI produces.
// ─────────────────────────────────────────────────────────────────────────────

export interface IRedditProcessedDoc extends Document {
    sourcePostIds: string[];
    subreddits: string[];
    primaryCategory: string;
    secondaryCategories: string[];
    relevanceScore: number;
    contentQuality: string;
    summary: string;
    keyQuotes: string[];
    sentiment: string;
    languageMix: string;
    incomeBracket: string;
    ageGroup: string;
    experienceLevel: string;
    extraction: Record<string, any>;
    processedAt: Date;
    aiUsage?: {
        model: string;
        schemaVersion: string;
        inputTokens: number;
        outputTokens: number;
        cachedInputTokens: number;
        cacheWriteTokens: number;
        costUsd: number;
    };
}

const RedditProcessedSchema = new Schema<IRedditProcessedDoc>(
    {
        sourcePostIds: { type: [String], index: true },
        subreddits: { type: [String], index: true },
        primaryCategory: { type: String, index: true },
        secondaryCategories: { type: [String], default: [] },
        relevanceScore: { type: Number, index: true },
        contentQuality: { type: String, index: true },
        summary: String,
        keyQuotes: { type: [String], default: [] },
        sentiment: String,
        languageMix: String,
        incomeBracket: String,
        ageGroup: String,
        experienceLevel: String,
        extraction: { type: Schema.Types.Mixed },
        processedAt: { type: Date, default: Date.now },
        aiUsage: { type: Schema.Types.Mixed },
    },
    {
        strict: false,
        timestamps: false,
        versionKey: false,
        collection: 'reddit-processed',
    }
);

export const RedditProcessedModel = model<IRedditProcessedDoc>(
    'RedditProcessed',
    RedditProcessedSchema
);

// ─────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE SEARCH — Expanded QA pairs with embeddings for RAG retrieval
// ─────────────────────────────────────────────────────────────────────────────

export interface IKnowledgeSearchDoc extends Document {
    processedId: Types.ObjectId;
    searchQuery: string;
    answer: string;
    answerConfidence: string;
    isEvergreen: boolean;
    indiaSpecificContext?: string;
    sources: Array<{
        post_id: string;
        comment_author?: string;
        excerpt: string;
    }>;
    primaryCategory: string;
    topics: string[];
    financialInstruments: string[];
    entitiesMentioned: string[];
    sentiment: string;
    timeHorizon: string;
    incomeBracket: string;
    ageGroup: string;
    experienceLevel: string;
    relevanceScore: number;
    contentQuality: string;
    embedding: number[];
    createdAt: Date;
}

const KnowledgeSearchSchema = new Schema<IKnowledgeSearchDoc>(
    {
        processedId: { type: Schema.Types.ObjectId, ref: 'RedditProcessed', index: true },
        searchQuery: String,
        answer: String,
        answerConfidence: { type: String, index: true },
        isEvergreen: { type: Boolean, index: true },
        indiaSpecificContext: String,
        sources: {
            type: [
                {
                    post_id: String,
                    comment_author: String,
                    excerpt: String,
                },
            ],
            default: [],
        },
        primaryCategory: { type: String, index: true },
        topics: { type: [String], default: [], index: true },
        financialInstruments: { type: [String], default: [], index: true },
        entitiesMentioned: { type: [String], default: [], index: true },
        sentiment: String,
        timeHorizon: String,
        incomeBracket: { type: String, index: true },
        ageGroup: { type: String, index: true },
        experienceLevel: { type: String, index: true },
        relevanceScore: Number,
        contentQuality: String,
        embedding: { type: [Number], default: [] },
        createdAt: { type: Date, default: Date.now },
    },
    {
        strict: false,
        timestamps: false,
        versionKey: false,
        collection: 'knowledge-search',
    }
);

export const KnowledgeSearchModel = model<IKnowledgeSearchDoc>(
    'KnowledgeSearch',
    KnowledgeSearchSchema
);
