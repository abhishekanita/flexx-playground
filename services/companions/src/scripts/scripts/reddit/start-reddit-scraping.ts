import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { RedditScraperService } from '@/services/reddit/reddit-scraper.service';

async function main() {
    try {
        // Connect to database
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        // Run scraping
        const stats = await new RedditScraperService().scrapeAll();

        // Summary
        logger.green('\n=== Reddit Scraping Summary ===');
        for (const s of stats) {
            logger.info(`  r/${s.subreddit}: ${s.postsFound} found, ${s.newPostsSaved} new, ${s.errors} errors`);
        }

        await mongoose.disconnect();
        logger.info('Database disconnected');
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}

main();
