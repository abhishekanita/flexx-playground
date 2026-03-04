import { generateObject } from 'ai';
import { RedditPostModel, RedditProcessedModel, KnowledgeSearchModel } from '@/schema';
import { EmbeddingService } from './embedding.service';
import {
    ProcessedRedditSchema,
    SYSTEM_PROMPT,
    formatBatchForPrompt,
    type BatchPost,
    type ProcessedRedditExtraction,
} from './reddit-extraction.schema';
import { ProcessedRedditSchemaV2, SYSTEM_PROMPT_V2 } from './reddit-extraction-v2.schema';
import logger, { ServiceLogger } from '@/utils/logger';
import { createOpenAI } from '@ai-sdk/openai';
import { config } from '@/config';
import { type TokenUsage, calculateCost, formatCost } from '@/utils/ai-cost';

export type SchemaVersion = 'v1' | 'v2';

const MODEL_ID = 'gpt-5-mini-2025-08-07';
const CONCURRENCY = 10;

const openai = createOpenAI({
    apiKey: config.openai.apiKey,
});

export interface ProcessingStats {
    processed: number;
    qaGenerated: number;
    skipped: number;
    errors: number;
    tokens: TokenUsage;
    totalCostUsd: number;
    schemaVersion: SchemaVersion;
}

export class RedditProcessorService {
    private logger: ServiceLogger;
    private embeddingService: EmbeddingService;
    private schemaVersion: SchemaVersion;

    constructor(schemaVersion: SchemaVersion = 'v1') {
        this.logger = logger.createServiceLogger('RedditProcessor');
        this.embeddingService = new EmbeddingService();
        this.schemaVersion = schemaVersion;
        this.logger.info(`Using schema ${schemaVersion}, model ${MODEL_ID}, concurrency ${CONCURRENCY}`);
    }

    /**
     * Process all unprocessed Reddit posts.
     */
    async processAll(limit_: number): Promise<ProcessingStats> {
        const stats: ProcessingStats = {
            processed: 0,
            qaGenerated: 0,
            skipped: 0,
            errors: 0,
            tokens: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0 },
            totalCostUsd: 0,
            schemaVersion: this.schemaVersion,
        };

        const limit = limit_ ?? 10;
        const unprocessedPosts = await RedditPostModel.find({ processed: false }).limit(limit);
        this.logger.info(`Found ${unprocessedPosts.length} unprocessed Reddit posts`);

        // Filter out posts with no substance upfront
        const substantivePosts: any[] = [];
        for (const post of unprocessedPosts) {
            const hasBody = post.body && post.body.trim().length > 20;
            const hasComments = post.comments && post.comments.length > 0;
            if (!hasBody && !hasComments) {
                this.logger.warn(`  Skipping — no body or comments: "${post.title.substring(0, 50)}..."`);
                await RedditPostModel.updateOne({ _id: post._id }, { processed: true });
                stats.skipped++;
            } else {
                substantivePosts.push(post);
            }
        }

        // Process in batches of CONCURRENCY
        for (let i = 0; i < substantivePosts.length; i += CONCURRENCY) {
            const batch = substantivePosts.slice(i, i + CONCURRENCY);
            this.logger.info(`\nBatch ${Math.floor(i / CONCURRENCY) + 1}: processing ${batch.length} posts concurrently...`);

            const results = await Promise.allSettled(batch.map(post => this.processOnePost(post)));

            for (let j = 0; j < results.length; j++) {
                const result = results[j];
                const post = batch[j];
                if (result.status === 'fulfilled') {
                    const { qaCount, usage, costUsd } = result.value;
                    stats.processed++;
                    stats.qaGenerated += qaCount;
                    stats.tokens.inputTokens += usage.inputTokens;
                    stats.tokens.outputTokens += usage.outputTokens;
                    stats.tokens.cachedInputTokens += usage.cachedInputTokens;
                    stats.tokens.cacheWriteTokens += usage.cacheWriteTokens;
                    stats.totalCostUsd += costUsd;
                } else {
                    stats.errors++;
                    this.logger.error(`  Error processing "${post.title.substring(0, 40)}": ${result.reason?.message ?? result.reason}`);
                }
            }
        }

