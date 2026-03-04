import { Tool } from 'ai';
import z from 'zod';
import { KnowledgeSearchModel, IKnowledgeSearchDoc } from '@/schema/reddit-processed.schema';
import { EmbeddingService } from '@/services/processing/embedding.service';

const embeddingService = new EmbeddingService();

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

export const knowledgeSearchTool: Tool = {
    description:
        'Search the financial knowledge base built from real Indian community discussions. ' +
        'Use this to find answers about personal finance, investing, insurance, loans, credit, tax, ' +
        'and scams in the Indian context. Returns community-backed answers with confidence scores.',
    inputSchema: z.object({
        query: z.string().describe('The search query in natural language, e.g. "how to start SIP in India"'),
        filters: z
            .object({
                primaryCategory: z
                    .string()
                    .optional()
                    .describe(
                        'Filter by category: beginner_education, market_sentiment_and_news, scam_and_fraud_awareness, personal_finance_fundamentals, government_policy_and_regulation, instrument_comparison, insurance_and_protection, stock_picks_and_trading, tax_and_compliance'
                    ),
                topics: z
                    .array(z.string())
                    .optional()
                    .describe('Filter by topics like savings, investments, insurance, loans, mutual-funds, stocks, tax-planning, credit'),
                financialInstruments: z
                    .array(z.string())
                    .optional()
                    .describe('Filter by financial instruments mentioned'),
                experienceLevel: z
                    .string()
                    .optional()
                    .describe('Filter by experience level: beginner, some_knowledge, intermediate, advanced'),
                incomeBracket: z
                    .string()
                    .optional()
                    .describe('Filter by income bracket: under_5L, 5L_to_10L, 10L_to_30L, 30L_plus'),
            })
            .optional()
            .describe('Optional filters to narrow search results'),
        topK: z.number().optional().default(5).describe('Number of results to return (default 5)'),
    }),
    execute: async ({ query, filters, topK = 5 }) => {
        // Step 1: Build Mongoose filter query from tags
        const mongoFilter: Record<string, any> = {};

        if (filters) {
            if (filters.primaryCategory) {
                mongoFilter.primaryCategory = filters.primaryCategory;
            }
            if (filters.topics && filters.topics.length > 0) {
                mongoFilter.topics = { $in: filters.topics };
            }
            if (filters.financialInstruments && filters.financialInstruments.length > 0) {
                mongoFilter.financialInstruments = { $in: filters.financialInstruments };
            }
            if (filters.experienceLevel) {
                mongoFilter.experienceLevel = filters.experienceLevel;
            }
            if (filters.incomeBracket) {
                mongoFilter.incomeBracket = filters.incomeBracket;
            }
        }

        // Step 2: Fetch candidates (tag-filtered or all) — exclude raw embeddings from results
        const hasFilters = Object.keys(mongoFilter).length > 0;
        const limit = hasFilters ? 200 : 100;

        const candidates = await KnowledgeSearchModel.find(mongoFilter)
            .sort({ relevanceScore: -1 })
            .limit(limit)
            .lean<IKnowledgeSearchDoc[]>();

        if (candidates.length === 0) {
            return {
                results: [],
                message: 'No knowledge base entries found matching the query and filters.',
            };
        }

        // Step 3: Generate query embedding
        const queryEmbedding = await embeddingService.generateEmbedding(query);

        // Step 4: Cosine similarity re-rank
        const scored = candidates
            .filter(doc => doc.embedding && doc.embedding.length > 0)
            .map(doc => ({
                searchQuery: doc.searchQuery,
                answer: doc.answer,
                answerConfidence: doc.answerConfidence,
                indiaSpecificContext: doc.indiaSpecificContext || null,
                primaryCategory: doc.primaryCategory,
                topics: doc.topics,
                financialInstruments: doc.financialInstruments,
                sentiment: doc.sentiment,
                experienceLevel: doc.experienceLevel,
                isEvergreen: doc.isEvergreen,
                sources: doc.sources,
                similarityScore: cosineSimilarity(queryEmbedding, doc.embedding),
            }));

        // Step 5: Sort by similarity and return top-K
        scored.sort((a, b) => b.similarityScore - a.similarityScore);
        const results = scored.slice(0, topK).map(r => ({
            ...r,
            similarityScore: Math.round(r.similarityScore * 1000) / 1000,
        }));

        return {
            results,
            totalCandidates: candidates.length,
            message: results.length > 0
                ? `Found ${results.length} relevant results from community knowledge base.`
                : 'No sufficiently relevant results found.',
        };
    },
};
