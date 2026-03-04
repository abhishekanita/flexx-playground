import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { YouTubeVideoModel, KnowledgeBaseModel } from '@/schema';
import { TOPICS } from '@/types';
import { EmbeddingService } from './embedding.service';
import logger, { ServiceLogger } from '@/utils/logger';

const knowledgeBaseExtractionSchema = z.object({
    summary: z.string().describe('A comprehensive 2-3 paragraph summary of the video content'),
    keyInsights: z
        .array(z.string())
        .describe('3-7 bullet-point insights extracted from the video'),
    topic: z.enum(TOPICS).describe('Primary topic category'),
    subTopics: z.array(z.string()).describe('Secondary topic categories'),
    financialProducts: z
        .array(z.string())
        .describe(
            'Financial products mentioned (e.g., SIP, FD, PPF, NPS, ELSS, mutual funds, index funds, etc.)'
        ),
    sentiment: z
        .enum(['positive', 'negative', 'neutral', 'mixed'])
        .describe('Overall sentiment of the content'),
    riskLevel: z
        .enum(['low', 'moderate', 'high'])
        .nullable()
        .describe('Risk level discussed, null if not applicable'),
    targetAudience: z
        .enum(['beginner', 'intermediate', 'advanced'])
        .describe('Target audience level'),
    actionability: z
        .enum(['informational', 'actionable', 'comparison', 'review'])
        .describe('Type of advice or information'),
    relevanceScore: z
        .number()
        .min(0)
        .max(100)
        .describe('How useful this content is for Indian personal finance users (0-100)'),
});

export class YouTubeProcessorService {
    private logger: ServiceLogger;
    private embeddingService: EmbeddingService;

    constructor() {
        this.logger = logger.createServiceLogger('YouTubeProcessor');
        this.embeddingService = new EmbeddingService();
    }

    private calculateEngagementScore(video: any): number {
        const viewWeight = 0.01;
        const likeWeight = 1;
        const commentWeight = 5;

        return Math.round(
            video.viewCount * viewWeight + video.likeCount * likeWeight + video.commentCount * commentWeight
        );
    }

    private buildPromptContent(video: any): string {
        const transcriptText = video.transcript
            ? video.transcript.substring(0, 15000)
            : '(no transcript available)';

        return `Title: ${video.title}

Channel: ${video.channelName}

Description:
${video.description || '(no description)'}

Transcript:
${transcriptText}`;
    }

    async processAll(): Promise<{ processed: number; errors: number }> {
        const stats = { processed: 0, errors: 0 };

        const unprocessedVideos = await YouTubeVideoModel.find({ processed: false });
        this.logger.info(`Found ${unprocessedVideos.length} unprocessed YouTube videos`);

        for (const video of unprocessedVideos) {
            try {
                this.logger.info(`Processing: "${video.title.substring(0, 60)}..."`);

                if (!video.transcript && (!video.description || video.description.length < 50)) {
                    this.logger.warn(`  Skipping - no transcript or description`);
                    await YouTubeVideoModel.updateOne({ _id: video._id }, { processed: true });
                    continue;
                }

                const content = this.buildPromptContent(video);

                const { object: extraction } = await generateObject({
                    model: openai('gpt-4o-mini'),
                    schema: knowledgeBaseExtractionSchema,
                    prompt: `You are a financial knowledge analyst specializing in Indian personal finance.
Analyze the following YouTube video content from the channel "${video.channelName}".
Extract structured attributes focusing on relevance to Indian users.

${content}

Focus on:
- Indian-specific financial products and schemes (SIP, PPF, NPS, ELSS, FD, RD, EPF, etc.)
- Indian tax implications (Section 80C, 80D, LTCG, STCG, etc.)
- Indian market context (NIFTY, SENSEX, SEBI regulations, etc.)
- Practical actionable advice for Indian retail investors`,
                });

                const embeddingText = `${video.title} ${extraction.summary} ${extraction.keyInsights.join(' ')}`;
                const embedding = await this.embeddingService.generateEmbedding(embeddingText);

                const engagementScore = this.calculateEngagementScore(video);

                await KnowledgeBaseModel.create({
                    sourceType: 'youtube',
                    sourceId: video.videoId,
                    title: video.title,
                    summary: extraction.summary,
                    keyInsights: extraction.keyInsights,
                    topic: extraction.topic,
                    subTopics: extraction.subTopics,
                    financialProducts: extraction.financialProducts,
                    sentiment: extraction.sentiment,
                    riskLevel: extraction.riskLevel,
                    targetAudience: extraction.targetAudience,
                    actionability: extraction.actionability,
                    relevanceScore: extraction.relevanceScore,
                    engagementScore,
                    embedding,
                    metadata: {
                        channelId: video.channelId,
                        channelName: video.channelName,
                        videoUrl: `https://youtube.com/watch?v=${video.videoId}`,
                        viewCount: video.viewCount,
                        likeCount: video.likeCount,
                        commentCount: video.commentCount,
                        duration: video.duration,
                        thumbnailUrl: video.thumbnailUrl,
                        hasTranscript: !!video.transcript,
                    },
                    createdAt: video.publishedAt,
                    processedAt: new Date(),
                });

                await YouTubeVideoModel.updateOne({ _id: video._id }, { processed: true });

                stats.processed++;
                this.logger.green(
                    `  Processed: topic=${extraction.topic}, relevance=${extraction.relevanceScore}, sentiment=${extraction.sentiment}`
                );
            } catch (err: any) {
                stats.errors++;
                this.logger.error(`  Error processing video "${video.title.substring(0, 40)}": ${err.message}`);
            }
        }

        this.logger.info(`\nYouTube processing complete: ${stats.processed} processed, ${stats.errors} errors`);
        return stats;
    }
}
