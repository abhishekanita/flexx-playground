import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { RedditProcessorService, type SchemaVersion } from '@/services/processing/reddit-processor.service';
import { formatCost } from '@/utils/ai-cost';

export async function processRedditPosts() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const schemaVersion = 'v1';
        const processor = new RedditProcessorService(schemaVersion);
        const stats = await processor.processAll(200);

        logger.green(`\n=== Reddit Processing Summary (schema: ${stats.schemaVersion}) ===`);
        logger.info(`  Posts processed: ${stats.processed}`);
        logger.info(`  QA pairs generated: ${stats.qaGenerated}`);
        logger.info(`  Skipped (no content): ${stats.skipped}`);
        logger.info(`  Errors: ${stats.errors}`);
        const { tokens } = stats;
        const cacheRate = tokens.inputTokens > 0 ? ((tokens.cachedInputTokens / tokens.inputTokens) * 100).toFixed(1) : '0';
        logger.info(
            `  Input tokens: ${tokens.inputTokens.toLocaleString()} (${tokens.cachedInputTokens.toLocaleString()} cached ${cacheRate}%, ${tokens.cacheWriteTokens.toLocaleString()} cache writes)`
        );
        logger.info(`  Output tokens: ${tokens.outputTokens.toLocaleString()}`);
        logger.info(`  Total cost: ${formatCost(stats.totalCostUsd)}`);

        await mongoose.disconnect();
        logger.info('Database disconnected');
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}
