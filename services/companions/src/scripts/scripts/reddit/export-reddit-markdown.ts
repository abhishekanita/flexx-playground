import '@/loaders/logger';
import mongoose from 'mongoose';
import { config } from '@/config';
import { RedditScraperService } from '@/services/reddit/reddit-scraper.service';

async function main() {
    try {
        await mongoose.connect(config.db.uri + '/' + config.db.name);
        logger.info('Connected to database');

        const scraper = new RedditScraperService();
        const outputPath = await scraper.exportToMarkdown();

        if (outputPath) {
            logger.green(`\nMarkdown exported to: ${outputPath}`);
        }

        await mongoose.disconnect();
        process.exit(0);
    } catch (err: any) {
        logger.error(`Fatal error: ${err.message}`);
        process.exit(1);
    }
}

main();
