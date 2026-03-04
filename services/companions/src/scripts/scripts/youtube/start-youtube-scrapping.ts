import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { YouTubeScraperService } from '@/services/youtube/youtube-scraper.service';

async function main() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const scraper = new YouTubeScraperService();
        const stats = await scraper.scrapeAll();

        logger.green('\n=== YouTube Scraping Summary ===');
        for (const s of stats) {
            logger.info(
                `  ${s.channelName}: ${s.videosFound} found, ${s.newVideosSaved} new, ${s.errors} errors`
            );
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