        const { tokens } = stats;
        const totalCacheRate = tokens.inputTokens > 0 ? ((tokens.cachedInputTokens / tokens.inputTokens) * 100).toFixed(1) : '0';
        this.logger.info(
            `\nReddit processing complete: ${stats.processed} processed, ${stats.qaGenerated} QA pairs, ${stats.skipped} skipped, ${stats.errors} errors`
        );
        this.logger.info(
            `Token usage: ${tokens.inputTokens.toLocaleString()} input (${tokens.cachedInputTokens.toLocaleString()} cached ${totalCacheRate}%, ${tokens.cacheWriteTokens.toLocaleString()} cache writes) | ${tokens.outputTokens.toLocaleString()} output`
        );
        this.logger.info(`Total cost: ${formatCost(stats.totalCostUsd)}`);
        return stats;
    }

    /**
     * Process a single post end-to-end: extract → store → mark processed.
     */
    private async processOnePost(post: any): Promise<{ qaCount: number; usage: TokenUsage; costUsd: number }> {
        const title = post.title.substring(0, 60);
        this.logger.info(`Processing: "${title}..."`);

        const { extraction, usage } = await this.extractKnowledge(post);
        const cost = calculateCost(MODEL_ID, usage);

        const { masterId, qaCount } = await this.storeExtraction(extraction, usage, cost.totalCost);
        await RedditPostModel.updateOne({ _id: post._id }, { processed: true });

        const cacheRate = usage.inputTokens > 0 ? ((usage.cachedInputTokens / usage.inputTokens) * 100).toFixed(0) : '0';
        this.logger.green(
            `  Done: category=${extraction.primary_category}, quality=${extraction.content_quality}, relevance=${
                extraction.relevance_score
            }, qa=${qaCount} | tokens: ${usage.inputTokens}in/${usage.outputTokens}out (${cacheRate}% cached) | cost: ${formatCost(
                cost.totalCost
            )}`
        );

        return { qaCount, usage, costUsd: cost.totalCost };
    }

    private toBatchPost(post: any): BatchPost {
        const topComments = [...(post.comments || [])].sort((a: any, b: any) => b.score - a.score).slice(0, 30);

        return {
            id: post.redditId,
            subreddit: post.subreddit,
            title: post.title,
            body: post.body || '',
            score: post.score,
            upvote_ratio: post.upvoteRatio,
            flair: post.flair,
            date: post.createdAt.toISOString().split('T')[0],
            comments: topComments.map((c: any) => ({
                author: c.author,
                score: c.score,
                body: c.body,
            })),
        };
    }

    private async extractKnowledge(post: any): Promise<{ extraction: ProcessedRedditExtraction; usage: TokenUsage }> {
        const batchPost = this.toBatchPost(post);
        const prompt = formatBatchForPrompt([batchPost]);

        const schema = this.schemaVersion === 'v2' ? ProcessedRedditSchemaV2 : ProcessedRedditSchema;
        const system = this.schemaVersion === 'v2' ? SYSTEM_PROMPT_V2 : SYSTEM_PROMPT;

        const schemaChars = JSON.stringify(schema).length;
        const systemChars = system.length;
        const promptChars = prompt.length;
        const estTokens = Math.ceil((schemaChars + systemChars + promptChars) / 4);
        this.logger.info(
            `  Est. input: ~${estTokens.toLocaleString()} tokens (schema: ~${Math.ceil(
                schemaChars / 4
            ).toLocaleString()}, system: ~${Math.ceil(systemChars / 4).toLocaleString()}, prompt: ~${Math.ceil(
                promptChars / 4
            ).toLocaleString()})`
        );

        const { object, usage } = await generateObject({
            model: openai(MODEL_ID),
            schema,
            system,
            prompt,
            temperature: 0.2,
        });

        return {
            extraction: object as ProcessedRedditExtraction,
            usage: {
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                cacheWriteTokens: usage.inputTokenDetails?.cacheWriteTokens ?? 0,
            },
        };
    }

    private async storeExtraction(
        extraction: ProcessedRedditExtraction,
        usage: TokenUsage,
        costUsd: number
    ): Promise<{ masterId: string; qaCount: number }> {
        const master = await RedditProcessedModel.create({
            sourcePostIds: extraction.source_post_ids,
            subreddits: extraction.subreddits,
            primaryCategory: extraction.primary_category,
            secondaryCategories: extraction.secondary_categories,
            relevanceScore: extraction.relevance_score,
            contentQuality: extraction.content_quality,
            summary: extraction.summary,
            keyQuotes: extraction.key_quotes,
            sentiment: extraction.search_metadata.sentiment,
            languageMix: extraction.search_metadata.language_mix,
            incomeBracket: extraction.search_metadata.user_profile_signals.income_bracket,
            ageGroup: extraction.search_metadata.user_profile_signals.age_group,
            experienceLevel: extraction.search_metadata.user_profile_signals.experience_level,
            extraction,
            processedAt: new Date(),
            aiUsage: {
                model: MODEL_ID,
                schemaVersion: this.schemaVersion,
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                cachedInputTokens: usage.cachedInputTokens,
                cacheWriteTokens: usage.cacheWriteTokens,
                costUsd,
            },
        });

        // Expand knowledge_qa into individual searchable documents with embeddings
        let qaCount = 0;
        for (const qa of extraction.knowledge_qa) {
            try {
                const embedding = await this.embeddingService.generateEmbedding(`${qa.search_query} ${qa.answer}`);

                await KnowledgeSearchModel.create({
                    processedId: master._id,
                    searchQuery: qa.search_query,
                    answer: qa.answer,
                    answerConfidence: qa.answer_confidence,
                    isEvergreen: qa.is_evergreen,
                    indiaSpecificContext: qa.india_specific_context,
                    sources: qa.sources,
                    primaryCategory: extraction.primary_category,
                    topics: extraction.search_metadata.topics,
                    financialInstruments: extraction.search_metadata.financial_instruments,
                    entitiesMentioned: extraction.search_metadata.entities_mentioned,
                    sentiment: extraction.search_metadata.sentiment,
                    timeHorizon: extraction.search_metadata.time_horizon,
                    incomeBracket: extraction.search_metadata.user_profile_signals.income_bracket,
                    ageGroup: extraction.search_metadata.user_profile_signals.age_group,
                    experienceLevel: extraction.search_metadata.user_profile_signals.experience_level,
                    relevanceScore: extraction.relevance_score,
                    contentQuality: extraction.content_quality,
                    embedding,
                });

                qaCount++;
            } catch (err: any) {
                this.logger.error(`  Failed to store QA "${qa.search_query.substring(0, 50)}": ${err.message}`);
            }
        }

        return { masterId: master._id.toString(), qaCount };
    }
}
