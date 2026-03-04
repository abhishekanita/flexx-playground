import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { InstagramScraperService } from '@/services/instagram/instagram-scraper.service';

export async function startInstaScrapping() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const scraper = new InstagramScraperService();
        const stats = await scraper.scrapeAll();

        logger.green('\n=== Instagram Scraping Summary ===');
        for (const s of stats) {
            logger.info(`  ${s.accountName}: ${s.reelsFound} found, ${s.newReelsSaved} new, ${s.errors} errors`);
        }

        await mongoose.disconnect();
        logger.info('Database disconnected');
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
    }
}
